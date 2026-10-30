import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { judgePayment, paymentCheck } from "@/lib/infinitepay";
import { opsAlert } from "@/lib/ops-alert";

// Ciclo comercial no servidor. Toda confirmação passa por confirmOrder: consulta o /payment_check oficial,
// confere valor/pedido/transação e só então marca "pago" e ativa (ou renova). Idempotente: aviso repetido,
// retorno do navegador e cron podem chamar ao mesmo tempo sem duplicar escritório, assinatura ou período.
export const SITE = process.env.SITE_URL ?? "https://lexsion.com.br";
type Order = {
  id: string; order_nsu: string; kind: "contratacao" | "renovacao"; organization_id: string | null; plan_id: string; cycle: string; amount: number;
  customer: { name: string; email: string; office: string; slug: string; phone?: string; document?: string }; status: string; transaction_nsu: string | null;
  activation: string; activation_attempts: number; paid_at: string | null;
};
const note = (text: string) => ({ at: new Date().toISOString(), text });

async function load(orderNsu: string): Promise<Order | null> {
  const { data } = await supabaseAdmin().from("saas_orders").select("*").eq("order_nsu", orderNsu).maybeSingle();
  return data as Order | null;
}
async function log(o: Order, text: string, patch: Record<string, unknown> = {}) {
  const db = supabaseAdmin();
  const { data } = await db.from("saas_orders").select("history").eq("id", o.id).single();
  await db.from("saas_orders").update({ ...patch, history: [...((data?.history as unknown[]) ?? []), note(text)], updated_at: new Date().toISOString() }).eq("id", o.id);
}

