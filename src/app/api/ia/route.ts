import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";

// IA jurídica (Google Gemini) no SERVIDOR. Regras:
// 1) só com IA habilitada pelo titular (consentimento registrado e auditado);
// 2) papel com acesso à IA; 3) texto limitado; 4) saída SEMPRE marcada como sugestão para revisão humana;
// 5) uso registrado sem conteúdo (só contagem e finalidade). A chave nunca vai ao navegador.
const KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const PURPOSES = { resposta: "Escreva uma resposta curta, educada e clara ao cliente, em português do Brasil, sem prometer resultado e sem citar lei que não esteja no contexto.", resumo: "Resuma em tópicos objetivos, em português do Brasil, o que está no texto. Não invente fatos.", minuta: "Organize um rascunho de peça a partir do contexto, em português do Brasil, marcando com [VERIFICAR] tudo que dependa de conferência. Não invente jurisprudência nem números de processo.", triagem: "Liste, em português do Brasil, as perguntas e documentos que faltam para avaliar o caso descrito. Não dê parecer." } as const;
type Purpose = keyof typeof PURPOSES;
const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });

export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || KEY.length < 20) return err(503, "not_configured", "IA não configurada neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as { organizationId?: string; purpose?: Purpose; context?: string } | null;
  const ctx = String(b?.context ?? "").trim();
  if (!b?.organizationId || !b.purpose || !(b.purpose in PURPOSES) || ctx.length < 10) return err(400, "invalid", "Informe o texto (mínimo 10 caracteres).");
  if (ctx.length > 12_000) return err(413, "too_long", "Texto longo demais (máximo 12.000 caracteres).");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  const { data: me } = await sb.from("organization_memberships").select("role").eq("organization_id", b.organizationId).eq("user_id", auth.user.id).maybeSingle();
  if (!me || !["admin", "tenant_admin", "advogado", "atendimento", "estagiario"].includes(me.role)) return err(403, "forbidden", "Seu perfil não usa a IA.");
  const { data: org } = await sb.from("organizations").select("ai_enabled_at,status").eq("id", b.organizationId).maybeSingle();
  if (!org || !["ativa", "trial"].includes(org.status)) return err(403, "forbidden", "Escritório sem acesso.");
  if (!org.ai_enabled_at) return err(412, "ai_disabled", "A IA ainda não foi habilitada pelo titular do escritório (Configurações → IA).");

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" }, signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `Você auxilia a equipe de um escritório de advocacia brasileiro. ${PURPOSES[b.purpose]} Sua saída é uma SUGESTÃO que será revisada por um profissional antes de qualquer uso.` }] },
      contents: [{ role: "user", parts: [{ text: ctx }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
    }),
  }).catch(() => null);
  const j = (await r?.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
  const text = j?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!r?.ok || !text) return err(502, "ai_failed", "A IA não respondeu agora. Tente de novo em instantes.");
  await supabaseAdmin().from("ai_usage").insert({ organization_id: b.organizationId, actor_id: auth.user.id, purpose: b.purpose, model: MODEL, input_chars: ctx.length, output_chars: text.length });
  return NextResponse.json({ ok: true, data: { text, model: MODEL, requiresHumanReview: true } });
}
