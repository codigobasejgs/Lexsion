// Relógio injetável e fixo da demo (seção 8): filtros relativos e vencimentos usam esta data.
import type { CivilDate } from "@/lib/dates";

export const DEMO_TODAY: CivilDate = "2026-10-26";
export const DEMO_NOW = "2026-10-26T12:00:00-03:00";

/** Instante ISO relativo ao "agora" da demo, para montar fixtures. */
export function at(dayOffset: number, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(2026, 9, 26 + dayOffset, h + 3, m)); // -03:00 → UTC
  return d.toISOString();
}
