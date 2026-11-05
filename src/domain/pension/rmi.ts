// Fase 2 — Motor de RMI e planejamento previdenciário (RGPS). DETERMINÍSTICO e versionado.
// Toda regra cita a fonte; tudo sai "aguarda validação" até a advogada responsável aprovar a versão.
// Simplificações declaradas na memória: descarte retira 30 dias de tempo por competência; competência abaixo do
// mínimo depois de 13/11/2019 não entra na média nem no tempo (CF, art. 195, §14); projeções em moeda de hoje.
import type { CivilDate } from "@/lib/dates";
import { accumulate, addMonths, ceilingAt, levelAt, lifeExpectancy, OFFICIAL, scFactor, type Tables } from "@/domain/tables";
import { daysIncl, EC103_DATE, SOURCES, unionDays, ymd, type Sex, type Source } from "./rules";

export const RMI_VERSION = "rmi-2026.11-1";
export const RMI_SOURCES = {
  ec103art15: { label: "EC 103/2019, art. 15 (pontos)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  ec103art16: { label: "EC 103/2019, art. 16 (idade mínima progressiva)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  ec103art17: { label: "EC 103/2019, art. 17 (pedágio de 50% + fator previdenciário)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  ec103art18: { label: "EC 103/2019, art. 18 (idade, transição)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  ec103art19: { label: "EC 103/2019, art. 19 (regra permanente)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  ec103art20: { label: "EC 103/2019, art. 20 (pedágio de 100%)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  ec103art21: { label: "EC 103/2019, art. 21 (especial, pontos)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  ec103art26: { label: "EC 103/2019, art. 26 (média de 100% e coeficiente; descarte no §6º)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  ec103art23: { label: "EC 103/2019, art. 23 (pensão por morte: cotas)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm" },
  lc142: { label: "LC 142/2013 (aposentadoria da pessoa com deficiência)", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp142.htm" },
  lei8213art29: { label: "Lei 8.213/1991, art. 29 (fator previdenciário, §7º a §9º; 29-C pontos)", url: "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm" },
  lei8213art61: { label: "Lei 8.213/1991, art. 29, §10, e art. 61 (incapacidade temporária: 91% limitado à média dos 12 últimos)", url: "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm" },
  lei8213art86: SOURCES.lei8213art86,
  dec3048art33: { label: "Decreto 3.048/1999, art. 33 (atualização dos salários de contribuição)", url: "https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm" },
  cf195: { label: "CF, art. 195, §14 (competência abaixo do mínimo não conta)", url: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" },
  tabelas: { label: "Índices BCB/IBGE, teto INSS e tábua IBGE (versionados)", url: "https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal" },
} satisfies Record<string, Source>;

export interface ScEntry { month: string; value: number; source: "CNIS" | "manual" | "projecao" }
export interface Period { start: CivilDate; end: CivilDate }
export type PcdGrade = "grave" | "moderada" | "leve";
export interface Profile {
  sex: Sex;
  birthDate: CivilDate;
  periods: Period[]; // tempo comum revisado (concomitância tratada pela união)
  conversionDays: number; // acréscimo por tempo especial convertido até 13/11/2019 (Fase 1)
  salaries: ScEntry[]; // salários de contribuição por competência (soma dos concomitantes)
  pcd?: { grade: PcdGrade; days: number } | null; // tempo na condição de pessoa com deficiência
}
const r2 = (x: number) => Math.round(x * 100) / 100;
const day = (d: CivilDate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000;
const civil = (n: number): CivilDate => new Date(n * 86_400_000).toISOString().slice(0, 10);
const br = (d: string) => (d.length === 7 ? `${d.slice(5)}/${d.slice(0, 4)}` : d.split("-").reverse().join("/"));
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function ageOn(birth: CivilDate, on: CivilDate) {
  let y = +on.slice(0, 4) - +birth.slice(0, 4);
  if (on.slice(5) < birth.slice(5)) y--;
  const anniv = `${+birth.slice(0, 4) + y}${birth.slice(4)}`;
  return { years: y, exact: y + (day(on) - day(anniv)) / 365.25 };
}
/** Idade exata em anos, meses e dias. */
export function ageText(b: CivilDate, on: CivilDate) {
  let y = +on.slice(0, 4) - +b.slice(0, 4), m = +on.slice(5, 7) - +b.slice(5, 7), d = +on.slice(8) - +b.slice(8);
  if (d < 0) { m--; d += new Date(Date.UTC(+on.slice(0, 4), +on.slice(5, 7) - 1, 0)).getUTCDate(); }
  if (m < 0) { y--; m += 12; }
  return `${y} anos, ${m} mes(es) e ${d} dia(s)`;
}
const clip = (ps: Period[], until: CivilDate) => ps.filter((p) => p.start <= until).map((p) => ({ start: p.start, end: p.end < until ? p.end : until }));

// ---------- Salários de contribuição ----------
export interface CorrectedSc { month: string; raw: number; capped: number; factor: number; corrected: number; excluded: string | null }
/** Salários de 07/1994 até o mês anterior ao início, limitados ao teto e atualizados (Dec. 3.048, art. 33). */
export function correctSalaries(salaries: ScEntry[], dibMonth: string, t: Tables = OFFICIAL) {
  const byMonth = new Map<string, number>();
  for (const s of salaries) if (s.month >= "1994-07" && s.month < dibMonth && s.value > 0) byMonth.set(s.month, (byMonth.get(s.month) ?? 0) + s.value);
  const missing = new Set<string>();
  const rows: CorrectedSc[] = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, raw]) => {
    const teto = ceilingAt(t, month)?.value ?? raw;
    const min = levelAt(t, "salarioMinimo", month) ?? 0;
    const capped = Math.min(raw, teto);
    const f = scFactor(t, month, dibMonth);
    f.missing.forEach((m) => missing.add(m));
    const excluded = month >= "2019-11" && raw < min ? "abaixo do mínimo após 13/11/2019 (CF, art. 195, §14) — complementar ou agrupar" : null;
    return { month, raw, capped, factor: f.factor, corrected: r2(capped * f.factor), excluded };
  });
  return { rows, missingIndex: [...missing].sort() };
}

/** Média com descarte (EC 103, art. 26, §6º): testa retirar as menores competências enquanto o tempo mínimo e a carência se mantêm. */
export function bestAverage(rows: CorrectedSc[], opts: { tcDays: number; minTcDays: number; carency: number; rmiOf: (avg: number, tcDays: number, contribs: number) => number; noDiscard?: boolean }) {
  const valid = rows.filter((r) => !r.excluded).map((r) => r.corrected).sort((a, b) => a - b);
  if (!valid.length) return null;
  const total = valid.reduce((s, v) => s + v, 0);
  let best = { k: 0, avg: total / valid.length, rmi: opts.rmiOf(total / valid.length, opts.tcDays, valid.length) };
  if (!opts.noDiscard) {
    let sum = total;
    for (let k = 1; k < valid.length; k++) {
      sum -= valid[k - 1];
      const tc = opts.tcDays - 30 * k, n = valid.length - k;
      if (tc < opts.minTcDays || n < opts.carency) break;
      const avg = sum / n, rmi = opts.rmiOf(avg, tc, n);
      if (rmi > best.rmi + 0.004) best = { k, avg, rmi };
    }
  }
  return { ...best, count: valid.length - best.k };
}

/** Coeficiente da EC 103, art. 26, §2º: 60% + 2% por ano que exceder 20 anos (homem) ou 15 anos (mulher). */
export const coefEc103 = (sex: Sex, tcDays: number, specialBase?: number) => {
  const years = Math.floor(tcDays / 365), base = specialBase ?? (sex === "F" ? 15 : 20);
  return 0.6 + 0.02 * Math.max(0, years - base);
};
/** Fator previdenciário (Lei 8.213, art. 29, §7º): f = (Tc × a ÷ Es) × [1 + (Id + Tc × a) ÷ 100], a = 0,31. Mulher +5 anos. */
export function fatorPrevidenciario(t: Tables, sex: Sex, tcDays: number, birth: CivilDate, dib: CivilDate) {
  const tc = tcDays / 365 + (sex === "F" ? 5 : 0);
  const id = ageOn(birth, dib).exact;
  const es = lifeExpectancy(t, "ambos_os_sexos", Math.floor(id));
  const f = ((tc * 0.31) / es.years) * (1 + (id + tc * 0.31) / 100);
  return { f: Math.round(f * 10000) / 10000, memo: `Fator = (${tc.toFixed(4)} × 0,31 ÷ ${es.years}) × [1 + (${id.toFixed(4)} + ${tc.toFixed(4)} × 0,31) ÷ 100] = ${(Math.round(f * 10000) / 10000).toFixed(4)} (tábua IBGE ${es.year}, ambos os sexos${dib < es.validFrom ? `; para início antes de ${br(es.validFrom)} conferir a tábua do ano anterior` : ""})` };
}

// ---------- Regras de aposentadoria ----------
export type RuleId = "art15" | "art16" | "art17" | "art18" | "art19" | "art20" | "pcd_tempo" | "pcd_idade" | "adquirido_tc" | "adquirido_idade";
export interface RuleCheck { id: RuleId; name: string; requirements: { label: string; needed: string; has: string; ok: boolean }[]; eligible: boolean; reachable: boolean; note?: string; source: Source }
export interface State { on: CivilDate; tcDays: number; tc2019Days: number; ageExact: number; ageYears: number; carency: number; firstStart: CivilDate | null }

const yearOf = (d: CivilDate) => +d.slice(0, 4);
export const pointsRequired = (sex: Sex, on: CivilDate) => Math.min(sex === "F" ? 100 : 105, (sex === "F" ? 86 : 96) + Math.max(0, yearOf(on) - 2019));
export const art16Age = (sex: Sex, on: CivilDate) => Math.min(sex === "F" ? 62 : 65, (sex === "F" ? 56 : 61) + 0.5 * Math.max(0, yearOf(on) - 2019));
export const art18Age = (sex: Sex, on: CivilDate) => (sex === "M" ? 65 : Math.min(62, 60 + 0.5 * Math.max(0, yearOf(on) - 2019)));
const PCD_TIME: Record<PcdGrade, Record<Sex, number>> = { grave: { M: 25, F: 20 }, moderada: { M: 29, F: 24 }, leve: { M: 33, F: 28 } };
const yrs = (n: number) => `${n % 1 ? n.toFixed(1).replace(".", ",") : n} anos`;
const tcText = (d: number) => ymd(Math.max(0, Math.round(d))).text;

export function checkRules(p: Profile, s: State): RuleCheck[] {
  const F = p.sex === "F", req = F ? 30 : 35, reqDays = req * 365;
  const pre = !s.firstStart || s.firstStart <= EC103_DATE; // filiado antes da reforma
  const points = s.ageExact + s.tcDays / 365;
  const r = (label: string, needed: string, has: string, ok: boolean) => ({ label, needed, has, ok });
  const carency = r("Carência", "180 contribuições", `${s.carency}`, s.carency >= 180);
  const out: RuleCheck[] = [];
  if (pre) {
    const pr = pointsRequired(p.sex, s.on);
    out.push({ id: "art15", name: "Pontos (art. 15)", source: RMI_SOURCES.ec103art15, requirements: [r("Tempo de contribuição", yrs(req), tcText(s.tcDays), s.tcDays >= reqDays), r("Pontos (idade + tempo)", `${pr} pontos`, points.toFixed(2).replace(".", ","), points >= pr), carency], eligible: false, reachable: true });
    const a16 = art16Age(p.sex, s.on);
    out.push({ id: "art16", name: "Idade mínima progressiva (art. 16)", source: RMI_SOURCES.ec103art16, requirements: [r("Tempo de contribuição", yrs(req), tcText(s.tcDays), s.tcDays >= reqDays), r("Idade", yrs(a16), s.ageExact.toFixed(2).replace(".", ","), s.ageExact >= a16), carency], eligible: false, reachable: true });
    const miss = Math.max(0, reqDays - s.tc2019Days), can17 = s.tc2019Days > (req - 2) * 365;
    out.push({ id: "art17", name: "Pedágio de 50% (art. 17)", source: RMI_SOURCES.ec103art17, requirements: [r("Tempo em 13/11/2019", `mais de ${req - 2} anos`, tcText(s.tc2019Days), can17), r("Tempo + pedágio 50%", tcText(reqDays + miss * 0.5), tcText(s.tcDays), s.tcDays >= reqDays + miss * 0.5), carency], eligible: false, reachable: can17, note: can17 ? undefined : `Inatingível: faltavam ${tcText((req - 2) * 365 + 1 - s.tc2019Days)} em 13/11/2019.` });
    const a18 = art18Age(p.sex, s.on);
    out.push({ id: "art18", name: "Idade (art. 18)", source: RMI_SOURCES.ec103art18, requirements: [r("Idade", yrs(a18), s.ageExact.toFixed(2).replace(".", ","), s.ageExact >= a18), r("Tempo de contribuição", "15 anos", tcText(s.tcDays), s.tcDays >= 15 * 365), carency], eligible: false, reachable: true });
    out.push({ id: "art20", name: "Pedágio de 100% (art. 20)", source: RMI_SOURCES.ec103art20, requirements: [r("Idade", yrs(F ? 57 : 60), s.ageExact.toFixed(2).replace(".", ","), s.ageExact >= (F ? 57 : 60)), r("Tempo + pedágio 100%", tcText(reqDays + miss), tcText(s.tcDays), s.tcDays >= reqDays + miss), carency], eligible: false, reachable: true });
  } else {
    out.push({ id: "art19", name: "Regra permanente (art. 19)", source: RMI_SOURCES.ec103art19, requirements: [r("Idade", yrs(F ? 62 : 65), s.ageExact.toFixed(2).replace(".", ","), s.ageExact >= (F ? 62 : 65)), r("Tempo de contribuição", yrs(F ? 15 : 20), tcText(s.tcDays), s.tcDays >= (F ? 15 : 20) * 365), carency], eligible: false, reachable: true });
  }
  if (p.pcd) {
    const need = PCD_TIME[p.pcd.grade][p.sex];
    out.push({ id: "pcd_tempo", name: `PcD por tempo — deficiência ${p.pcd.grade} (LC 142, art. 3º, I a III)`, source: RMI_SOURCES.lc142, requirements: [r("Tempo como PcD", yrs(need), tcText(p.pcd.days), p.pcd.days >= need * 365), carency], eligible: false, reachable: true, note: "Grau e período da deficiência dependem de avaliação biopsicossocial do INSS." });
    out.push({ id: "pcd_idade", name: "PcD por idade (LC 142, art. 3º, IV)", source: RMI_SOURCES.lc142, requirements: [r("Idade", yrs(F ? 55 : 60), s.ageExact.toFixed(2).replace(".", ","), s.ageExact >= (F ? 55 : 60)), r("Tempo como PcD", "15 anos", tcText(p.pcd.days), p.pcd.days >= 15 * 365), carency], eligible: false, reachable: true });
  }
  for (const c of out) c.eligible = c.reachable && c.requirements.every((x) => x.ok);
  return out;
}

/** RMI de uma regra na data, com a melhor média possível (descarte quando a regra permite). */
export function rmiFor(rule: RuleId, p: Profile, s: State, t: Tables = OFFICIAL) {
  const dibMonth = s.on.slice(0, 7);
  const { rows, missingIndex } = correctSalaries(p.salaries, dibMonth, t);
  const F = p.sex === "F", req = (F ? 30 : 35) * 365;
  const memo: string[] = [];
  let minTc = 15 * 365, rmiOf: (avg: number, tc: number, n: number) => number, label = "";
  const miss2019 = Math.max(0, req - s.tc2019Days);
  switch (rule) {
    case "art17": {
      minTc = req + miss2019 * 0.5;
      rmiOf = (avg, tc) => avg * fatorPrevidenciario(t, p.sex, tc, p.birthDate, s.on).f;
      label = "100% da média × fator previdenciário";
      break;
    }
    case "art20": minTc = req + miss2019; rmiOf = (avg) => avg; label = "100% da média"; break;
    case "pcd_tempo": minTc = 0; rmiOf = (avg) => avg; label = "100% da média (LC 142, art. 8º, I)"; break;
    case "pcd_idade": minTc = 15 * 365; rmiOf = (avg, _tc, n) => avg * Math.min(1, 0.7 + 0.01 * Math.floor(n / 12)); label = "70% + 1% a cada 12 contribuições (LC 142, art. 8º, IV)"; break;
    case "art15": case "art16": minTc = req; rmiOf = (avg, tc) => avg * coefEc103(p.sex, tc); label = "60% + 2% por ano acima de 15 (mulher) / 20 (homem)"; break;
    default: minTc = F ? 15 * 365 : rule === "art19" ? 20 * 365 : 15 * 365; rmiOf = (avg, tc) => avg * coefEc103(p.sex, tc); label = "60% + 2% por ano acima de 15 (mulher) / 20 (homem)";
  }
  const noDiscard = rule === "pcd_tempo" || rule === "pcd_idade"; // descarte da EC 103 não previsto na LC 142: conferir
  const best = bestAverage(rows, { tcDays: s.tcDays, minTcDays: minTc, carency: 180, rmiOf, noDiscard });
  if (!best) return { rmi: null, memo: ["Sem salários de contribuição informados: RMI não calculada."], discarded: 0, average: null, rows, missingIndex };
  const min = levelAt(t, "salarioMinimo", dibMonth) ?? 0, teto = ceilingAt(t, dibMonth)?.value ?? Infinity;
  const raw = best.rmi, rmi = r2(Math.min(teto, Math.max(min, raw)));
  memo.push(`Média de ${best.count} salário(s) de contribuição atualizado(s) até ${br(dibMonth)}: ${brl(r2(best.avg))}${best.k ? ` (descartadas as ${best.k} menores competências — EC 103, art. 26, §6º; o tempo descartado não conta para nenhum fim)` : ""}.`);
  memo.push(`Cálculo: ${label} = ${brl(r2(raw))}${raw < min ? ` → elevado ao salário mínimo ${brl(min)}` : raw > teto ? ` → limitado ao teto ${brl(teto)}` : ""}.`);
  if (rule === "art15" || rule === "art16" || rule === "art18" || rule === "art19") memo.push(`Coeficiente ${(coefEc103(p.sex, s.tcDays - 30 * best.k) * 100).toFixed(0)}% com ${tcText(s.tcDays - 30 * best.k)} de contribuição.`);
  if (rule === "art17") memo.push(fatorPrevidenciario(t, p.sex, s.tcDays - 30 * best.k, p.birthDate, s.on).memo);
  const excl = rows.filter((x) => x.excluded).length;
  if (excl) memo.push(`${excl} competência(s) abaixo do mínimo após 13/11/2019 fora da média e do tempo.`);
  if (missingIndex.length) memo.push(`Índice ainda não publicado para ${missingIndex.map(br).join(", ")}: considerado 0% (conferir com a portaria de fatores do INSS).`);
  return { rmi, memo, discarded: best.k, average: r2(best.avg), rows, missingIndex };
}

// ---------- Estado na data e planejamento ----------
export interface Projection { salary: number; rate: "progressiva" | "11" | "20" | "5"; from: CivilDate }
/** Contribuição mensal ao INSS: progressiva (empregado, tabela vigente) ou alíquota fixa. */
export function contributionFor(salary: number, rate: Projection["rate"], t: Tables = OFFICIAL, month = "2026-01") {
  const min = levelAt(t, "salarioMinimo", month) ?? 0, teto = ceilingAt(t, month)?.value ?? salary;
  if (rate === "5" || rate === "11") return { value: r2(min * (+rate / 100)), base: min, note: `${rate}% sobre o salário mínimo — só dá direito à aposentadoria por idade (Lei 8.212, art. 21, §2º)` };
  const base = Math.min(Math.max(salary, min), teto);
  if (rate === "20") return { value: r2(base * 0.2), base, note: "20% (contribuinte individual/facultativo)" };
  // Tabela progressiva vigente (Portaria Interministerial MPS/MF 13/2026), conferida em gov.br/inss.
  const bands = [[1621.0, 0.075], [2902.84, 0.09], [4354.27, 0.12], [8475.55, 0.14]] as const;
  let v = 0, lo = 0;
  for (const [hi, a] of bands) { if (base > lo) v += (Math.min(base, hi) - lo) * a; lo = hi; }
  return { value: r2(v), base, note: "Tabela progressiva do empregado 2026 (7,5% a 14%)" };
}

export function stateOn(p: Profile, on: CivilDate, projection?: Projection | null): State {
  const periods = projection && on >= projection.from ? [...p.periods, { start: projection.from, end: on }] : p.periods;
  const real = clip(periods, on);
  const excluded = p.salaries.filter((s) => s.month >= "2019-11" && s.month <= on.slice(0, 7) && s.value < (levelAt(OFFICIAL, "salarioMinimo", s.month) ?? 0)).length;
  const tcDays = Math.max(0, unionDays(real) + p.conversionDays - 30 * excluded);
  const tc2019Days = unionDays(clip(p.periods, EC103_DATE)) + p.conversionDays;
  const months = new Set<string>();
  for (const x of real) for (let m = x.start.slice(0, 7); m <= x.end.slice(0, 7); m = addMonths(m, 1)) months.add(m);
  const a = ageOn(p.birthDate, on);
  const firstStart = [...p.periods].sort((x, y) => x.start.localeCompare(y.start))[0]?.start ?? null;
  return { on, tcDays, tc2019Days, ageExact: a.exact, ageYears: a.years, carency: Math.max(0, months.size - excluded), firstStart };
}

const AGE_ONLY: RuleId[] = ["art18", "art19", "pcd_idade"];
/**
 * Estado rápido para datas futuras: pré-calcula o histórico até hoje e soma a contribuição projetada desde hoje.
 * Com alíquota reduzida (5%/11%), o tempo futuro conta só para idade/carência, não para tempo de contribuição.
 */
function fastState(p: Profile, today: CivilDate, onlyAge: boolean) {
  const base = stateOn(p, today);
  const pastMonths = new Set<string>();
  for (const x of clip(p.periods, today)) for (let m = x.start.slice(0, 7); m <= x.end.slice(0, 7); m = addMonths(m, 1)) pastMonths.add(m);
  const lastCovered = clip(p.periods, today).reduce((mx, x) => (x.end > mx ? x.end : mx), "0000-00-00");
  return (on: CivilDate): State => {
    // Dias novos = união do período projetado [hoje, on] com o que já estava coberto depois de hoje (concomitância).
    const fromDay = Math.max(day(today), lastCovered >= today ? day(lastCovered) + 1 : day(today));
    const extraDays = Math.max(0, day(on) - fromDay + 1);
    let extraMonths = 0;
    for (let m = today.slice(0, 7); m <= on.slice(0, 7); m = addMonths(m, 1)) if (!pastMonths.has(m)) extraMonths++;
    const a = ageOn(p.birthDate, on);
    return { ...base, on, tcDays: base.tcDays + (onlyAge ? 0 : extraDays), ageExact: a.exact, ageYears: a.years, carency: base.carency + extraMonths };
  };
}

export interface PlanPoint { rule: RuleId; name: string; date: CivilDate; rmi: number | null; memo: string[]; requirements: RuleCheck["requirements"]; source: Source; ageAt: string; contribMonths: number; contribTotal: number; lostTotal: number; gain: number | null; paybackMonths: number | null; lifetimeValue: number | null }
export interface Plan { today: CivilDate; current: { checks: RuleCheck[]; best: { rule: RuleId; name: string; rmi: number | null; memo: string[] } | null }; points: PlanPoint[]; unreachable: RuleCheck[]; lifeExpectancy: { age: number; years: number; until: number; table: number }; contribution: ReturnType<typeof contributionFor>; version: string; assumptions: string[] }

/** Quantos 13ºs caem entre duas datas (um por dezembro). */
const thirteenths = (from: CivilDate, to: CivilDate) => { let n = 0; for (let y = yearOf(from); y <= yearOf(to); y++) if (`${y}-12-20` >= from && `${y}-12-20` <= to) n++; return n; };
const monthsFrac = (from: CivilDate, to: CivilDate) => Math.max(0, (day(to) - day(from)) / 30);

export function plan(p: Profile, today: CivilDate, proj: Projection, t: Tables = OFFICIAL): Plan {
  const contribution = contributionFor(proj.salary, proj.rate, t, today.slice(0, 7));
  const s0 = stateOn(p, today);
  const checks0 = checkRules(p, s0);
  const eligibleNow = checks0.filter((c) => c.eligible).map((c) => ({ c, r: rmiFor(c.id, p, s0, t) })).sort((a, b) => (b.r.rmi ?? 0) - (a.r.rmi ?? 0));
  const bestNow = eligibleNow[0] ? { rule: eligibleNow[0].c.id, name: eligibleNow[0].c.name, rmi: eligibleNow[0].r.rmi, memo: eligibleNow[0].r.memo } : null;
  const le = lifeExpectancy(t, p.sex === "F" ? "mulheres" : "homens", s0.ageYears);
  const until = s0.ageYears + le.years;
  const deathDay = civil(day(p.birthDate) + Math.round(until * 365.25));
  // Projeção: contribui todo mês a partir de hoje; salários futuros em moeda de hoje.
  const projected: Profile = { ...p, salaries: [...p.salaries] };
  const fut = (to: CivilDate) => { const out: ScEntry[] = []; for (let m = today.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) out.push({ month: m, value: contribution.base, source: "projecao" }); return out; };
  const onlyAge = proj.rate === "5" || proj.rate === "11";
  const points: PlanPoint[] = [];
  const unreachable: RuleCheck[] = [];
  const pending = new Set(checks0.filter((c) => !c.eligible).map((c) => c.id));
  // Após hoje, com contribuição contínua, tempo, idade e carência só crescem (requisitos monótonos): busca em
  // passos de 30 dias e refina dia a dia dentro do último passo.
  const fast = fastState(p, today, onlyAge);
  const okAt = (id: RuleId, d: number) => { const st = fast(civil(d)); const c = checkRules(p, st).find((x) => x.id === id)!; return { st, c, ok: c.reachable && c.eligible }; };
  const firstDay = (id: RuleId) => {
    const start = day(today) + 1, end = day(today) + 365 * 30;
    let prev = start - 1;
    for (let d = start; d <= end; d += 30) { if (okAt(id, d).ok) { for (let x = prev + 1; x < d; x++) if (okAt(id, x).ok) return x; return d; } prev = d; }
    return okAt(id, end).ok ? end : null;
  };
  for (const c0 of checks0.filter((c) => pending.has(c.id) && !c.reachable)) { pending.delete(c0.id); unreachable.push(c0); }
  for (const id of [...pending]) {
    if (onlyAge && !AGE_ONLY.includes(id)) continue; // alíquota reduzida: só aposentadoria por idade (Lei 8.212, art. 21, §2º)
    const found = firstDay(id);
    if (found === null) continue;
    const on = civil(found);
    const { st, c } = okAt(id, found);
    pending.delete(id);
    projected.salaries = [...p.salaries.filter((x) => x.month < today.slice(0, 7)), ...fut(addMonths(on.slice(0, 7), -1))];
    const r = rmiFor(id, projected, st, t);
    const contribMonths = Math.max(0, Math.round(monthsFrac(today, on))) + thirteenths(today, on) * (proj.rate === "progressiva" ? 1 : 0);
    const contribTotal = r2(contribMonths * contribution.value);
    const lostTotal = bestNow?.rmi ? r2((monthsFrac(today, on) + thirteenths(today, on)) * bestNow.rmi) : 0;
    const gain = r.rmi != null && bestNow?.rmi ? r2(r.rmi - bestNow.rmi) : null;
    const benefitMonths = monthsFrac(on, deathDay) + thirteenths(on, deathDay);
    points.push({
      rule: id, name: c.name, date: on, rmi: r.rmi, memo: r.memo, requirements: c.requirements, source: c.source, ageAt: ageText(p.birthDate, on),
      contribMonths, contribTotal, lostTotal, gain, paybackMonths: gain && gain > 0 ? Math.ceil((lostTotal + contribTotal) / gain) : null, lifetimeValue: r.rmi != null ? r2(benefitMonths * r.rmi) : null,
    });
  }
  for (const id of pending) { const c = checks0.find((x) => x.id === id); if (c && !unreachable.includes(c)) unreachable.push({ ...c, note: c.note ?? "Não alcançada em 30 anos de projeção com as premissas informadas." }); }
  return {
    today, current: { checks: checks0, best: bestNow }, points: points.sort((a, b) => a.date.localeCompare(b.date)), unreachable,
    lifeExpectancy: { age: s0.ageYears, years: le.years, until: r2(until), table: le.year }, contribution, version: RMI_VERSION,
    assumptions: [
      `Contribuição mensal de ${brl(contribution.value)} (${contribution.note}) sobre ${brl(contribution.base)} a partir de ${br(today.slice(0, 7))}, sem interrupção.`,
      "Valores futuros em moeda de hoje (sem projetar inflação nem reajustes).",
      `Expectativa de vida pela tábua IBGE ${le.year} (${p.sex === "F" ? "mulheres" : "homens"}): ${le.years} anos aos ${s0.ageYears} → até ${r2(until)} anos.`,
      "Descarte de competências: cada competência retirada reduz 30 dias de tempo (simplificação).",
      "Regras aguardando validação jurídica; não substitui a simulação do Meu INSS nem a análise profissional.",
    ],
  };
}

// ---------- Outros benefícios ----------
export function otherBenefits(p: Profile, on: CivilDate, t: Tables = OFFICIAL, opts: { accidental?: boolean; dependents?: number } = {}) {
  const dibMonth = on.slice(0, 7);
  const { rows } = correctSalaries(p.salaries, dibMonth, t);
  const valid = rows.filter((r) => !r.excluded);
  if (!valid.length) return null;
  const sb = r2(valid.reduce((s, r) => s + r.corrected, 0) / valid.length);
  const last12 = valid.slice(-12), avg12 = r2(last12.reduce((s, r) => s + r.corrected, 0) / last12.length);
  const min = levelAt(t, "salarioMinimo", dibMonth) ?? 0, teto = ceilingAt(t, dibMonth)?.value ?? Infinity;
  const lim = (v: number) => r2(Math.min(teto, Math.max(min, v)));
  const st = stateOn(p, on);
  const permanent = lim(sb * (opts.accidental ? 1 : coefEc103(p.sex, st.tcDays)));
  const deps = Math.max(1, Math.min(5, opts.dependents ?? 1));
  return {
    sb,
    items: [
      { id: "temporaria", name: "Auxílio por incapacidade temporária", value: lim(Math.min(sb * 0.91, avg12)), memo: `91% do SB (${brl(r2(sb * 0.91))}) limitado à média dos 12 últimos salários (${brl(avg12)}).`, source: RMI_SOURCES.lei8213art61 },
      { id: "permanente", name: `Aposentadoria por incapacidade permanente${opts.accidental ? " (acidentária)" : ""}`, value: permanent, memo: opts.accidental ? "100% do SB (acidente do trabalho, doença profissional ou do trabalho)." : `${(coefEc103(p.sex, st.tcDays) * 100).toFixed(0)}% do SB (60% + 2% por ano acima de 15/20).`, source: RMI_SOURCES.ec103art26 },
      { id: "acidente", name: "Auxílio-acidente", value: r2(sb * 0.5), memo: "50% do salário de benefício (Lei 8.213, art. 86, §1º); pode ser inferior ao mínimo.", source: RMI_SOURCES.lei8213art86 },
      { id: "pensao", name: `Pensão por morte (${deps} dependente(s))`, value: lim(permanent * Math.min(1, 0.5 + 0.1 * deps)), memo: `Cota familiar ${Math.min(100, 50 + 10 * deps)}% da aposentadoria por incapacidade permanente (${brl(permanent)}).`, source: RMI_SOURCES.ec103art23 },
    ],
  };
}

/** Correção de atrasados entre parcelas devidas e a data do cálculo por índice oficial (memória por competência). */
export function arrears(t: Tables, monthly: number, fromMonth: string, toMonth: string, index: "inpc" | "ipcae" | "selic") {
  const lines: { month: string; due: number; factor: number; updated: number }[] = [];
  for (let m = fromMonth; m <= toMonth; m = addMonths(m, 1)) {
    const f = accumulate(t, index, addMonths(m, 1), toMonth);
    lines.push({ month: m, due: monthly, factor: f.factor, updated: r2(monthly * f.factor) });
  }
  return { lines, total: r2(lines.reduce((s, l) => s + l.updated, 0)) };
}
export { daysIncl };
