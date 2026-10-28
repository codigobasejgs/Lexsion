import { describe, expect, it } from "vitest";
import { alimony, amortization, CALC_MODELS, monetaryCorrection, parseIndexSeries, penalFine, severance, type CalcRun } from "@/domain/calc-engine";

// Vetores de referência calculados à mão (aritmética pura). Não validam regra jurídica: validam a conta.
const val = (r: CalcRun, label: string) => {
  if ("error" in r) throw new Error(r.error);
  return r.result.find((x) => x.label.startsWith(label))?.value.replace(/\s/g, " ");
};
const brl = (s: string) => s.replace(/\s/g, " ");

describe("central de cálculos (aritmética)", () => {
  it("Price: R$ 10.000 a 1% a.m. em 12 meses → parcela R$ 888,49 e saldo zerado", () => {
    const r = amortization({ valorFinanciado: "10.000,00", taxaContratada: "1", prazo: "12", sistema: "Price" });
    expect(val(r, "Parcela (Price)")).toBe(brl("R$ 888,49"));
    expect("memory" in r && brl(r.memory.at(-2)!)).toContain(brl("saldo R$ 0,00"));
  });
  it("SAC: R$ 1.200 a 1% em 12 → 1ª R$ 112,00, última R$ 101,00", () => {
    const r = amortization({ valorFinanciado: "1.200,00", taxaContratada: "1", prazo: "12", sistema: "SAC" });
    expect(val(r, "1ª parcela")).toBe(brl("R$ 112,00"));
    expect(val(r, "Última parcela")).toBe(brl("R$ 101,00"));
  });
  it("taxa zero divide sem juros", () => {
    expect(val(amortization({ valorFinanciado: "1.000,00", taxaContratada: "0", prazo: "4" }), "Total de juros")).toBe(brl("R$ 0,00"));
  });
  it("correção: R$ 1.000 com 1% e 2% → R$ 1.030,20; juros 1% × 2 = R$ 20,60; multa 2% = R$ 20,60", () => {
    const r = monetaryCorrection({ valorOriginal: "1.000,00", serie: "2025-01;1\n2025-02;2", jurosMes: "1", multa: "2" });
    expect(val(r, "Valor corrigido")).toBe(brl("R$ 1.030,20"));
    expect(val(r, "Juros")).toBe(brl("R$ 20,60"));
    expect(val(r, "Total atualizado")).toBe(brl("R$ 1.071,40"));
  });
  it("série com mês ausente, fora de ordem ou data impossível não calcula", () => {
    expect(parseIndexSeries("2025-01;1\n2025-03;1")).toMatch(/ausente/);
    expect(parseIndexSeries("2025-02;1\n2025-01;1")).toMatch(/ordem/);
    expect(parseIndexSeries("2025-13;1")).toMatch(/mês inválido/);
    expect(monetaryCorrection({ valorOriginal: "-5", serie: "2025-01;1" })).toHaveProperty("error");
  });
  it("rescisão: R$ 3.000, 15 dias, 2 anos, 6/12, FGTS R$ 10.000 → total R$ 12.600,00", () => {
    const r = severance({ salario: "3.000,00", diasTrabalhadosMes: "15", avos13: "6", avosFerias: "6", anosCompletos: "2", saldoFgts: "10.000,00" });
    expect(val(r, "Aviso prévio")).toBe(brl("R$ 3.600,00"));
    expect(val(r, "Total bruto")).toBe(brl("R$ 12.600,00"));
    expect(severance({ salario: "3.000,00", diasTrabalhadosMes: "40", avos13: "1", avosFerias: "1" })).toHaveProperty("error");
  });
  it("aviso prévio limitado a 90 dias", () => {
    expect(val(severance({ salario: "3.000,00", diasTrabalhadosMes: "0", avos13: "0", avosFerias: "0", anosCompletos: "30" }), "Aviso prévio indenizado (90 dias)")).toBe(brl("R$ 9.000,00"));
  });
  it("pensão: 30% de R$ 2.000 → R$ 600; 3 meses → R$ 1.800", () => {
    const r = alimony({ baseCalculo: "2.000,00", percentual: "30", mesesAtraso: "3" });
    expect(val(r, "Valor mensal")).toBe(brl("R$ 600,00"));
    expect(val(r, "Parcelas em atraso")).toBe(brl("R$ 1.800,00"));
  });
  it("dias-multa respeita limites de 10–360 e 1/30–5 SM", () => {
    expect(val(penalFine({ diasMulta: "10", fracaoSalario: "0,5", salarioMinimo: "1.518,00" }), "Multa total")).toBe(brl("R$ 7.590,00"));
    expect(penalFine({ diasMulta: "5", fracaoSalario: "0,5", salarioMinimo: "1.518,00" })).toHaveProperty("error");
    expect(penalFine({ diasMulta: "10", fracaoSalario: "0,01", salarioMinimo: "1.518,00" })).toHaveProperty("error");
  });
  it("nenhum modelo se declara VALIDADO; todos têm premissas", () => {
    expect(CALC_MODELS.every((m) => m.status !== "VALIDADO")).toBe(true);
    const r = CALC_MODELS[0].run!({ valorOriginal: "100", serie: "2025-01;1" });
    expect("assumptions" in r && r.assumptions.length).toBeGreaterThan(0);
  });
});
