import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hint, openSecret, sealSecret, testCredential } from "@/lib/credentials";
import { providerSpec, type ProviderId } from "@/domain/integrations";

// Chaves de integração do escritório. Só o TITULAR salva, testa e remove; a equipe vê o estado. A chave nunca volta
// ao navegador (resposta traz só o final dela). Teste é sempre chamada só de leitura no provedor real.
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });
type Row = { provider: string; hint: string; environment: string; status: string; last_check_at: string | null; last_error: string | null; updated_at: string };

async function who(org: string) {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data: me } = await sb.from("organization_memberships").select("role").eq("organization_id", org).eq("user_id", auth.user.id).maybeSingle();
  return me ? { id: auth.user.id, role: me.role as string } : null;
}

export async function GET(req: NextRequest) {
  const org = req.nextUrl.searchParams.get("org") ?? "";
  const me = await who(org);
  if (!me) return err(403, "Sem acesso a este escritório.");
  const { data } = await supabaseAdmin().from("org_credentials").select("provider,hint,environment,status,last_check_at,last_error,updated_at").eq("organization_id", org);
  return NextResponse.json({ ok: true, canManage: me.role === "admin", items: (data ?? []) as Row[] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "Origem não permitida.");
  const b = (await req.json().catch(() => ({}))) as { organizationId?: string; provider?: string; action?: "save" | "test" | "remove"; secret?: string; environment?: string };
  const org = String(b.organizationId ?? "");
  const me = await who(org);
  if (!me) return err(403, "Sem acesso a este escritório.");
  if (me.role !== "admin") return err(403, "Somente o titular do escritório configura chaves de integração.");
  const spec = providerSpec(String(b.provider));
  if (!spec) return err(400, "Integração desconhecida.");
  const p = spec.id as ProviderId;
  const db = supabaseAdmin();
  const audit = (detail: string) => db.from("audit_logs").insert({ organization_id: org, actor_id: me.id, action: `integracao.${b.action}`, entity: "org_credentials", entity_id: p, detail });

  if (b.action === "remove") {
    await db.from("org_credentials").delete().eq("organization_id", org).eq("provider", p);
    await audit("chave removida");
    return NextResponse.json({ ok: true });
  }
  let secret: string, env: "producao" | "teste";
  if (b.action === "save") {
    secret = String(b.secret ?? "").trim();
    env = spec.environments && b.environment === "teste" ? "teste" : "producao";
    if (secret.length < 3 || secret.length > 500 || /\s/.test(secret)) return err(400, `${spec.field} inválida. Cole exatamente o valor copiado do painel.`);
  } else if (b.action === "test") {
    const { data } = await db.from("org_credentials").select("sealed,environment").eq("organization_id", org).eq("provider", p).maybeSingle();
    if (!data) return err(404, "Nenhuma chave salva para testar.");
    secret = openSecret(data.sealed);
    env = data.environment as "producao" | "teste";
  } else return err(400, "Ação desconhecida.");

  const check = await testCredential(p, secret, env);
  const row = { organization_id: org, provider: p, environment: env, status: check.status, last_check_at: new Date().toISOString(), last_error: check.status === "recusada" ? check.detail : null, updated_by: me.id, updated_at: new Date().toISOString() };
  if (b.action === "save") await db.from("org_credentials").upsert({ ...row, sealed: sealSecret(secret), hint: hint(secret) }, { onConflict: "organization_id,provider" }).throwOnError();
  else await db.from("org_credentials").update(row).eq("organization_id", org).eq("provider", p);
  await audit(`${check.status}${b.action === "save" ? " (chave nova)" : ""}`);
  return NextResponse.json({ ok: true, data: { status: check.status, detail: check.detail } });
}

