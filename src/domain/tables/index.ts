// Tabelas OFICIAIS versionadas no Git (geradas por scripts/tabelas-oficiais.mjs a partir do BCB, IBGE e INSS).
// Atualizações mensais chegam pelo banco (official_series) e se sobrepõem a este arquivo: o cálculo é reprodutível.
import base from "./official.json";

export type SeriesId = "inpc" | "ipca" | "ipcae" | "igpm" | "igpdi" | "selic" | "tr" | "taxaLegal" | "salarioMinimo" | "ipcr";
export interface Tables {
  generatedAt: string;
  series: Record<SeriesId, Record<string, number>>;
  ceiling: { from: string; value: number; act: string; verified: boolean }[];
  lifeTables: Record<"ambos_os_sexos" | "homens" | "mulheres", { year: number; validFrom: string; url: string; ex: Record<string, number> }>;
  sources: Record<string, { label: string; url: string; publisher: string; license: string; api?: string }>;
}
export const OFFICIAL = base as unknown as Tables;

/** Sobrepõe valores mais novos (vindos do banco) sem alterar o arquivo-base. */
export function withUpdates(t: Tables, rows: { series: string; month: string; value: number }[]): Tables {
  if (!rows.length) return t;
  const series = { ...t.series } as Tables["series"];
  for (const r of rows) if (r.series in series) series[r.series as SeriesId] = { ...series[r.series as SeriesId], [r.month]: Number(r.value) };
  return { ...t, series };
}

export const ym = (d: string) => d.slice(0, 7);
export const addMonths = (m: string, n: number) => { const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
export const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
export const lastMonth = (t: Tables, s: SeriesId) => Object.keys(t.series[s]).sort().at(-1) ?? "";

/** Valor vigente no mês (série de nível, ex.: salário mínimo). Antes do primeiro mês: null. */
export function levelAt(t: Tables, s: SeriesId, month: string): number | null {
  const keys = Object.keys(t.series[s]).filter((k) => k <= month).sort();
  return keys.length ? t.series[s][keys.at(-1)!] : null;
}
export function ceilingAt(t: Tables, month: string) {
  return [...t.ceiling].filter((c) => c.from <= month).sort((a, b) => a.from.localeCompare(b.from)).at(-1) ?? null;
}

/**
 * Fator acumulado de uma série de variação mensal (%) nos meses [from, to] INCLUSIVE.
 * Mês sem índice publicado: considerado 0% e devolvido em `missing` (aparece na memória do cálculo).
 */
export function accumulate(t: Tables, s: SeriesId, from: string, to: string) {
  let f = 1;
  const missing: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) {
    const v = t.series[s][m];
    if (v === undefined) missing.push(m); else f *= 1 + v / 100;
  }
  return { factor: f, missing };
}

/**
 * Índice legal de correção dos salários de contribuição em cada mês (Lei 8.213, art. 29-B e histórico):
 * IPC-r jul/1994–jun/1995 (Lei 8.880/1994); INPC jul/1995–abr/1996 (MP 1.053/1995); IGP-DI mai/1996–fev/2004
 * (MP 1.415/1996); INPC desde mar/2004 (Lei 10.887/2004).
 */
export function scIndexFor(month: string): SeriesId {
  if (month <= "1995-06") return "ipcr";
  if (month <= "1996-04") return "inpc";
  if (month <= "2004-02") return "igpdi";
  return "inpc";
}
/**
 * Fator de atualização do salário de contribuição da competência `comp` para benefício com início em `dibMonth`:
 * variação dos meses seguintes à competência até o mês anterior ao início (Decreto 3.048, art. 33).
 * Conferir com a portaria mensal de fatores do INSS.
 */
export function scFactor(t: Tables, comp: string, dibMonth: string) {
  let f = 1;
  const missing: string[] = [];
  for (let m = addMonths(comp, 1); m < dibMonth; m = addMonths(m, 1)) {
    const v = t.series[scIndexFor(m)][m];
    if (v === undefined) missing.push(m); else f *= 1 + v / 100;
  }
  return { factor: f, missing };
}

/** Expectativa de sobrevida (IBGE) por idade completa; acima de 90 usa a linha "90 ou mais". */
export function lifeExpectancy(t: Tables, table: keyof Tables["lifeTables"], age: number) {
  const lt = t.lifeTables[table];
  return { years: lt.ex[String(Math.min(90, Math.max(0, Math.floor(age))))], year: lt.year, validFrom: lt.validFrom };
}
