// Fontes verificáveis (paridade JUS-06/07, TI-14): toda citação no texto precisa apontar para uma fonte
// cadastrada; sem fonte VERIFICADA, a minuta não é aprovada. Nunca inventamos precedente ou número.
export type SourceStatus = "VERIFICADO" | "NAO_VERIFICADO" | "DESATUALIZADO" | "NAO_DISPONIVEL";
export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = { VERIFICADO: "Verificado", NAO_VERIFICADO: "Não verificado", DESATUALIZADO: "Desatualizado", NAO_DISPONIVEL: "Não disponível" };

export interface LegalSource {
  id: string;
  organizationId: string;
  kind: "lei" | "decreto" | "sumula" | "acordao" | "portaria" | "doutrina";
  label: string; // como aparece no texto, ex.: "Lei 8.213/1991"
  organ: string;
  url?: string;
  excerpt?: string; // trecho conferido pelo profissional
  checkedAt?: string;
  checkedBy?: string;
  status: SourceStatus;
  caseId?: string;
  note?: string;
}

// Padrões de citação reconhecidos no texto da minuta (sem pretensão de cobrir tudo: o profissional confere).
const PATTERNS: RegExp[] = [
  /\b(?:Lei(?: Complementar)?|LC|Decreto(?:-Lei)?|Emenda Constitucional|EC)\s*(?:n[ºo°.]\s*)?\d{1,3}(?:\.\d{3})*\/\d{2,4}\b/gi,
  /\bS[úu]mula(?: Vinculante)?\s*(?:n[ºo°.]\s*)?\d+\s*(?:d[oa]\s*)?(?:STF|STJ|TNU|TST|TRF\d?)?\b/gi,
  /\b(?:REsp|RE|ARE|AgRg|AgInt|Tema)\s*(?:n[ºo°.]\s*)?\d[\d.]*(?:\/[A-Z]{2})?\b/g,
  /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g, // número CNJ
];

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/n[ºo°.]\s*/g, "").replace(/\s+/g, " ").trim();

export function findCitations(text: string): string[] {
  const out = new Map<string, string>();
  for (const p of PATTERNS) for (const m of text.matchAll(p)) if (!out.has(norm(m[0]))) out.set(norm(m[0]), m[0].trim());
  return [...out.values()];
}

/** Cada citação do texto com a fonte correspondente (ou nenhuma). Bloqueia aprovação se alguma não estiver VERIFICADA. */
export function checkCitations(text: string, sources: Pick<LegalSource, "id" | "label" | "status">[]) {
  const rows = findCitations(text).map((c) => {
    const s = sources.find((x) => norm(x.label) === norm(c));
    return { citation: c, sourceId: s?.id, status: (s?.status ?? "NAO_DISPONIVEL") as SourceStatus };
  });
  return { rows, blocking: rows.filter((r) => r.status !== "VERIFICADO") };
}
