import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { aiEnabled, GATE_MESSAGE } from "@/lib/feature-gates";
import { gemini, geminiKeyFor, handoffOut, HANDOFF_ASK, recordUsage, systemPrompt } from "@/lib/wa-ai";

// Simulador da assistente com o modelo REAL e o RASCUNHO atual (testar antes de publicar). Nunca envia nada ao
// WhatsApp; a conversa de teste não é gravada (só a contagem de uso, finalidade "simulador").
const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });
type Turn = { role: "user" | "model"; text: string };

export async function POST(req: NextRequest) {
  if (!aiEnabled()) return err(503, "gated", GATE_MESSAGE.ai);
  if (!supabaseConfigured()) return err(503, "not_configured", "IA não configurada neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as { organizationId?: string; agentId?: string; history?: Turn[] } | null;
  const history = (Array.isArray(b?.history) ? b!.history : []).slice(-12).map((t) => ({ role: t.role === "model" ? "model" as const : "user" as const, text: String(t.text ?? "").slice(0, 2000) })).filter((t) => t.text.trim());
  if (!b?.organizationId || !b.agentId || history.at(-1)?.role !== "user") return err(400, "invalid", "Escreva a mensagem do contato.");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  // Sessão do pedinte: a RLS garante que o agente é do escritório dele e que o papel lê agentes.
  const [{ data: org }, { data: ag }] = await Promise.all([
    sb.from("organizations").select("name,status,ai_enabled_at").eq("id", b.organizationId).maybeSingle(),
    sb.from("org_records").select("data").eq("organization_id", b.organizationId).eq("collection", "agents").eq("id", b.agentId).maybeSingle(),
  ]);
  if (!org || !["ativa", "trial"].includes(org.status) || !ag) return err(403, "forbidden", "Sem acesso a esta assistente.");
  if (!org.ai_enabled_at) return err(412, "ai_disabled", "A IA ainda não foi habilitada pelo titular do escritório (Integrações → IA).");
  const last = history.at(-1)!.text;
  if (HANDOFF_ASK.test(last)) return NextResponse.json({ ok: true, data: { text: null, handoff: "contato pediu atendente (encaminhado sem chamar o modelo)" } });
  const key = await geminiKeyFor(b.organizationId);
  let usage: { input: number; output: number } | null = null;
  const out = await gemini(systemPrompt(org.name, ag.data as Parameters<typeof systemPrompt>[1]), history, key, (u) => { usage = u; });
  await recordUsage({ org: b.organizationId, actor: auth.user.id, purpose: "simulador", module: "assistente", model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash", inputChars: history.reduce((s, h) => s + h.text.length, 0), outputChars: out?.length ?? 0, usage, keyOwner: key === (process.env.GEMINI_API_KEY ?? "") ? "plataforma" : "escritorio" });
  if (!out) return NextResponse.json({ ok: true, data: { text: null, handoff: "assistente sem resposta (no WhatsApp, a conversa iria para a equipe)" } });
  const { wantsHuman, reply } = handoffOut(out);
  return NextResponse.json({ ok: true, data: { text: reply, handoff: wantsHuman ? "a assistente encaminhou ao atendente" : null } });
}
