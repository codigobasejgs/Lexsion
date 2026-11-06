import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { datajudLookup, parseCnj } from "@/lib/datajud";

// Consulta pontual de metadados públicos de um processo no DataJud (CNJ), para o trabalho do escritório.
// Exige membro com acesso a casos; limite diário por escritório; cada consulta é auditada (número + quem), sem conteúdo.
const ROLES = ["admin", "tenant_admin", "advogado", "estagiario", "controladoria"];
const DAILY = Number(process.env.DATAJUD_DAILY_LIMIT_PER_ORG ?? 100);
const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = (await req.json().catch(() => null)) as { organizationId?: string; cnj?: string } | null;
  const org = String(b?.organizationId ?? "");
  if (!/^[0-9a-f-]{36}$/.test(org)) return err(400, "invalid", "Pedido inválido.");
  const p = parseCnj(String(b?.cnj ?? ""));
  if (!p) return err(400, "invalid", "Número CNJ inválido (confira os 20 dígitos e o dígito verificador).");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  const { data: can } = await sb.rpc("has_role", { org, roles: ROLES });
  if (can !== true) return err(403, "forbidden", "Seu perfil não consulta processos.");
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from("audit_logs").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("action", "datajud.consulta").gte("at", since);
  if ((count ?? 0) >= DAILY) return err(429, "limit", `Limite de ${DAILY} consultas ao DataJud por dia atingido.`);
  const r = await datajudLookup(p.digits);
  await sb.from("audit_logs").insert({ organization_id: org, actor_id: auth.user.id, action: "datajud.consulta", entity: "processes", entity_id: p.formatted, detail: r.ok ? `${r.items.length} resultado(s) em ${r.alias}` : `falha: ${r.code}` });
  if (!r.ok) return err(r.code === "unsupported" ? 422 : r.code === "invalid" ? 400 : 502, r.code, r.message);
  return NextResponse.json({ ok: true, alias: r.alias, items: r.items, source: "DataJud — CNJ (API pública). Dados podem estar incompletos ou desatualizados: confira no tribunal." }, { headers: { "Cache-Control": "no-store" } });
}
