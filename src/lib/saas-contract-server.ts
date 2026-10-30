import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_TEMPLATE, renderContract, type Party, type PlanSnap, type Supplier, type TemplateVersion } from "@/domain/saas-contract";

// Servidor do contrato SaaS: versão vigente do modelo, snapshots, texto autoritativo e hash.
export const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");
export const hmac = (s: string) => crypto.createHmac("sha256", process.env.CRON_SECRET ?? "lexsion").update(s).digest("hex");
export const templateHash = (t: Pick<TemplateVersion, "title" | "clauses">) => sha256(JSON.stringify({ title: t.title, clauses: t.clauses }));

/** Versão do modelo apresentada ao público: a PUBLICADA (aprovada por advogado) ou, sem ela, a mais recente em revisão. */
export async function currentTemplate() {
  const db = supabaseAdmin();
  const { data: pub } = await db.from("saas_contract_template_versions").select("*").eq("template_key", "saas-lexsion").eq("status", "PUBLICADO").maybeSingle();
  if (pub) return pub as TemplateVersion & { id: string; content_sha256: string };
  const { data: rev } = await db.from("saas_contract_template_versions").select("*").eq("template_key", "saas-lexsion").in("status", ["REVISAO_JURIDICA", "APROVADO"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (rev) return rev as TemplateVersion & { id: string; content_sha256: string };
  // Primeira execução: semeia a minuta-base EM REVISÃO (nunca publica sozinha).
  const t = DEFAULT_TEMPLATE;
  const { data } = await db.from("saas_contract_template_versions").upsert({ template_key: "saas-lexsion", version: t.version, title: t.title, status: "REVISAO_JURIDICA", clauses: t.clauses, content_sha256: templateHash(t), change_reason: "Minuta-base técnica para revisão jurídica" }, { onConflict: "template_key,version", ignoreDuplicates: true }).select("*").maybeSingle();
  return (data ?? (await db.from("saas_contract_template_versions").select("*").eq("version", t.version).single()).data) as TemplateVersion & { id: string; content_sha256: string };
}

export async function supplierSnapshot(): Promise<Supplier & { verified_at: string | null }> {
  const { data } = await supabaseAdmin().from("saas_supplier_profile").select("*").eq("id", "vigente").single();
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
