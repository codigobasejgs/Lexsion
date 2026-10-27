// Regras puras de baixa/estorno (M15, A10). Sem I/O — testáveis isoladamente.
import type { Installment, Payment } from "./types";
import type { Cents } from "@/lib/money";

export function balance(i: Installment): Cents {
  return i.amount - i.paid;
}

export function statusFor(amount: Cents, paid: Cents): Installment["status"] {
  if (paid <= 0) return "aberta";
  return paid >= amount ? "paga" : "parcial";
}

/** Recalcula `paid` de cada parcela a partir dos pagamentos (estornos são valores negativos). */
export function recompute(installments: Installment[], payments: Payment[]): Installment[] {
  return installments.map((i) => {
    if (i.status === "cancelada") return i;
    const paid = payments.filter((p) => p.installmentId === i.id).reduce((s, p) => s + p.amount, 0);
    return { ...i, paid, status: statusFor(i.amount, paid) };
  });
}

export type PaymentError = "valor_invalido" | "excede_saldo" | "parcela_inexistente" | "parcela_cancelada";

/** Valida e cria um pagamento. Mesma idempotencyKey retorna o pagamento existente (sem duplicar caixa). */
export function preparePayment(
  inst: Installment | undefined,
  existing: Payment[],
  input: Omit<Payment, "id" | "organizationId" | "reversalOf">,
  newId: string,
): { ok: true; payment: Payment; duplicate: boolean } | { ok: false; error: PaymentError } {
  const dup = existing.find((p) => p.idempotencyKey === input.idempotencyKey);
  if (dup) return { ok: true, payment: dup, duplicate: true };
  if (!inst) return { ok: false, error: "parcela_inexistente" };
  if (inst.status === "cancelada") return { ok: false, error: "parcela_cancelada" };
  if (!Number.isInteger(input.amount) || input.amount <= 0) return { ok: false, error: "valor_invalido" };
  if (input.amount > balance(inst)) return { ok: false, error: "excede_saldo" };
  return { ok: true, duplicate: false, payment: { ...input, id: newId, organizationId: inst.organizationId } };
}

/** Estorno = lançamento reverso auditável; nunca apaga o original. */
export function prepareReversal(original: Payment, existing: Payment[], newId: string, note: string, date: string): Payment | null {
  if (original.amount <= 0 || existing.some((p) => p.reversalOf === original.id)) return null;
  return {
    ...original,
    id: newId,
    amount: -original.amount,
    date,
    note,
    reversalOf: original.id,
    idempotencyKey: `reversal:${original.id}`,
  };
}
