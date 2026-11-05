// Análise previdenciária REAL (Inteligência Jurídica). Os dados extraídos entram como "pendente de revisão";
// só vínculos CONFIRMADOS ou CORRIGIDOS por uma pessoa entram na contagem. Tudo derivado aqui é determinístico.
import type { CivilDate } from "@/lib/dates";
import type { ContributionPeriod } from "@/domain/types";
import { analyzeCnis, coveredMonths } from "@/domain/cnis";
import type { CnisReading, Evidence } from "./cnis-parser";
import type { CtpsContract, PppReading } from "./readers";
import { compareCnisCtps, type CompareRow } from "./readers";
import { assessAccidentAid, assessBenefits, assessPpp, convertSpecial, gracePeriod, RULES_VERSION, unionDays, ymd, type AccidentInput, type PppInput, type Sex, type SpecialKind } from "./rules";

export type ReviewStatus = "pendente" | "confirmado" | "corrigido" | "descartado";
export interface DocEvidence extends Evidence { documentId: string; fileName?: string }
export interface Bond {
  id: string;
  source: "CNIS" | "CTPS" | "manual";
  origin: string;
  originId: string | null;
  kind: string;
  start: CivilDate | null;
  end: CivilDate | null;
  lastRemuneration?: string | null;
  indicators: string[];
  evidence: DocEvidence | null;
  confidence: "alta" | "media" | "baixa";
  status: ReviewStatus;
  original?: { start: CivilDate | null; end: CivilDate | null };
  special?: SpecialKind | null;
  reviewerId?: string;
  reviewedAt?: string;
  note?: string;
}
export interface SourceDoc { kind: "CNIS" | "CTPS" | "PPP"; documentId: string; fileId: string; fileName: string; pages: number; readAt: string; rulesVersion: string; ocrPages?: number[]; ocrModel?: string }
export interface IntelData {
  version: 1;
  sex: Sex | null;
  birthDate: CivilDate | null;
  baseDate: CivilDate; // data de referência (DER pretendida ou hoje)
  person: { name: string | null; nit: string | null; cpf: string | null; evidence: DocEvidence[] };
  sources: SourceDoc[];
  bonds: Bond[]; // CNIS + manuais
  ctps: Bond[]; // contratos lidos da CTPS (para comparação)
  contributions: { bondId: string; month: string; amount: number | null; indicators: string[]; evidence: DocEvidence }[];
  ppp: (PppInput & { evidence?: DocEvidence })[];
  accident: AccidentInput | null;
  unread: DocEvidence[];
  planning?: import("./planning").PlanningInput; // Fase 2 (opcional: análises antigas não têm)
}

export const emptyIntel = (baseDate: CivilDate): IntelData => ({ version: 1, sex: null, birthDate: null, baseDate, person: { name: null, nit: null, cpf: null, evidence: [] }, sources: [], bonds: [], ctps: [], contributions: [], ppp: [], accident: null, unread: [] });

const tag = (e: Evidence, documentId: string, fileName?: string): DocEvidence => ({ ...e, documentId, fileName });

