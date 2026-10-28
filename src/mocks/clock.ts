// Relógio injetável: data fixa na demonstração; data REAL (America/Sao_Paulo) na operação (switchToRealClock).
import type { CivilDate } from "@/lib/dates";

// `let` exportado = ligação viva: quem importou DEMO_TODAY passa a ver a data real depois de switchToRealClock().
export let DEMO_TODAY: CivilDate = "2026-10-26";
export function switchToRealClock() {
  DEMO_TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
export function switchToDemoClock() {
  DEMO_TODAY = "2026-10-26";
}
export const DEMO_NOW = "2026-10-26T12:00:00-03:00";

/** Instante ISO relativo ao "agora" da demo, para montar fixtures. */
export function at(dayOffset: number, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(Date.UTC(2026, 9, 26 + dayOffset, h + 3, m)); // -03:00 → UTC
  return d.toISOString();
}
