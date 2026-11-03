import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_TEMPLATE, renderContract, type Party, type PlanSnap, type Supplier, type TemplateVersion } from "@/domain/saas-contract";

// Servidor do contrato SaaS: versão vigente do modelo, snapshots, texto autoritativo e hash.
export const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");
export const hmac = (s: string) => crypto.createHmac("sha256", process.env.CRON_SECRET ?? "lexsion").update(s).digest("hex");
export const templateHash = (t: Pick<TemplateVersion, "title" | "clauses">) => sha256(JSON.stringify({ title: t.title, clauses: t.clauses }));

// Namespace de configuração: produção usa o modelo "saas-lexsion" e a contratada "vigente". O servidor de TESTE define
// SAAS_CONFIG_NS=qa e passa a usar "saas-lexsion-qa"/"qa" (mesmo banco, sem tocar no contrato de produção).
const QA = process.env.SAAS_CONFIG_NS === "qa";
export const TEMPLATE_KEY = QA ? "saas-lexsion-qa" : "saas-lexsion";
export const SUPPLIER_ID = QA ? "qa" : "vigente";
type Tpl = TemplateVersion & { id: string; content_sha256: string };

/**
 * Modelo vigente: o PUBLICADO. Sem aprovação manual — salvar um modelo completo já o disponibiliza
 * (saas_publish_template). Primeira execução: o modelo-base do código é disponibilizado sozinho (não tem pendência
 * fixa; as condições da plataforma vêm da configuração). Versões antigas em revisão ficam só como histórico.
 */
export async function currentTemplate(): Promise<Tpl> {
  const db = supabaseAdmin();
  const { data: pub } = await db.from("saas_contract_template_versions").select("*").eq("template_key", TEMPLATE_KEY).eq("status", "PUBLICADO").maybeSingle();
  if (pub) return pub as Tpl;
  const t = DEFAULT_TEMPLATE;
  const { error } = await db.rpc("saas_publish_template", { p_key: TEMPLATE_KEY, p_version: t.version, p_title: t.title, p_clauses: t.clauses, p_hash: templateHash(t), p_reason: "Modelo-base do código disponibilizado automaticamente", p_actor: null });
  // Corrida (duas primeiras execuções juntas) ou versão já registrada: relê a vigente.
  const { data } = await db.from("saas_contract_template_versions").select("*").eq("template_key", TEMPLATE_KEY).eq("status", "PUBLICADO").maybeSingle();
  if (!data) throw new Error(`modelo de contrato indisponível${error ? `: ${error.message}` : ""}`);
  return data as Tpl;
}

export async function supplierSnapshot(): Promise<Supplier & { verified_at: string | null }> {
  const db = supabaseAdmin();
  let { data } = await db.from("saas_supplier_profile").select("*").eq("id", SUPPLIER_ID).maybeSingle();
  if (!data && QA) {
    // Perfil de teste copiado da contratada real (dados públicos do CNPJ) com contato e condições sintéticos.
    const { data: base } = await db.from("saas_supplier_profile").select("trade_name,legal_name,document,legal_nature,size,address").eq("id", "vigente").single();
    await db.from("saas_supplier_profile").upsert({ id: "qa", ...base, contact_email: "contato-qa@lexsion-qa.invalid", conditions: { acesso_tecnico: "QA", resend_local: "QA", infinitepay_papel: "QA", transferencia: "QA" } });
    data = (await db.from("saas_supplier_profile").select("*").eq("id", "qa").single()).data;
  }
  return data as Supplier & { verified_at: string | null };
}

export const planSnapshot = (p: Record<string, unknown>): PlanSnap => ({ id: String(p.id), label: String(p.label), version: Number(p.version), price_monthly: Number(p.price_monthly), price_yearly: p.price_yearly == null ? null : Number(p.price_yearly), max_users: Number(p.max_users), trial_days: Number(p.trial_days ?? 0), features: (p.features as PlanSnap["features"]) ?? [] });

/** Texto autoritativo + hash para os snapshots gravados (o que é lido = o que é aceito). */
export function renderStored(t: Pick<TemplateVersion, "title" | "clauses" | "version">, c: { supplier: Supplier; party: Party; plan: PlanSnap; cycle: "mensal" | "anual"; number: string; created_at: string; binding: boolean }) {
  const date = new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const text = renderContract(t, { supplier: c.supplier, party: c.party, plan: c.plan, cycle: c.cycle, number: c.number, date, templateVersion: t.version, draft: !c.binding });
  return { text, hash: sha256(text) };
}

export const contractNumber = () => `LX-${new Date().getFullYear()}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
export const newToken = () => crypto.randomBytes(24).toString("base64url");

export async function caudit(contractId: string | null, action: string, detail: string, actor: string | null = null, templateVersionId: string | null = null) {
  await supabaseAdmin().from("saas_contract_audit").insert({ contract_id: contractId, template_version_id: templateVersionId, actor_id: actor, action, detail: detail.slice(0, 500) });
}