/** Incorpora uma leitura de CNIS. Substitui só o que veio do MESMO documento; vínculos revisados de outro documento ficam. */
export function mergeCnis(d: IntelData, r: CnisReading, src: SourceDoc): IntelData {
  const keep = d.bonds.filter((b) => b.source !== "CNIS" || b.evidence?.documentId !== src.documentId);
  const bonds: Bond[] = r.bonds.map((b) => ({
    id: `cnis-${src.documentId}-${b.seq}`, source: "CNIS", origin: b.origin, originId: b.originId, kind: b.kind, start: b.start, end: b.end, lastRemuneration: b.lastRemuneration,
    indicators: b.indicators, evidence: tag(b.evidence, src.documentId, src.fileName), confidence: b.confidence, status: "pendente",
  }));
  return {
    ...d,
    birthDate: d.birthDate ?? r.person.birthDate,
    person: { name: d.person.name ?? r.person.name, nit: d.person.nit ?? r.person.nit, cpf: d.person.cpf ?? r.person.cpf, evidence: [...d.person.evidence, ...r.person.evidence.map((e) => tag(e, src.documentId, src.fileName))].slice(0, 12) },
    sources: [...d.sources.filter((s) => s.documentId !== src.documentId), src],
    bonds: [...keep, ...bonds],
    contributions: [...d.contributions.filter((c) => c.evidence.documentId !== src.documentId), ...r.contributions.map((c) => ({ bondId: `cnis-${src.documentId}-${c.seq}`, month: c.month, amount: c.amount, indicators: c.indicators, evidence: tag(c.evidence, src.documentId, src.fileName) }))],
    unread: [...d.unread.filter((u) => u.documentId !== src.documentId), ...r.unread.map((u) => tag(u, src.documentId, src.fileName))],
  };
}
export function mergeCtps(d: IntelData, r: { contracts: CtpsContract[]; unread: Evidence[] }, src: SourceDoc): IntelData {
  return {
    ...d,
    sources: [...d.sources.filter((s) => s.documentId !== src.documentId), src],
    ctps: [...d.ctps.filter((b) => b.evidence?.documentId !== src.documentId), ...r.contracts.map((c, i) => ({
      id: `ctps-${src.documentId}-${i + 1}`, source: "CTPS" as const, origin: c.employer ?? "(empregador não lido)", originId: c.employerId, kind: "empregado", start: c.start, end: c.end, indicators: [],
      evidence: c.evidence[0] ? tag(c.evidence[0], src.documentId, src.fileName) : null, confidence: c.confidence, status: "pendente" as const, note: c.role ?? undefined,
    }))],
    unread: [...d.unread.filter((u) => u.documentId !== src.documentId), ...r.unread.map((u) => tag(u, src.documentId, src.fileName))],
  };
}
export function mergePpp(d: IntelData, r: PppReading, src: SourceDoc): IntelData {
  const periods = r.periods.map((p, i) => ({ ...p, id: `ppp-${src.documentId}-${i + 1}`, employer: p.employer || r.employer || "", evidence: (p as { evidence?: Evidence }).evidence ? tag((p as unknown as { evidence: Evidence }).evidence, src.documentId, src.fileName) : undefined }));
  return {
    ...d,
    sources: [...d.sources.filter((s) => s.documentId !== src.documentId), src],
    ppp: [...d.ppp.filter((p) => !p.id.startsWith(`ppp-${src.documentId}-`)), ...periods],
    unread: [...d.unread.filter((u) => u.documentId !== src.documentId), ...r.unread.map((u) => tag(u, src.documentId, src.fileName))],
  };
}

const counted = (b: Bond) => (b.status === "confirmado" || b.status === "corrigido") && !!b.start;
/** Fim usado na contagem: data de fim; sem ela, último dia do mês da última remuneração; sem as duas, não conta. */
export function effectiveEnd(b: Bond): CivilDate | null {
  if (b.end) return b.end;
  const m = b.lastRemuneration ? /^(\d{2})\/(\d{4})$/.exec(b.lastRemuneration) : null;
  if (!m) return null;
  return new Date(Date.UTC(+m[2], +m[1], 0)).toISOString().slice(0, 10) as CivilDate;
}

export interface Derived {
  rulesVersion: string;
  counted: { b: Bond; end: CivilDate }[];
  commonDays: number;
  commonText: string;
  carencyMonths: number | null;
  belowMinimum: number;
  conversion: ReturnType<typeof convertSpecial> | null;
  totalWithConversion: string;
  issues: ReturnType<typeof analyzeCnis>["issues"];
  comparison: CompareRow<Bond>[];
  ppp: { p: IntelData["ppp"][number]; a: ReturnType<typeof assessPpp> }[];
  accident: ReturnType<typeof assessAccidentAid> | null;
  benefits: ReturnType<typeof assessBenefits>;
  grace: ReturnType<typeof gracePeriod> | null;
  pendencias: { text: string; action: string }[];
}

