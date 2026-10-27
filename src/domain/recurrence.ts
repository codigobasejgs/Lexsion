// Tarefas recorrentes e aniversariantes — regras puras em data CIVIL (AAAA-MM-DD), sem fuso.
import type { CivilDate } from "@/lib/dates";

export type Recurrence = { every: "semana" | "quinzena" | "mes" | "ano"; until?: CivilDate; paused?: boolean };
export const RECURRENCE_LABEL: Record<Recurrence["every"], string> = { semana: "Toda semana", quinzena: "A cada 15 dias", mes: "Todo mês", ano: "Todo ano" };

const pad = (n: number) => String(n).padStart(2, "0");
const parts = (d: CivilDate) => d.split("-").map(Number) as [number, number, number];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

function addDays(d: CivilDate, n: number): CivilDate {
  const [y, m, dd] = parts(d);
  const t = new Date(Date.UTC(y, m - 1, dd + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
/** Soma meses mantendo o dia; se o mês não tem esse dia (31 → fev), usa o último dia do mês. */
function addMonths(d: CivilDate, n: number, anchorDay: number): CivilDate {
  const [y, m] = parts(d);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12), nm = (idx % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(anchorDay, lastDay(ny, nm)))}`;
}

/**
 * Próxima ocorrência a partir do prazo atual. `anchorDay` preserva o dia original (31) ao passar por meses curtos.
 * Retorna null se pausada ou se passaria da data final.
 */
export function nextOccurrence(due: CivilDate, r: Recurrence, anchorDay = parts(due)[2]): CivilDate | null {
  if (r.paused) return null;
  const next = r.every === "semana" ? addDays(due, 7) : r.every === "quinzena" ? addDays(due, 14) : addMonths(due, r.every === "mes" ? 1 : 12, anchorDay);
  return r.until && next > r.until ? null : next;
}

/** Aniversários no intervalo [from, from+days], com idade e dias até a data. 29/02 vira 28/02 em ano não bissexto. */
export function upcomingBirthdays<T extends { birthDate?: CivilDate }>(people: T[], from: CivilDate, days: number): { person: T; date: CivilDate; age: number; inDays: number }[] {
  const [fy] = parts(from);
  const end = addDays(from, days);
  const out: { person: T; date: CivilDate; age: number; inDays: number }[] = [];
  for (const p of people) {
    if (!p.birthDate) continue;
    const [by, bm, bd] = parts(p.birthDate);
    for (const y of [fy, fy + 1]) {
      const day = bm === 2 && bd === 29 && lastDay(y, 2) === 28 ? 28 : bd;
      const date = `${y}-${pad(bm)}-${pad(day)}`;
      if (date >= from && date <= end) {
        const inDays = Math.round((Date.UTC(y, bm - 1, day) - Date.UTC(...(parts(from).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]))) / 86_400_000);
        out.push({ person: p, date, age: y - by, inDays });
        break;
      }
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}
