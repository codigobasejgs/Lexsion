// Regras puras do CRM (M02). Sem I/O — testadas em tests/unit/crm.test.ts.
import type { AttributionTouch, Client, Lead, StageKey } from "./types";

export const STAGES: { key: StageKey; label: string }[] = [
  { key: "novo", label: "Novo contato" },
  { key: "atendimento", label: "Em atendimento" },
  { key: "triagem", label: "Triagem" },
  { key: "documentos", label: "Documentos pendentes" },
  { key: "analise", label: "Análise profissional" },
  { key: "proposta", label: "Proposta" },
  { key: "assinatura", label: "Assinatura" },
  { key: "contratado", label: "Contratado" },
  { key: "perdido", label: "Perdido/Arquivado" },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<StageKey, string>;

export const LOST_REASONS = [
  "Sem direito aparente após triagem",
  "Optou por outro escritório",
  "Sem retorno do contato",
  "Honorários fora do orçamento",
  "Pediu para não ser contatado",
  "Contato duplicado ou inválido",
  "Outro",
];

/** Só dígitos, com DDI 55 quando vier DDD + número. Comparação de telefone sempre por aqui. */
export function normalizePhone(s: string): string {
  const d = s.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

export function formatPhone(s: string): string {
  const d = normalizePhone(s).replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s.trim();
}

export function isValidPhone(s: string): boolean {
  return /^55\d{10,11}$/.test(normalizePhone(s));
}

export function isValidCpf(s: string): boolean {
  const d = s.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(d[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function isValidCnpj(s: string): boolean {
  const d = s.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((acc, wi, i) => acc + wi * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export type ClientMatch = { client: Client; by: "documento" | "telefone" };

/** Possíveis duplicados no mesmo escritório. Documento é forte; telefone pode ser compartilhado na família. */
export function findClientMatches(clients: Client[], q: { phone?: string; document?: string }): ClientMatch[] {
  const doc = q.document?.replace(/\D/g, "") ?? "";
  const phone = q.phone ? normalizePhone(q.phone) : "";
  const out: ClientMatch[] = [];
  for (const c of clients) {
    if (doc && c.document.replace(/\D/g, "") === doc) out.push({ client: c, by: "documento" });
    else if (phone && normalizePhone(c.phone) === phone) out.push({ client: c, by: "telefone" });
  }
  return out;
}

/** Origem só é "confirmada" com evidência técnica (UTM ou id de clique). Sem evidência: não inferir. */
export function buildTouch(input: {
  at: string;
  utm?: Record<string, string>;
  clickId?: string;
  landingPage?: string;
  declaredOrigin?: string;
  campaign?: string;
}): AttributionTouch {
  const utm = Object.fromEntries(Object.entries(input.utm ?? {}).filter(([k, v]) => k.startsWith("utm_") && v));
  const hasEvidence = Object.keys(utm).length > 0 || !!input.clickId;
  if (hasEvidence) {
    const src = utm.utm_source ?? (input.clickId?.startsWith("fbclid") ? "meta" : "google");
    return {
      at: input.at, evidence: "confirmada", utm, clickId: input.clickId, landingPage: input.landingPage,
      origin: src === "meta" ? "Meta Ads" : src === "google" ? "Google Ads" : src,
      campaign: input.campaign ?? utm.utm_campaign,
    };
  }
  if (input.declaredOrigin) return { at: input.at, evidence: "declarada", origin: input.declaredOrigin, landingPage: input.landingPage };
  return { at: input.at, evidence: "nao_identificada", origin: "Origem não identificada", landingPage: input.landingPage };
}

export type StageError = "lost_reason_required" | "client_required" | "same_stage";

export function applyStageChange(lead: Lead, to: StageKey, actorId: string, at: string, note?: string): { ok: true; lead: Lead } | { ok: false; error: StageError } {
  if (lead.stage === to) return { ok: false, error: "same_stage" };
  if (to === "perdido" && !note?.trim()) return { ok: false, error: "lost_reason_required" };
  if (to === "contratado" && !lead.clientId) return { ok: false, error: "client_required" };
  return {
    ok: true,
    lead: {
      ...lead,
      stage: to,
      stageEnteredAt: at,
      lostReason: to === "perdido" ? note!.trim() : undefined,
      history: [...lead.history, { at, from: lead.stage, to, actorId, note: note?.trim() || undefined }],
    },
  };
}

export const STAGE_ERROR_MSG: Record<StageError, string> = {
  lost_reason_required: "Informe o motivo da perda.",
  client_required: "Converta o lead em cliente antes de marcá-lo como contratado.",
  same_stage: "O lead já está nesta etapa.",
};
