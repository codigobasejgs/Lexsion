import { describe, expect, it } from "vitest";
import { preparePayment, prepareReversal, recompute } from "@/domain/finance";
import type { Installment, Payment } from "@/domain/types";

const inst: Installment = {
  id: "i1", organizationId: "o", contractId: "c", clientId: "x", label: "Parcela 1", amount: 40000, paid: 0, due: "2026-10-20", status: "aberta",
};
const base = { installmentId: "i1", amount: 15000, date: "2026-10-26", method: "pix" as const, source: "manual" as const, note: "baixa parcial", idempotencyKey: "k1" };

describe("baixa e estorno", () => {
  it("baixa parcial atualiza saldo e status", () => {
    const r = preparePayment(inst, [], base, "p1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [i] = recompute([inst], [r.payment]);
    expect(i.paid).toBe(15000);
    expect(i.status).toBe("parcial");
  });

  it("evento duplicado (mesma chave) não duplica caixa", () => {
    const first = preparePayment(inst, [], base, "p1");
    if (!first.ok) throw new Error();
    const again = preparePayment({ ...inst, paid: 15000 }, [first.payment], base, "p2");
    expect(again.ok && again.duplicate).toBe(true);
    const [i] = recompute([inst], [first.payment]);
    expect(i.paid).toBe(15000);
  });

  it("não aceita valor acima do saldo nem zero", () => {
    expect(preparePayment(inst, [], { ...base, amount: 40001 }, "p").ok).toBe(false);
    expect(preparePayment(inst, [], { ...base, amount: 0 }, "p").ok).toBe(false);
  });

  it("estorno cria lançamento reverso único e reconcilia", () => {
    const p: Payment = { ...base, id: "p1", organizationId: "o" };
    const rev = prepareReversal(p, [p], "r1", "estorno", "2026-10-27");
    expect(rev?.amount).toBe(-15000);
    expect(prepareReversal(p, [p, rev!], "r2", "de novo", "2026-10-27")).toBeNull();
    const [i] = recompute([inst], [p, rev!]);
    expect(i.paid).toBe(0);
    expect(i.status).toBe("aberta");
  });
});