/** Confere no provedor e aplica. Retorna o estado final do pedido (sem dado sensível). */
export async function confirmOrder(orderNsu: string, transactionNsu: string, slug: string, via: string, extra: { receipt_url?: string; capture_method?: string } = {}) {
  const o = await load(orderNsu);
  if (!o) return { ok: false as const, reason: "pedido inexistente" };
  if (o.status === "pago" && o.transaction_nsu === transactionNsu) { await activate(o.order_nsu); return { ok: true as const, status: "pago", already: true }; }
  const check = await paymentCheck({ orderNsu, transactionNsu, slug }); // falha de rede ⇒ exceção: nada é marcado
  const { count } = await supabaseAdmin().from("saas_orders").select("id", { count: "exact", head: true }).eq("transaction_nsu", transactionNsu).neq("id", o.id);
  const verdict = judgePayment(o, check, transactionNsu, !!count);
  if (!verdict.ok) {
    await log(o, `Aviso (${via}) não confirmado: ${verdict.reason}`);
    if (check.paid && check.amount !== o.amount) await opsAlert("Pagamento com valor divergente", `Pedido ${o.order_nsu}: ${verdict.reason}. Nada foi liberado; conferir na conta InfinitePay.`).catch(() => false);
    return { ok: false as const, reason: verdict.reason };
  }
  // Marca pago só se ainda pendente (condição no UPDATE: duas chamadas simultâneas, uma vence).
  const { data: won } = await supabaseAdmin().from("saas_orders").update({
    status: "pago", transaction_nsu: transactionNsu, invoice_slug: slug, paid_amount: check.paid_amount ?? null, installments: check.installments ?? null,
    capture_method: check.capture_method ?? extra.capture_method ?? null, receipt_url: extra.receipt_url ?? null, paid_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", o.id).eq("status", "pendente").select("id");
  if (won?.length) {
    await log(o, `Pagamento confirmado no payment_check (${via}): ${check.capture_method ?? "?"}, ${check.installments ?? 1}x`);
    await supabaseAdmin().from("audit_logs").insert({ organization_id: o.organization_id, actor_id: null, action: "pagamento.confirmado", entity: "saas_orders", entity_id: o.order_nsu, detail: `${o.amount} centavos via ${check.capture_method ?? "?"}` });
  }
  await activate(o.order_nsu);
  return { ok: true as const, status: "pago" };
}

/** Ativa (contratação) ou renova. Falha parcial fica registrada e é retentada pelo cron/Super Admin; o pagamento nunca é perdido. */
export async function activate(orderNsu: string) {
  const db = supabaseAdmin();
  const o = await load(orderNsu);
  if (!o || (o.status !== "pago" && o.status !== "teste") || o.activation === "concluida") return o?.activation ?? null;
  try {
    if (o.kind === "renovacao") {
      const { error } = await db.rpc("saas_apply_renewal", { p_order: o.id });
      if (error) throw new Error(error.message);
      return "concluida";
    }
    // Conta do titular: convite do Auth (o link define a senha). Conta existente é reaproveitada.
    const email = o.customer.email.toLowerCase();
    let ownerId: string | undefined;
    const { data: inv, error: invErr } = await db.auth.admin.inviteUserByEmail(email, { data: { full_name: o.customer.name }, redirectTo: `${SITE}/redefinir-senha` });
    ownerId = inv?.user?.id;
    if (invErr) {
      if (!/already|registered|exists/i.test(invErr.message)) throw new Error("convite do titular não enviado");
      const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      ownerId = list?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    }
    if (!ownerId) throw new Error("conta do titular não localizada");
    await db.from("profiles").upsert({ user_id: ownerId, full_name: o.customer.name }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: org, error } = await db.rpc("saas_activate", { p_order: o.id, p_owner: ownerId });
    if (error) throw new Error(error.message);
    // Contrato aceito que originou o pedido: passa a pertencer ao escritório (titular lê em Minha assinatura).
    await db.from("saas_contracts").update({ organization_id: org, status: "ACTIVE", updated_at: new Date().toISOString() }).eq("order_id", o.id);
    await welcome(o, !invErr).catch(() => false);
    return "concluida";
  } catch (e) {
    const msg = (e as Error).message.slice(0, 200);
    await db.from("saas_orders").update({ activation: "falhou", activation_error: msg, activation_attempts: o.activation_attempts + 1, updated_at: new Date().toISOString() }).eq("id", o.id);
    await opsAlert(o.status === "teste" ? "Teste grátis sem ativação" : "Pagamento confirmado sem ativação", `Pedido ${o.order_nsu} (${o.status}) não foi ativado: ${msg}. Nova tentativa automática diária; ou reprocesse no Super Admin.${o.status === "pago" ? " Não cobre de novo." : ""}`).catch(() => false);
    return "falhou";
  }
}

/** E-mail de boas-vindas (Resend). Sem link de acesso no texto se a conta já existia: entra com a senha atual. */
async function welcome(o: Order, invited: boolean) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      from: "LexSion <nao-responda@lexsion.com.br>", to: [o.customer.email], subject: `Bem-vindo(a) à LexSion — ${o.customer.office}`,
      text: `Olá, ${o.customer.name}.\n\n${o.status === "teste" ? `O escritório ${o.customer.office} foi criado na LexSion em teste grátis. Nada foi cobrado; antes do fim do teste você recebe por e-mail o link da primeira mensalidade.` : `O pagamento foi confirmado e o escritório ${o.customer.office} está ativo na LexSion.`}\n\n${invited ? "Você receberá (ou já recebeu) um e-mail separado para criar sua senha de acesso." : "Use o e-mail e a senha que você já tem."}\nEntrar: ${SITE}/entrar\n\nNo primeiro acesso, o guia de boas-vindas mostra os próximos passos (marca, equipe, aplicativo e primeiro cliente).\n\nPedido: ${o.order_nsu}\n(Mensagem automática; não responda.)`,
    }),
  }).catch(() => null);
  await supabaseAdmin().from("audit_logs").insert({ organization_id: null, actor_id: null, action: "email.boas_vindas", entity: "saas_orders", entity_id: o.order_nsu, detail: r?.ok ? "aceito pelo Resend" : `falhou (HTTP ${r?.status ?? "rede"})` });
  return !!r?.ok;
}

/** Marca estorno/cancelamento informado pelo provedor. Só registra: estorno se confirma no painel InfinitePay (sem API de consulta). */
export async function flagReversal(orderNsu: string, event: string) {
  const o = await load(orderNsu);
  if (!o) return;
  await log(o, `Aviso do provedor: ${event}. Conferir na conta InfinitePay e, se confirmado, marcar no Super Admin.`);
  await opsAlert(`InfinitePay: ${event}`, `Pedido ${o.order_nsu} recebeu aviso "${event}". O webhook não é assinado: confirme na conta InfinitePay e registre no Super Admin.`).catch(() => false);
}