export function derive(d: IntelData): Derived {
  const ok = d.bonds.filter(counted).flatMap((b) => { const end = effectiveEnd(b); return end && end >= b.start! ? [{ b, end }] : []; });
  const commonDays = unionDays(ok.map((x) => ({ start: x.b.start!, end: x.end })));
  const periods: ContributionPeriod[] = ok.map(({ b, end }) => ({ id: b.id, employer: b.origin, start: b.start!, end, category: "empregado", source: b.source === "manual" ? "CNIS" : b.source, flag: b.end ? undefined : "sem_data_fim", evidence: { documentId: b.evidence?.documentId ?? "", page: b.evidence?.page ?? 0, excerpt: b.evidence?.excerpt ?? "" } }));
  const okIds = new Set(ok.map((x) => x.b.id));
  const contribs = d.contributions.filter((c) => okIds.has(c.bondId));
  const below = contribs.filter((c) => c.indicators.some((i) => /MENOR-MIN/.test(i)));
  const belowIds = [...new Set(below.map((c) => c.bondId))];
  const cnis = analyzeCnis(periods, { belowMinimum: belowIds });
  // Carência: meses civis com vínculo confirmado, descontadas as competências marcadas abaixo do mínimo.
  const carencyMonths = ok.length ? coveredMonths(periods).size - new Set(below.map((c) => c.month)).size : null;
  const specials = ok.filter((x) => x.b.special).map((x) => ({ id: x.b.id, label: x.b.origin, start: x.b.start!, end: x.end, kind: x.b.special! }));
  const conversion = d.sex && specials.length ? convertSpecial(specials, d.sex) : null;
  const specialDays = unionDays(specials);
  const lastEnd = ok.map((x) => x.end).sort().at(-1) ?? null;
  const grace = lastEnd ? gracePeriod(lastEnd, { over120: (carencyMonths ?? 0) > 120, unemployedProof: false }) : null;
  const insured = grace ? (lastEnd! >= d.baseDate || grace.until >= d.baseDate) : null;
  const benefits = assessBenefits({ birthDate: d.birthDate, sex: d.sex, on: d.baseDate, commonDays: commonDays + (conversion?.addedDays ?? 0), carencyMonths, specialDays, specialKinds: specials.map((s) => s.kind), insured });
  const comparison = d.ctps.length ? compareCnisCtps(d.bonds.filter((b) => b.source === "CNIS" && b.status !== "descartado"), d.ctps) : [];
  const ppp = d.ppp.map((p) => ({ p, a: assessPpp(p) }));

  const pend: { text: string; action: string }[] = [];
  const waiting = d.bonds.filter((b) => b.status === "pendente").length;
  if (waiting) pend.push({ text: `${waiting} vínculo(s) lido(s) aguardando revisão: não entram na contagem.`, action: "Conferir com o documento e confirmar, corrigir ou descartar." });
  if (!d.sex) pend.push({ text: "Sexo do segurado não informado.", action: "Informar para aplicar idade mínima e fatores de conversão." });
  if (!d.birthDate) pend.push({ text: "Data de nascimento não informada.", action: "Informar ou ler do CNIS." });
  for (const b of ok) if (!b.b.end) pend.push({ text: `${b.b.origin}: sem data de fim; contado até ${b.end.split("-").reverse().join("/")} (última remuneração).`, action: "Pedir rescisão/baixa na CTPS." });
  for (const b of d.bonds.filter(counted)) if (!effectiveEnd(b)) pend.push({ text: `${b.origin}: sem data de fim nem última remuneração — fora da contagem.`, action: "Informar a data de fim após conferir CTPS/CNIS." });
  for (const b of d.bonds.filter((x) => x.status !== "descartado")) for (const ind of b.indicators) pend.push({ text: `${b.origin}: indicador ${ind} no CNIS.`, action: /LC123/.test(ind) ? "Recolhimento no plano simplificado: avaliar complementação para tempo de contribuição." : /EXT/.test(ind) ? "Vínculo extemporâneo: reunir prova (CTPS, ficha de registro, rescisão)." : "Conferir a pendência no extrato e reunir prova." });
  if (below.length) pend.push({ text: `${below.length} competência(s) abaixo do mínimo descontadas da carência.`, action: "Avaliar complementação ou agrupamento, conforme a regra aplicável." });
  for (const c of comparison) if (c.kind !== "confere") pend.push({ text: c.detail, action: c.kind === "so_ctps" ? "Pedir inclusão/acerto do vínculo no CNIS com a CTPS." : c.kind === "so_cnis" ? "Conferir se há outra CTPS ou se o vínculo é de outra natureza." : "Definir a data correta com prova documental." });
  for (const x of cnis.issues) if (x.kind !== "sem_data_fim" && x.kind !== "abaixo_minimo") pend.push({ text: x.text, action: x.action });
  for (const u of d.unread) pend.push({ text: `Trecho não lido com segurança (pág. ${u.page}): "${u.excerpt.slice(0, 90)}"`, action: "Conferir no documento e cadastrar manualmente se for vínculo." });
  for (const { p, a } of ppp) for (const f of a.findings) if (["incompleta", "exige_complementacao", "divergencia"].includes(f.classification)) pend.push({ text: `PPP ${p.employer || ""} ${p.start ? p.start.split("-").reverse().join("/") : ""}: ${f.text}`, action: "Pedir complementação do PPP/LTCAT à empresa." });

  return {
    rulesVersion: RULES_VERSION, counted: ok, commonDays, commonText: ymd(commonDays).text, carencyMonths, belowMinimum: below.length, conversion,
    totalWithConversion: ymd(commonDays + (conversion?.addedDays ?? 0)).text, issues: cnis.issues, comparison, ppp,
    accident: d.accident ? assessAccidentAid(d.accident) : null, benefits, grace, pendencias: pend,
  };
}
