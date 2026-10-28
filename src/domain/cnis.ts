// Núcleo CNIS comum (paridade TI/CJ/PREV/INT): um só motor para vínculos, contagem e inconsistências.
// Conta meses civis sem dupla contagem e explica cada fator do diagnóstico. NÃO aplica regra de benefício,
// conversão de tempo especial nem carência por regra de transição: isso é AGUARDA_REVISAO_JURIDICA.
import type { CivilDate } from "@/lib/dates";
import type { ContributionPeriod } from "./types";

export type CnisIssueKind = "datas_invertidas" | "lacuna" | "concomitancia" | "sem_data_fim" | "divergencia" | "abaixo_minimo" | "sem_prova";
export interface CnisIssue { kind: CnisIssueKind; periodIds: string[]; text: string; weight: number; action: string }

export const ISSUE_LABEL: Record<CnisIssueKind, string> = {
  datas_invertidas: "Datas invertidas",
  lacuna: "Lacuna entre vínculos",
  concomitancia: "Concomitância",
  sem_data_fim: "Vínculo sem data de fim",
  divergencia: "Divergência de remuneração",
  abaixo_minimo: "Contribuição abaixo do mínimo",
  sem_prova: "Período sem prova anexada",
};

const ym = (d: CivilDate) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
const label = (m: number) => `${String((m % 12) + 1).padStart(2, "0")}/${Math.floor(m / 12)}`;

/** Meses civis cobertos por ao menos um vínculo (concomitância conta uma vez). */
export function coveredMonths(periods: Pick<ContributionPeriod, "start" | "end">[]): Set<number> {
  const s = new Set<number>();
  for (const p of periods) {
    if (p.end < p.start) continue;
    for (let m = ym(p.start); m <= ym(p.end); m++) s.add(m);
  }
  return s;
}

export function formatMonths(n: number): string {
  const y = Math.floor(n / 12), m = n % 12;
  return `${y} ano(s) e ${m} mes(es)`;
}

/**
 * Inconsistências com peso explicável (soma vira o diagnóstico 0–100). Pesos são DEMONSTRATIVOS,
 * documentados aqui, e não reproduzem score de terceiros.
 */
export function analyzeCnis(periods: ContributionPeriod[], opts: { belowMinimum?: string[]; withoutProof?: string[] } = {}): { issues: CnisIssue[]; months: number; score: number } {
  const issues: CnisIssue[] = [];
  const valid = periods.filter((p) => {
    if (p.end < p.start) {
      issues.push({ kind: "datas_invertidas", periodIds: [p.id], text: `${p.employer}: fim antes do início — período fora da contagem`, weight: 25, action: "Corrigir as datas conferindo CTPS/CNIS" });
      return false;
    }
    return true;
  });
  const sorted = [...valid].sort((a, b) => a.start.localeCompare(b.start));
  let maxEnd = -1, maxEndId = "";
  for (const p of sorted) {
    const s = ym(p.start), e = ym(p.end);
    if (maxEnd >= 0 && s > maxEnd + 1) issues.push({ kind: "lacuna", periodIds: [maxEndId, p.id], text: `Sem contribuição de ${label(maxEnd + 1)} a ${label(s - 1)} (${s - maxEnd - 1} meses)`, weight: 10, action: "Pedir CTPS, carnês ou outra prova do período" });
    if (maxEnd >= 0 && s <= maxEnd) issues.push({ kind: "concomitancia", periodIds: [maxEndId, p.id], text: `${p.employer} sobrepõe vínculo anterior de ${label(s)} a ${label(Math.min(e, maxEnd))}`, weight: 5, action: "Conferir recolhimentos simultâneos (conta uma vez no tempo)" });
    if (e > maxEnd) { maxEnd = e; maxEndId = p.id; }
  }
  for (const p of valid) {
    if (p.flag === "sem_data_fim") issues.push({ kind: "sem_data_fim", periodIds: [p.id], text: `${p.employer}: sem data de fim no extrato`, weight: 10, action: "Pedir comprovante de rescisão ou baixa" });
    if (p.flag === "divergencia_remuneracao") issues.push({ kind: "divergencia", periodIds: [p.id], text: `${p.employer}: remuneração diverge entre fontes`, weight: 10, action: "Pedir holerites ou relação de salários" });
  }
  for (const id of opts.belowMinimum ?? []) {
    const p = valid.find((x) => x.id === id);
    if (p) issues.push({ kind: "abaixo_minimo", periodIds: [id], text: `${p.employer}: competência(s) abaixo do mínimo podem não contar para carência`, weight: 10, action: "Avaliar complementação, conforme regra aplicável" });
  }
  for (const id of opts.withoutProof ?? []) {
    const p = valid.find((x) => x.id === id);
    if (p) issues.push({ kind: "sem_prova", periodIds: [id], text: `${p.employer}: período sem documento de prova vinculado`, weight: 5, action: "Anexar documento ao período" });
  }
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + i.weight, 0));
  return { issues, months: coveredMonths(valid).size, score };
}

/** BPC/LOAS: renda familiar per capita frente a um limite INFORMADO (fração do salário mínimo vigente). */
export function bpcPerCapita(members: { name: string; income: number; excluded?: boolean }[], minimumWage: number, fraction = 0.25) {
  if (!members.length) return { error: "Informe a composição familiar (inclui o requerente)." } as const;
  if (!(minimumWage > 0)) return { error: "Informe o salário mínimo vigente." } as const;
  if (members.some((m) => m.income < 0 || !Number.isFinite(m.income))) return { error: "Renda não pode ser negativa." } as const;
  const counted = members.filter((m) => !m.excluded);
  const total = counted.reduce((s, m) => s + m.income, 0);
  const perCapita = Math.round(total / members.length);
  const limit = Math.round(minimumWage * fraction);
  return { total, perCapita, limit, withinLimit: perCapita <= limit, excluded: members.filter((m) => m.excluded).map((m) => m.name) } as const;
}
