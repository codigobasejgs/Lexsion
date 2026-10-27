// Datas civis (vencimentos, prazos) são strings "YYYY-MM-DD" — nunca passam por UTC.
// Instantes (eventos) são ISO com fuso; exibidos em America/Sao_Paulo.
export type CivilDate = string;
export const TIME_ZONE = "America/Sao_Paulo";

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCivilDate(s: string): s is CivilDate {
  const m = CIVIL_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function formatCivil(d: CivilDate): string {
  const m = CIVIL_RE.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

/** Converte "dd/MM/yyyy" digitado pelo usuário. */
export function parseCivilBR(s: string): CivilDate | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isCivilDate(iso) ? iso : null;
}

export function addDays(d: CivilDate, days: number): CivilDate {
  const [y, mo, da] = d.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, da + days)).toISOString().slice(0, 10);
}

/** Diferença em dias civis (b − a). */
export function diffDays(a: CivilDate, b: CivilDate): number {
  const t = (s: CivilDate) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Data civil de um instante, no fuso de São Paulo. */
export function civilFromInstant(iso: string): CivilDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso));
}

export function formatInstant(iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" }): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, ...opts }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return formatInstant(iso, { hour: "2-digit", minute: "2-digit" });
}

export function formatCivilLong(d: CivilDate): string {
  // Meio-dia UTC evita virar o dia em qualquer fuso brasileiro.
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d}T12:00:00Z`));
}
