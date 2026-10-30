import "server-only";

// InfinitePay Checkout Integrado (documentação oficial: infinitepay.io/checkout-documentacao, lida em 30/10/2026).
// Fatos que guiam este arquivo:
//  * POST /links cria link avulso (sem sandbox; mínimo R$ 1,00). Sem recorrência nem estorno pela API.
//  * O webhook NÃO é assinado: cada aviso é só um gatilho; o pagamento vale depois de POST /payment_check
//    com handle + order_nsu + transaction_nsu + slug devolver paid: true.
//  * amount = valor cobrado; paid_amount pode ser MAIOR (juros do parcelamento repassados). Conferir amount.
//  * X-Api-Key (inchk_...) é opcional; com ela dá para expirar o link (valid_until) e torná-lo de uso único.
//    Fica SÓ no servidor (INFINITEPAY_API_KEY). Sem a chave, o link é criado só com a handle.
const API = "https://api.checkout.infinitepay.io";
export const HANDLE = (process.env.INFINITEPAY_HANDLE ?? "marco-boggian").replace(/^\$/, "");

export type CheckoutItem = { quantity: number; price: number; description: string };
export type PaymentCheck = { success: boolean; paid: boolean; amount?: number; paid_amount?: number; installments?: number; capture_method?: string };

async function post<T>(path: string, body: unknown): Promise<{ status: number; data: T | null }> {
  const key = process.env.INFINITEPAY_API_KEY;
  const r = await fetch(`${API}${path}`, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { "Content-Type": "application/json", ...(key ? { "X-Api-Key": key } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: (await r.json().catch(() => null)) as T | null };
}

/** Cria o link de pagamento. Valores vêm do pedido gravado no banco, nunca do navegador. */
export async function createCheckout(o: { orderNsu: string; items: CheckoutItem[]; redirectUrl: string; webhookUrl: string; customer?: { name?: string; email?: string; phone_number?: string }; validUntil?: string }) {
  const withKey = !!process.env.INFINITEPAY_API_KEY;
  const r = await post<{ url?: string }>("/links", {
    handle: HANDLE, order_nsu: o.orderNsu, items: o.items, redirect_url: o.redirectUrl,
    webhook: { url: o.webhookUrl, events: ["paid", "refunded", "canceled", "payment_failed"] },
    ...(o.customer ? { customer: o.customer } : {}),
    ...(withKey ? { options: { single_payment: true, ...(o.validUntil ? { valid_until: o.validUntil } : {}) } } : {}),
  });
  if (r.status !== 200 || !r.data?.url?.startsWith("https://checkout.infinitepay.io/")) throw new Error(`InfinitePay recusou a criação do link (HTTP ${r.status})`);
  return r.data.url;
}

/** Confirmação OFICIAL. Rede/erro do provedor ⇒ exceção (nunca vira "pago"). */
export async function paymentCheck(q: { orderNsu: string; transactionNsu: string; slug: string }): Promise<PaymentCheck> {
  const r = await post<PaymentCheck>("/payment_check", { handle: HANDLE, order_nsu: q.orderNsu, transaction_nsu: q.transactionNsu, slug: q.slug });
  if (r.status !== 200 || !r.data || typeof r.data.success !== "boolean") throw new Error(`payment_check indisponível (HTTP ${r.status})`);
  return r.data;
}

/**
 * Decide se o pagamento confirma o pedido. Puro (testável): exige success+paid, valor cobrado = valor do pedido
 * e transação ainda não usada por outro pedido. Recebedor: o próprio payment_check é por handle (conta LexSion).
 */
export function judgePayment(order: { amount: number; status: string; transaction_nsu: string | null }, check: PaymentCheck, tx: string, txUsedElsewhere: boolean):
  { ok: true } | { ok: false; reason: string } {
  if (!check.success || !check.paid) return { ok: false, reason: "pagamento não confirmado pelo provedor" };
  if (check.amount !== order.amount) return { ok: false, reason: `valor divergente (pedido ${order.amount}, provedor ${check.amount ?? "?"})` };
  if (txUsedElsewhere) return { ok: false, reason: "transação já usada em outro pedido" };
  if (order.transaction_nsu && order.transaction_nsu !== tx) return { ok: false, reason: "pedido já pago por outra transação" };
  if (order.status !== "pendente" && order.status !== "pago") return { ok: false, reason: `pedido ${order.status}` };
  return { ok: true };
}
