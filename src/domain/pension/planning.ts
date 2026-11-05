// Ponte entre a análise revisada (Fase 1) e o motor de RMI (Fase 2): monta o perfil do segurado.
import type { CivilDate } from "@/lib/dates";
import { derive, type IntelData } from "./analysis";
import { plan, otherBenefits, type PcdGrade, type Profile, type Projection, type ScEntry } from "./rmi";
import { OFFICIAL, type Tables } from "@/domain/tables";

export interface PlanningInput {
  salaries: ScEntry[]; // salários informados manualmente (sobrepõem os lidos do CNIS no mesmo mês)
  pcd: { grade: PcdGrade; start: CivilDate; end: CivilDate } | null;
  projection: { salary: number; rate: Projection["rate"] };
  accidental: boolean;
  dependents: number;
}
export const emptyPlanning = (): PlanningInput => ({ salaries: [], pcd: null, projection: { salary: 0, rate: "progressiva" }, accidental: false, dependents: 1 });

/** Salários do CNIS dos vínculos REVISADOS, somados por competência; manuais substituem o mês. */
export function salariesFrom(d: IntelData, manual: ScEntry[]): ScEntry[] {
  const r = derive(d);
  const ok = new Set(r.counted.map((x) => x.b.id));
  const sum = new Map<string, number>();
  for (const c of d.contributions) if (ok.has(c.bondId) && c.amount != null && c.amount > 0) sum.set(c.month, (sum.get(c.month) ?? 0) + c.amount);
  for (const m of manual) sum.delete(m.month);
  return [...[...sum.entries()].map(([month, value]) => ({ month, value, source: "CNIS" as const })), ...manual].sort((a, b) => a.month.localeCompare(b.month));
}

export function profileFrom(d: IntelData, p: PlanningInput): Profile | string {
  if (!d.sex) return "Informe o sexo em Possibilidades.";
  if (!d.birthDate) return "Informe a data de nascimento em Possibilidades.";
  const r = derive(d);
  if (!r.counted.length) return "Confirme ao menos um vínculo em Vínculos.";
  const pcdDays = p.pcd && p.pcd.end >= p.pcd.start ? Math.round((Date.parse(p.pcd.end) - Date.parse(p.pcd.start)) / 86_400_000) + 1 : 0;
  return {
    sex: d.sex, birthDate: d.birthDate, conversionDays: r.conversion?.addedDays ?? 0,
    periods: r.counted.map((x) => ({ start: x.b.start!, end: x.end })),
    salaries: salariesFrom(d, p.salaries),
    pcd: p.pcd ? { grade: p.pcd.grade, days: pcdDays } : null,
  };
}

export function runPlanning(d: IntelData, p: PlanningInput, today: CivilDate, t: Tables = OFFICIAL) {
  const prof = profileFrom(d, p);
  if (typeof prof === "string") return { error: prof } as const;
  if (!prof.salaries.length) return { error: "Sem salários de contribuição: leia o CNIS com remunerações ou informe os salários." } as const;
  const lastSalary = prof.salaries.at(-1)!.value;
  const proj = { salary: p.projection.salary || lastSalary, rate: p.projection.rate, from: today };
  return { profile: prof, plan: plan(prof, today, proj, t), others: otherBenefits(prof, today, t, { accidental: p.accidental, dependents: p.dependents }), lastSalary } as const;
}
