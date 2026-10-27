import { describe, expect, it } from "vitest";
import { countDeadline, isValidCnj } from "@/domain/deadlines";
import { applyChargeEvent, applySignature, brlInWords, buildSchedule, installmentsFromContract, scheduleTotal } from "@/domain/commercial";
import { csvCell, parseCsv, parseSheetDate, toCsv } from "@/domain/csv";
import { fillTemplate, pct, textHash } from "@/domain/metrics";
import type { Charge, Contract } from "@/domain/types";

describe("prazos (demonstrativo)", () => {
  it("dias úteis pulam fim de semana e feriado; memória registra o motivo", () => {
    // 2026-10-30 é sexta; 02/11 feriado (Finados)
    const r = countDeadline("2026-10-29", 3, "uteis", [{ date: "2026-11-02", name: "Finados" }]);
    expect(r.end).toBe("2026-11-04");
    expect(r.memory.filter((d) => d.counted).map((d) => d.date)).toEqual(["2026-10-30", "2026-11-03", "2026-11-04"]);
    expect(r.memory.find((d) => d.date === "2026-11-02")?.reason).toBe("feriado: Finados");
  });
  it("corridos contam tudo, mas vencimento em fim de semana prorroga", () => {
    const r = countDeadline("2026-10-26", 5, "corridos", []); // 31/10 é sábado
    expect(r.end).toBe("2026-11-02");
  });
  it("calendário diferente gera resultado diferente (versão importa)", () => {
    const a = countDeadline("2026-11-13", 2, "uteis", []).end;
    const b = countDeadline("2026-11-13", 2, "uteis", [{ date: "2026-11-16", name: "Ponto facultativo" }]).end;
    expect(a).not.toBe(b);
  });
});

describe("CNJ", () => {
  it("valida dígito verificador", () => {
    expect(isValidCnj("0001234-56.2026.4.01.3300")).toBe(false);
    // gera um válido: dígito = 98 - (N A J TR O 00 mod 97)
    const base = BigInt("0001234" + "2026" + "4" + "01" + "3300" + "00");
    const dd = String(BigInt(98) - (base % BigInt(97))).padStart(2, "0");
    expect(isValidCnj(`0001234-${dd}.2026.4.01.3300`)).toBe(true);
  });
});

describe("cronograma e contrato", () => {
  it("entrada + parcelas somam o total, última absorve resto", () => {
    const s = buildSchedule(100000, 20000, 3, "2026-11-01", 30);
    expect(scheduleTotal(s)).toBe(100000);
    expect(s.map((x) => x.amount)).toEqual([20000, 26666, 26666, 26668]);
    expect(s.map((x) => x.due)).toEqual(["2026-11-01", "2026-12-01", "2026-12-31", "2027-01-30"]);
  });

  const contract: Contract = {
    id: "c1", organizationId: "o", clientId: "x", title: "t", total: 1000, status: "enviado",
    snapshot: { clientName: "X", document: "d", service: "s", feeText: "f", schedule: [{ label: "Única", amount: 1000, due: "2026-11-01" }] },
    signers: [
      { id: "s1", name: "Cliente", role: "contratante", required: true, order: 1, status: "pendente" },
      { id: "s2", name: "Advogada", role: "contratada", required: true, order: 2, status: "pendente" },
      { id: "s3", name: "Testemunha", role: "testemunha", required: false, order: 3, status: "pendente" },
    ],
  };

  it("conclui só com todos os obrigatórios; evento repetido não muda; parcelas geradas uma vez (A09)", () => {
    const a = applySignature(contract, "s1", "t1", "u");
    expect(a.contract.status).toBe("parcial");
    expect(applySignature(a.contract, "s1", "t2", "u").contract).toBe(a.contract);
    const b = applySignature(a.contract, "s2", "t3", "u");
    expect(b.completedNow).toBe(true);
    expect(b.contract.status).toBe("concluido");
    const inst = installmentsFromContract(b.contract, (i) => `i${i}`);
    expect(inst).toHaveLength(1);
    expect(installmentsFromContract({ ...b.contract, installmentsGenerated: true }, (i) => `i${i}`)).toHaveLength(0);
  });
});

describe("cobrança", () => {
  const c: Charge = { id: "ch", organizationId: "o", installmentId: "i", provider: "asaas", method: "pix", amount: 100, due: "2026-11-01", status: "pendente", idempotencyKey: "k", events: [] };
  it("confirmação duplicada não reaplica; transição inválida é registrada e ignorada", () => {
    const a = applyChargeEvent(c, { id: "e1", at: "t", type: "PAYMENT_CONFIRMED", to: "paga", note: "" });
    expect(a.applied).toBe(true);
    const b = applyChargeEvent(a.charge, { id: "e1", at: "t", type: "PAYMENT_CONFIRMED", to: "paga", note: "" });
    expect(b.applied).toBe(false);
    const x = applyChargeEvent(a.charge, { id: "e2", at: "t", type: "X", to: "pendente", note: "" });
    expect(x.applied).toBe(false);
    expect(x.charge.status).toBe("paga");
  });
});

describe("recibo por extenso", () => {
  it.each([
    [100, "um real"],
    [150000, "mil e quinhentos reais"],
    [123456, "mil, duzentos e trinta e quatro reais e cinquenta e seis centavos"],
    [40000, "quatrocentos reais"],
    [5, "cinco centavos"],
  ])("%i", (cents, text) => expect(brlInWords(cents)).toBe(text));
});

describe("CSV", () => {
  it("lê ponto e vírgula com aspas e ignora linhas vazias", () => {
    expect(parseCsv('nome;obs\n"Silva; João";"diz ""oi"""\n\n')).toEqual([["nome", "obs"], ["Silva; João", 'diz "oi"']]);
  });
  it("neutraliza fórmulas na exportação", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+55 71")).toBe("'+55 71");
    expect(toCsv(["a"], [["@x"]])).toContain("'@x");
  });
  it("datas de planilha: serial, BR, placeholders e ano 1900", () => {
    expect(parseSheetDate("46321").date).toBe("2026-10-26");
    expect(parseSheetDate("5/3/2024").date).toBe("2024-03-05");
    expect(parseSheetDate("nd").issue).toMatch(/marcador/);
    expect(parseSheetDate("01/01/1900").issue).toMatch(/artificial/);
  });
});

describe("métricas e modelos", () => {
  it("divisão por zero é não calculável", () => {
    expect(pct(3, 0)).toBe("não calculável");
    expect(pct(1, 4)).toBe("25%");
  });
  it("hash ignora espaços, muda com conteúdo", () => {
    expect(textHash("a  b")).toBe(textHash("a b"));
    expect(textHash("a b")).not.toBe(textHash("a c"));
  });
  it("modelo aponta variáveis não preenchidas", () => {
    expect(fillTemplate("Olá {{nome}}, CPF {{cpf}}", { nome: "Ana" })).toEqual({ text: "Olá Ana, CPF [cpf — não preenchido]", missing: ["cpf"] });
  });
});
