import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { caudit, sha256, SUPPLIER_ID, TEMPLATE_KEY, templateHash } from "@/lib/saas-contract-server";
import { CONDITIONS, type Clause, type ConditionKey } from "@/domain/saas-contract";

// Super Admin (plataforma): contratos de assinatura da LexSion, gerados automaticamente do cadastro e das condições
// configuradas. Sem aprovação manual: salvar um modelo completo cria versão nova JÁ disponível (saas_publish_template);
// condições da plataforma ficam em saas_supplier_profile.conditions. Reconciliação com prévia (dry run) e aplicação.
// Contrato aceito nunca é editado.
const err = (status: number, message: string) => NextResponse.json({ ok: false, error: { message } }, { status });

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "Origem não permitida.");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "Sessão expirada.");
  const { data: isPlat } = await sb.rpc("is_platform", { roles: ["superadmin", "platform_admin"] });
  if (isPlat !== true) return err(403, "Somente a administração da plataforma.");
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();
  const me = auth.user.id;

  if (b.action === "template.save") {
    // Versão nova a partir das cláusulas editadas, disponibilizada na hora se não tiver "[PENDENTE". Contratos já
    // gerados guardam o próprio texto; aceitos nunca mudam.
    const clauses = (Array.isArray(b.clauses) ? b.clauses : []) as Clause[];
    const reason = String(b.reason ?? "").trim();
    const version = String(b.version ?? "").trim();
    if (!/^[\w.-]{3,20}$/.test(version) || reason.length < 5 || !clauses.length || clauses.some((c) => typeof c.title !== "string" || typeof c.body !== "string")) return err(400, "Versão (3–20 caracteres), motivo (≥ 5) e cláusulas são obrigatórios.");
    const t = { title: String(b.title ?? "").slice(0, 200), clauses: clauses.map((c) => ({ n: String(c.n ?? "").slice(0, 20), title: c.title.slice(0, 200), body: c.body.slice(0, 8000) })) };
    if (JSON.stringify(t.clauses).includes("[PENDENTE")) return err(400, "O texto ainda tem “[PENDENTE”. Substitua pelo texto definitivo ou use as condições da plataforma ({{condicao.…}}).");
    const { error } = await db.rpc("saas_publish_template", { p_key: TEMPLATE_KEY, p_version: version, p_title: t.title, p_clauses: t.clauses, p_hash: templateHash(t), p_reason: reason, p_actor: me });
    if (error) return err(400, error.code === "23505" ? "Já existe uma versão com esse número." : error.message.replace(/^.*?: /, ""));
    return NextResponse.json({ ok: true });
  }
  if (b.action === "conditions.save") {
    const s = b.supplier as Record<string, unknown>;
    const email = String(s?.contact_email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err(400, "E-mail de contato inválido.");
    const { data: cur } = await db.from("saas_supplier_profile").select("conditions").eq("id", SUPPLIER_ID).single();
    const next = { ...(cur?.conditions as Record<string, string>) };
    for (const k of Object.keys(CONDITIONS) as ConditionKey[]) {
      const v = (s?.conditions as Record<string, unknown> | undefined)?.[k];
      if (typeof v === "string") { if (v.trim()) next[k] = v.trim().slice(0, 2000); else delete next[k]; }
    }
    await db.from("saas_supplier_profile").update({ contact_email: email || null, contact_phone: String(s?.contact_phone ?? "").trim() || null, conditions: next, updated_at: new Date().toISOString(), updated_by: me }).eq("id", SUPPLIER_ID);
    await caudit(null, "condicoes.atualizadas", JSON.stringify({ contato: !!email, condicoes: Object.keys(next) }).slice(0, 300), me);
    return NextResponse.json({ ok: true });
  }
  if (b.action === "reconcile") {
    const { data, error } = await db.rpc("saas_reconcile_contracts", { p_apply: b.apply === true });
    if (error) return err(400, error.message.replace(/^.*?: /, ""));
    if (b.apply === true) await caudit(null, "reconciliacao.aplicada", `${(data as { acao: string }[]).filter((r) => r.acao.startsWith("aplicado")).length} contrato(s)`, me);
    return NextResponse.json({ ok: true, data });
  }
  if (b.action === "contract.pdf") {
    const { data: c } = await db.from("saas_contracts").select("id,number").eq("number", String(b.number ?? "")).maybeSingle();
    if (!c) return err(404, "Contrato não encontrado.");
    const { data: f } = await db.from("saas_contract_files").select("storage_path,sha256").eq("contract_id", c.id).eq("kind", "contrato_aceito").maybeSingle();
    if (!f) return err(404, "PDF ainda não gerado para este contrato (é gerado no aceite e, se falhar, no primeiro download).");
    const { data: blob } = await db.storage.from("contratos-saas").download(f.storage_path);
    const buf = Buffer.from(await blob!.arrayBuffer());
    if (sha256(buf) !== f.sha256) return err(500, "Falha de integridade do arquivo.");
    await caudit(c.id, "contrato.baixado_admin", "download pela plataforma", me);
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="contrato-lexsion-${c.number}.pdf"`, "Cache-Control": "no-store" } });
  }
  return err(400, "Ação desconhecida.");
}
