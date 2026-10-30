import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { judgePayment } = await import("@/lib/infinitepay");

// Regra de confirmação: só payment_check com paid:true, valor cobrado igual ao do pedido e transação inédita.
const order = { amount: 9990, status: "pendente", transaction_nsu: null };
const paid = { success: true, paid: true, amount: 9990, paid_amount: 10490, installments: 3, capture_method: "credit_card" };

describe("judgePayment (InfinitePay)", () => {
  it("confirma pagamento conferido; paid_amount maior (juros do parcelamento) não bloqueia", () => {
    expect(judgePayment(order, paid, "tx-1", false)).toEqual({ ok: true });
  });
  it("pendente/recusado não confirma", () => {
    expect(judgePayment(order, { success: true, paid: false }, "tx-1", false).ok).toBe(false);
    expect(judgePayment(order, { success: false, paid: false }, "tx-1", false).ok).toBe(false);
  });
  it("valor divergente não confirma (pedido de R$ 99,90 pago com R$ 1,00)", () => {
    expect(judgePayment(order, { ...paid, amount: 100 }, "tx-1", false)).toMatchObject({ ok: false, reason: expect.stringMatching(/valor divergente/) });
  });
  it("transação reaproveitada de outro pedido não confirma", () => {
    expect(judgePayment(order, paid, "tx-1", true)).toMatchObject({ ok: false, reason: expect.stringMatching(/outro pedido/) });
  });
  it("pedido já pago por outra transação ou estornado/expirado não confirma", () => {
    expect(judgePayment({ ...order, status: "pago", transaction_nsu: "tx-0" }, paid, "tx-1", false).ok).toBe(false);
    expect(judgePayment({ ...order, status: "estornado" }, paid, "tx-1", false).ok).toBe(false);
    expect(judgePayment({ ...order, status: "expirado" }, paid, "tx-1", false).ok).toBe(false);
  });
});
