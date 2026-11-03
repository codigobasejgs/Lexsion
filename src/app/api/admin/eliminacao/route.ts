import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Eliminação ASSISTIDA de um escritório (Anexo III.12). Nunca automática, nunca em massa: um escritório por pedido,
// só o PROPRIETÁRIO da plataforma (superadmin), escritório cancelado há 90 dias ou mais, com motivo, digitação do
// endereço do escritório e SENHA reconferida aqui no servidor. Ordem: arquivos do Storage (documentos, marca,
// exportações) → registro permanente em data_erasures → banco em uma transação (saas_erase_org_db). Contratos SaaS
// e pagamentos são preservados (obrigação legal). Backups cifrados expiram no ciclo de 30 cópias (informado).
export const maxDuration = 60;
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "Origem não permitida.");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user?.email) return err(401, "Sessão expirada.");
  const { data: owner } = await sb.rpc("is_platform", { roles: ["superadmin"] });
  if (owner !== true) return err(403, "Somente o proprietário da plataforma elimina dados de um escritório.");
  const b = (await req.json().catch(() => ({}))) as { org?: string; confirm?: string; reason?: string; password?: string };
  const orgId = String(b.org ?? ""), reason = String(b.reason ?? "").trim();
  if (!/^[0-9a-f-]{36}$/.test(orgId)) return err(400, "Escritório inválido.");
  if (reason.length < 10) return err(400, "Informe o motivo (mínimo 10 caracteres).");
  const { data: preview, error: pe } = await sb.rpc("platform_erasure_preview", { p_org: orgId });
  if (pe || !preview) return err(404, "Escritório não encontrado.");
  const o = (preview as { org: { slug: string; name: string; eligible: boolean; closed_at: string; eligible_at: string } }).org;
  if (!o.eligible) return err(409, `Ainda não elegível: elegível a partir de ${o.eligible_at ? new Date(o.eligible_at).toLocaleDateString("pt-BR") : "o cancelamento + 90 dias"}.`);
  if (String(b.confirm ?? "").trim() !== o.slug) return err(400, `Digite exatamente o endereço do escritório (${o.slug}) para confirmar.`);
  // Confirmação reforçada: a senha é conferida de novo, numa sessão descartável (não substitui a sessão atual).
  const check = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: pw } = await check.auth.signInWithPassword({ email: auth.user.email, password: String(b.password ?? "") });
  if (pw) return err(403, "Senha incorreta. Nada foi eliminado.");
  await check.auth.signOut().catch(() => null);

  const db = supabaseAdmin();
  const list = async (bucket: string, prefix: string): Promise<string[]> => {
    const out: string[] = [];
    for (let off = 0; ; off += 1000) {
      const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset: off });
      for (const f of data ?? []) { if (f.id) out.push(`${prefix}/${f.name}`); else out.push(...(await list(bucket, `${prefix}/${f.name}`))); }
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  let removed = 0, failed = 0;
  for (const [bucket, prefix] of [["documentos", orgId], ["exportacoes", orgId], ["marcas", `slug-${o.slug}`]] as const) {
    const paths = await list(bucket, prefix);
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) failed += paths.slice(i, i + 100).length; else removed += data?.length ?? 0;
    }
  }
  const { data: e, error: ie } = await db.from("data_erasures").insert({ organization_id: orgId, org_slug: o.slug, org_name: o.name, closed_at: o.closed_at, eligible_at: o.eligible_at, requested_by: auth.user.id, reason, preview,
    status: failed ? "falhou" : "arquivos_removidos", storage_removed: removed, storage_failed: failed, error: failed ? `${failed} arquivo(s) não removido(s); banco preservado` : null }).select("id").single();
  if (ie || !e) return err(500, "Não foi possível registrar a eliminação. O banco não foi alterado.");
  if (failed) return err(502, `${failed} arquivo(s) não puderam ser removidos. O banco NÃO foi alterado; repita depois.`);
  const { data: counts, error: de } = await db.rpc("saas_erase_org_db", { p_erasure: e.id });
  if (de) {
    await db.from("data_erasures").update({ status: "falhou", error: de.message.slice(0, 300), finished_at: new Date().toISOString() }).eq("id", e.id);
    return err(500, `Arquivos removidos, mas o banco recusou: ${de.message.replace(/^.*?: /, "")}`);
  }
  return NextResponse.json({ ok: true, data: { erasure: e.id, storage_removed: removed, db_removed: counts,
    pending: ["cópias de segurança cifradas: expiram no ciclo de 30 cópias diárias", "contas de login sem outro vínculo: ficam sem escritório (podem ser removidas no Auth)"],
    retained: ["contratos SaaS, aceites e pagamentos (obrigação legal e exercício regular de direitos)"] } });
}
