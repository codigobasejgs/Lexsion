// Fase 4: cálculos com índices oficiais. Casos sintéticos, conferidos à mão.
import { describe, expect, it } from "vitest";
import { alimonyArrears, dosimetry, fullSeverance, overtime, progression, updateDebt } from "@/domain/calc-official";
import { accumulate, OFFICIAL } from "@/domain/tables";
import { CALC_MODELS } from "@/domain/calc-engine";

const val = (r: ReturnType<typeof updateDebt>, label: string) => ("error" in r ? r.error : r.result.find((x) => x.label.startsWith(label))?.value);
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

describe("atualização de débito", () => {
  it("corrige pelo IPCA-E do mês seguinte ao vencimento até o cálculo", () => {
    const r = updateDebt({ valor: "1.000,00", vencimento: "01/2024", dataCalculo: "06/2024", indice: "IPCA-E" });
    const f = accumulate(OFFICIAL, "ipcae", "2024-02", "2024-06").factor;
    expect(val(r, "Valor corrigido")).toBe(brl(Math.round(100000 * f) / 100));
    expect(val(r, "Total atualizado")).toBe(brl(Math.round(100000 * f) / 100));
  });
  it("a partir do marco aplica só a Selic (sem somar índice)", () => {
    const r = updateDebt({ valor: "1.000,00", vencimento: "01/2024", dataCalculo: "06/2024", indice: "IPCA-E", marcoJuros: "04/2024", juros: "Selic a partir do marco" });
    const ip = accumulate(OFFICIAL, "ipcae", "2024-02", "2024-03").factor, se = accumulate(OFFICIAL, "selic", "2024-04", "2024-06").factor;
    expect(val(r, "Total atualizado")).toBe(brl(Math.round(Math.round(100000 * ip) * se) / 100));
  });
  it("valida entradas", () => {
    expect(updateDebt({ valor: "10", vencimento: "05/2024", dataCalculo: "01/2024" })).toHaveProperty("error");
  });
});

describe("rescisão completa", () => {
  it("dispensa sem justa causa: aviso de 36 dias com projeção, 1/3, multa 40% e INSS", () => {
    const r = fullSeverance({ salario: "3.000,00", admissao: "10/03/2024", desligamento: "15/10/2026", motivo: "Dispensa sem justa causa", saldoFgts: "6.000,00" });
    if ("error" in r) throw new Error(r.error);
    expect(r.result.find((x) => x.label.startsWith("Aviso"))?.label).toBe("Aviso prévio (36 dias)");
    expect(val(r, "Saldo de salário")).toBe(brl(1500));
    expect(val(r, "Multa FGTS")).toBe(brl(2400));
    expect(r.result.find((x) => x.label.startsWith("13º"))?.label).toBe("13º proporcional (11/12)"); // projeção até 20/11
  });
  it("justa causa: sem aviso, 13º e férias proporcionais", () => {
    const r = fullSeverance({ salario: "3.000,00", admissao: "10/03/2024", desligamento: "15/10/2026", motivo: "Justa causa" });
    if ("error" in r) throw new Error(r.error);
    expect(r.result.some((x) => x.label.startsWith("Aviso") || x.label.startsWith("Multa"))).toBe(false);
    expect(val(r, "13º")).toBe(brl(0));
  });
});

describe("horas extras", () => {
  it("valor-hora, DSR e reflexos", () => {
    const r = overtime({ salario: "2.200,00", horasMes: "10", adicional: "50", divisor: "220", meses: "1", diasUteis: "25", diasDescanso: "5" });
    expect(val(r, "Horas extras")).toBe(brl(150)); // 10 × 2200/220 × 1,5
    expect(val(r, "Reflexo em DSR")).toBe(brl(30)); // 150/25×5
  });
});

describe("penal", () => {
  it("dosimetria nas três fases, com limite da Súmula 231", () => {
    const r = dosimetry({ penaMin: "2 anos", penaMax: "8 anos", circunstanciasNegativas: "0", atenuantes: "1", aumento: "1/3" });
    if ("error" in r) throw new Error(r.error);
    expect(r.result[1].value).toBe("2 ano(s) e 0 mes(es)");
    expect(r.result[2].value).toBe("2 ano(s) e 8 mes(es)");
    expect(r.memory.join(" ")).toMatch(/Súmula 231/);
  });
  it("progressão: 25% de 120 meses com 30 dias remidos", () => {
    const r = progression({ penaMeses: "120", dataBase: "01/01/2026", diasRemidos: "30", perfil: "Primário, com violência ou grave ameaça" });
    if ("error" in r) throw new Error(r.error);
    expect(r.result[1].value).toBe("870");
    expect(r.result[2].value).toBe("20/05/2028");
  });
});

describe("pensão alimentícia em atraso", () => {
  it("usa o salário mínimo de cada mês e exclui meses pagos", () => {
    const r = alimonyArrears({ inicio: "01/2026", fim: "02/2026", dataCalculo: "02/2026", percentualSalarioMinimo: "30", indice: "INPC", mesesPagos: "02/2026" });
    if ("error" in r) throw new Error(r.error);
    expect(r.memory[0]).toMatch(/^01\/2026: R\$\s?486,30/); // 30% de R$ 1.621,00
  });
});

it("catálogo registra os novos modelos com status de validação", () => {
  for (const n of ["Atualização de débito judicial (índices oficiais)", "Rescisão completa (CLT)", "Horas extras com reflexos", "Dosimetria da pena (art. 68 do CP)", "Progressão de regime (art. 112 da LEP)", "Pensão alimentícia em atraso (índice oficial)"]) {
    expect(CALC_MODELS.find((m) => m.name === n)?.status, n).toBe("AGUARDA_REVISAO_JURIDICA");
  }
});
