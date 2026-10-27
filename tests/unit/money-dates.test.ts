import { describe, expect, it } from "vitest";
import { formatBRL, parseBRL, splitInstallments } from "@/lib/money";
import { addDays, civilFromInstant, diffDays, formatCivil, isCivilDate, parseCivilBR } from "@/lib/dates";

describe("money", () => {
  it("formata BRL", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
  });
  it.each([
    ["1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["1234.56", 123456],
    ["1234", 123400],
    ["0,5", 50],
    ["1.000", 100000],
    ["abc", null],
  ])("parseBRL(%s) = %s", (input, cents) => {
    expect(parseBRL(input)).toBe(cents);
  });
  it("parcelas somam o total e a última absorve o resto", () => {
    const parts = splitInstallments(100000, 3);
    expect(parts).toEqual([33333, 33333, 33334]);
    expect(parts.reduce((a, b) => a + b)).toBe(100000);
  });
  it("rejeita número de parcelas inválido", () => {
    expect(() => splitInstallments(100, 0)).toThrow();
  });
});

describe("datas civis", () => {
  it("valida e formata", () => {
    expect(isCivilDate("2026-02-29")).toBe(false);
    expect(isCivilDate("2028-02-29")).toBe(true);
    expect(formatCivil("2026-10-26")).toBe("26/10/2026");
    expect(parseCivilBR("31/12/2026")).toBe("2026-12-31");
    expect(parseCivilBR("31/02/2026")).toBeNull();
  });
  it("aritmética sem deslocamento UTC", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(diffDays("2026-10-26", "2026-11-05")).toBe(10);
  });
  it("instante perto da meia-noite UTC cai no dia correto em São Paulo", () => {
    expect(civilFromInstant("2026-10-27T01:30:00Z")).toBe("2026-10-26");
  });
});
