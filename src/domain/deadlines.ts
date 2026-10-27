// Contagem DEMONSTRATIVA de prazos (M08, A08). Não é contagem judicial validada:
// regras de suspensão, intimação e calendários de cada tribunal exigem validação profissional.
import { addDays, type CivilDate } from "@/lib/dates";

export interface Holiday {
  date: CivilDate;
  name: string;
}

export interface CountDay {
  date: CivilDate;
  weekday: string;
  counted: boolean;
  n: number | null; // número do dia contado
  reason?: string; // por que não contou
}

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function weekday(d: CivilDate): number {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}

/**
 * Exclui o dia do início e inclui o do vencimento. Dias úteis pulam fim de semana, feriados e suspensões;
 * em dias corridos, vencimento em dia não útil prorroga para o próximo dia útil.
 */
export function countDeadline(start: CivilDate, days: number, counting: "uteis" | "corridos", holidays: Holiday[], suspensions: { from: CivilDate; to: CivilDate; name: string }[] = []): { end: CivilDate; memory: CountDay[] } {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Quantidade de dias inválida");
  const hol = new Map(holidays.map((h) => [h.date, h.name]));
  const nonBusiness = (d: CivilDate): string | undefined => {
    const w = weekday(d);
    if (w === 0 || w === 6) return "fim de semana";
    if (hol.has(d)) return `feriado: ${hol.get(d)}`;
    const s = suspensions.find((x) => d >= x.from && d <= x.to);
    return s ? `suspensão: ${s.name}` : undefined;
  };
  const memory: CountDay[] = [{ date: start, weekday: WD[weekday(start)], counted: false, n: null, reason: "dia do início (excluído)" }];
  let d = start;
  let n = 0;
  while (n < days) {
    d = addDays(d, 1);
    const why = counting === "uteis" ? nonBusiness(d) : undefined;
    if (why) memory.push({ date: d, weekday: WD[weekday(d)], counted: false, n: null, reason: why });
    else {
      n++;
      memory.push({ date: d, weekday: WD[weekday(d)], counted: true, n });
    }
  }
  // Prorrogação: vencimento em dia não útil (vale também para corridos).
  let why = nonBusiness(d);
  while (why) {
    const last = memory[memory.length - 1];
    if (last.counted && counting === "corridos") last.reason = `vencimento em dia não útil (${why}) — prorrogado`;
    d = addDays(d, 1);
    why = nonBusiness(d);
    memory.push({ date: d, weekday: WD[weekday(d)], counted: !why, n: why ? null : n, reason: why ?? "vencimento prorrogado" });
  }
  return { end: d, memory };
}

/** Número CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO com dígito verificador módulo 97 (Res. CNJ 65/2008). */
export function isValidCnj(input: string): boolean {
  const m = /^(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})$/.exec(input.trim());
  if (!m) return false;
  const [, n, dd, a, j, tr, o] = m;
  const base = BigInt(`${n}${a}${j}${tr}${o}00`);
  const check = BigInt(98) - (base % BigInt(97));
  return check === BigInt(dd);
}

export function formatCnj(input: string): string {
  const d = input.replace(/\D/g, "");
  if (d.length !== 20) return input;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}
