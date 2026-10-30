import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { caudit, sha256, templateHash } from "@/lib/saas-contract-server";
import type { Clause } from "@/domain/saas-contract";

// Super Admin (plataforma + MFA): modelos de contrato (rascunho → revisão jurídica → aprovado → publicado),
// dados da contratada e checklist de aprovação, download auditado do PDF aceito. Contrato aceito nunca é editado.
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });
const CHECK = ["identidade_contratada", "atividade_fiscal", "conta_infinitepay", "clausulas_criticas", "politicas_consumo", "lgpd_dpa"] as const;

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "Origem não permitida.");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "Sessão expirada.");
  const { data: isPlat } = await sb.rpc("is_platform", { roles: ["superadmin", "platform_admin"] });
  if (isPlat !== true) return err(403, "Somente a plataforma, com verificação em duas etapas.");
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();
  const me = auth.user.id;

  if (b.action === "template.draft") {
    // Nova versão (rascunho) a partir de cláusulas editadas; exige motivo.
    const clauses = (Array.isArray(b.clauses) ? b.clauses : []) as Clause[];
    const reason = String(b.reason ?? "").trim();
    const version = String(b.version ?? "").trim();
    if (!/^[\w.-]{3,20}$/.test(version) || reason.length < 5 || !clauses.length || clauses.some((c) => typeof c.title !== "string" || typeof c.body !== "string")) return err(400, "Versão, motivo (≥ 5 caracteres) e cláusulas são obrigatórios.");
    const t = { title: String(b.title ?? "").slice(0, 200), clauses: clauses.map((c) => ({ n: String(c.n ?? "").slice(0, 20), title: c.title.slice(0, 200), body: c.body.slice(0, 8000) })) };
    const { data, error } = await db.from("saas_contract_template_versions").insert({ template_key: "saas-lexsion", version, title: t.title, status: "RASCUNHO", clauses: t.clauses, content_sha256: templateHash(t), change_reason: reason, created_by: me }).select("id").single();
    if (error) return err(400, error.code === "23505" ? "Já existe uma versão com esse número." : "Versão recusada pelo banco.");
    await caudit(null, "modelo.rascunho", `${version}: ${reason}`, me, data.id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "template.status") {
    const to = String(b.to ?? "");
    const id = String(b.id ?? "");
    const patch: Record<string, unknown> = { status: to };
    if (to === "APROVADO") {
      // Aprovação é ato do(a) advogado(a): nome + OAB e declaração de revisão; o banco recusa sem isso.
      const lawyer = String(b.lawyer ?? "").trim();
      if (lawyer.length < 5 || !/OAB/i.test(lawyer) || b.declare !== true) return err(400, "Informe nome e OAB do(a) advogado(a) responsável e confirme a revisão jurídica.");
      Object.assign(patch, { approved_by_name: lawyer, approved_by_user: me, approved_at: new Date().toISOString() });
    }
    if (to === "PUBLICADO") {
      const { data: s } = await db.from("saas_supplier_profile").select("checklist,verified_at").eq("id", "vigente").single();
      const missing = CHECK.filter((k) => !(s?.checklist as Record<string, unknown>)?.[k]);
      if (missing.length || !s?.verified_at) return err(409, `Antes de publicar, conclua o checklist: ${[...missing, ...(s?.verified_at ? [] : ["conferência cadastral da contratada"])].join(", ")}.`);
      // Só uma publicada: a anterior é arquivada (contratos já aceitos guardam o próprio texto e não mudam).
      await db.from("saas_contract_template_versions").update({ status: "ARQUIVADO" }).eq("template_key", "saas-lexsion").eq("status", "PUBLICADO");
      Object.assign(patch, { published_at: new Date().toISOString(), effective_from: new Date().toISOString().slice(0, 10) });
    }
    const { error } = await db.from("saas_contract_template_versions").update(patch).eq("id", id);
    if (error) return err(400, error.message.replace(/^.*?: /, ""));
    await caudit(null, `modelo.${to.toLowerCase()}`, String(b.note ?? patch.approved_by_name ?? "").slice(0, 300), me, id);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "supplier.save") {
    const s = b.supplier as Record<string, unknown>;
    const email = String(s?.contact_email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err(400, "E-mail de contato inválido.");
    const patch: Record<string, unknown> = { contact_email: email || null, contact_phone: String(s?.contact_phone ?? "").trim() || null, updated_at: new Date().toISOString(), updated_by: me };
    if (s?.verified === true) Object.assign(patch, { verified_at: new Date().toISOString(), verified_note: String(s.verified_note ?? "").slice(0, 300) });
    if (s?.checklist && typeof s.checklist === "object") {
      const { data: cur } = await db.from("saas_supplier_profile").select("checklist").eq("id", "vigente").single();
      const next = { ...(cur?.checklist as object) } as Record<string, unknown>;
      for (const k of CHECK) { const v = (s.checklist as Record<string, unknown>)[k]; if (v === true && !next[k]) next[k] = { by: me, at: new Date().toISOString() }; if (v === false) delete next[k]; }
      patch.checklist = next;
    }
    await db.from("saas_supplier_profile").update(patch).eq("id", "vigente");
    await caudit(null, "contratada.atualizada", JSON.stringify({ contato: !!email, conferida: s?.verified === true, checklist: s?.checklist ?? null }).slice(0, 300), me);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "contract.pdf") {
    const { data: c } = await db.from("saas_contracts").select("id,number").eq("number", String(b.number ?? "")).maybeSingle();
    if (!c) return err(404, "Contrato não encontrado.");
    const { data: f } = await db.from("saas_contract_files").select("storage_path,sha256").eq("contract_id", c.id).eq("kind", "contrato_aceito").maybeSingle();
    if (!f) return err(404, "Sem PDF aceito para este contrato.");
    const { data: blob } = await db.storage.from("contratos-saas").download(f.storage_path);
    const buf = Buffer.from(await blob!.arrayBuffer());
    if (sha256(buf) !== f.sha256) return err(500, "Falha de integridade do arquivo.");
    await caudit(c.id, "contrato.baixado_admin", "download pela plataforma", me);
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="contrato-lexsion-${c.number}.pdf"`, "Cache-Control": "no-store" } });
  }
  return err(400, "Ação desconhecida.");
}
