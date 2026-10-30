"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Badge, LoadingBlock } from "@/components/ui";
import { formatBRL, parseBRL } from "@/lib/money";
import { formatInstant } from "@/lib/dates";
import type { PublicPlan } from "@/domain/saas";

// Super Admin em operação REAL: planos (banco), pedidos, assinaturas e avisos da InfinitePay. Leitura pela RLS
// (só plataforma com MFA); alterações pela rota /api/admin/comercial, que audita e reconfere a plataforma.
type Order = { order_nsu: string; kind: string; plan_id: string; cycle: string; amount: number; status: string; activation: string; activation_error: string | null; customer: { office?: string; email?: string }; created_at: string; paid_at: string | null; capture_method: string | null; period_end: string | null };
type Sub = { organization_id: string; plan_id: string; cycle: string; status: string; price: number; current_period_end: string; cancel_at_period_end: boolean; change_request: { plan?: string } | null };
const call = async (body: unknown) => (await fetch("/api/admin/comercial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null)) as { ok: boolean; error?: { message: string }; data?: { activation?: string; reason?: string } } | null;
const ORDER_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { pago: "success", pendente: "warning", estornado: "danger", cancelado: "neutral", expirado: "neutral" };

export function CommercialPlans() {
  const q = useQuery({ queryKey: ["saas-plans"], queryFn: async () => ((await supabaseBrowser().from("saas_plans").select("*").order("sort")).data ?? []) as PublicPlan[] });
  if (q.isPending) return <LoadingBlock rows={3} />;
  return (
    <div className="space-y-3">
      <p className="rounded-[var(--radius-panel)] border border-warning/30 bg-warning-bg p-3 text-sm text-warning">Preço só aparece no site e só pode ser contratado com <strong>“Preço aprovado”</strong> marcado. A contratação online também depende da liberação no servidor (<code>SAAS_CHECKOUT_ENABLED</code>). Mudar preço cria nova versão; quem já contratou mantém o valor contratado.</p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">{q.data!.map((p) => <PlanEditor key={`${p.id}-${p.version}`} plan={p} />)}</div>
    </div>
  );
}

function PlanEditor({ plan }: { plan: PublicPlan }) {
  const qc = useQueryClient();
  const brl = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  const [f, setF] = useState({ label: plan.label, description: plan.description, monthly: brl(plan.price_monthly), yearly: brl(plan.price_yearly), users: String(plan.max_users), trial: String(plan.trial_days), visible: plan.visible !== false, approved: plan.approved, features: plan.features });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    const m = parseBRL(f.monthly), y = f.yearly.trim() ? parseBRL(f.yearly) : null;
    if (m === null || (f.yearly.trim() && y === null)) return setMsg({ ok: false, text: "Preço inválido. Use o formato 99,90." });
    const r = await call({ action: "plan.save", plan: { id: plan.id, label: f.label, description: f.description, price_monthly: m, price_yearly: y, max_users: Number(f.users), trial_days: Number(f.trial), visible: f.visible, approved: f.approved, features: f.features } });
    setMsg(r?.ok ? { ok: true, text: "Plano salvo e auditado." } : { ok: false, text: r?.error?.message ?? "Sem conexão." });
    if (r?.ok) await qc.invalidateQueries({ queryKey: ["saas-plans"] });
  };
  return (
    <section className="panel space-y-3 p-4 text-sm" aria-labelledby={`sp-${plan.id}`} data-testid={`plano-admin-${plan.id}`}>
      <div className="flex items-center justify-between gap-2"><h3 id={`sp-${plan.id}`} className="text-base font-semibold">{plan.label}</h3><Badge tone={plan.approved ? "success" : "warning"}>{plan.approved ? "aprovado" : "não aprovado"}</Badge></div>
      <label className="block"><span className="label">Nome</span><input className="field" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></label>
      <label className="block"><span className="label">Descrição</span><input className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Mensal (R$)</span><input className="field num" inputMode="decimal" value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} /></label>
        <label className="block"><span className="label">Anual (R$, vazio = não oferece)</span><input className="field num" inputMode="decimal" value={f.yearly} onChange={(e) => setF({ ...f, yearly: e.target.value })} /></label>
        <label className="block"><span className="label">Usuários</span><input className="field num" inputMode="numeric" value={f.users} onChange={(e) => setF({ ...f, users: e.target.value })} /></label>
        <label className="block"><span className="label">Teste grátis (dias)</span><input className="field num" inputMode="numeric" value={f.trial} onChange={(e) => setF({ ...f, trial: e.target.value })} /></label>
      </div>
      <fieldset><legend className="label">Recursos exibidos (desmarcado = “em breve”)</legend>
        <ul className="space-y-1">{f.features.map((x, i) => <li key={x.label}><label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={x.ok} onChange={(e) => setF({ ...f, features: f.features.map((y, j) => (j === i ? { ...y, ok: e.target.checked } : y)) })} />{x.label}</label></li>)}</ul>
      </fieldset>
      <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} /> Visível no site</label>
      <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={f.approved} onChange={(e) => setF({ ...f, approved: e.target.checked })} /> Preço aprovado pelo proprietário</label>
      <p className="text-xs text-fg-muted">Versão {plan.version}</p>
      <div className="flex flex-wrap items-center gap-3"><button className="btn btn-secondary" onClick={save}>Salvar plano</button>{msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</span>}</div>
    </section>
  );
}

export function CommercialOrders() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["saas-orders"], refetchInterval: 60_000,
    queryFn: async () => {
      const sb = supabaseBrowser();
      const [o, s] = await Promise.all([sb.from("saas_orders").select("order_nsu,kind,plan_id,cycle,amount,status,activation,activation_error,customer,created_at,paid_at,capture_method,period_end").order("created_at", { ascending: false }).limit(100), sb.from("saas_subscriptions").select("*")]);
      return { orders: (o.data ?? []) as Order[], subs: (s.data ?? []) as Sub[] };
    },
  });
  const [msg, setMsg] = useState<string | null>(null);
  if (q.isPending) return <LoadingBlock rows={3} />;
  const { orders, subs } = q.data!;
  const paid = orders.filter((o) => o.status === "pago");
  const mrr = subs.filter((s) => s.status === "ativa").reduce((t, s) => t + (s.cycle === "anual" ? Math.round(s.price / 12) : s.price), 0);
  const act = async (body: Record<string, unknown>) => { const r = await call(body); setMsg(r?.ok ? "Feito e auditado." : r?.error?.message ?? r?.data?.reason ?? "Não concluído."); await qc.invalidateQueries({ queryKey: ["saas-orders"] }); };
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Indicadores comerciais reais">
        {[["Assinaturas ativas", String(subs.filter((s) => s.status === "ativa").length)], ["Receita mensal (MRR)", formatBRL(mrr)], ["Recebido (pedidos pagos)", formatBRL(paid.reduce((t, o) => t + o.amount, 0))], ["Pagos sem ativação", String(paid.filter((o) => o.activation !== "concluida").length)]].map(([k, v]) =>
          <div key={k} className="panel p-3"><dt className="text-xs text-fg-muted">{k}</dt><dd className="num text-lg font-semibold">{v}</dd></div>)}
      </dl>
      {msg && <p role="status" className="text-fg-muted">{msg}</p>}
      <div className="overflow-x-auto" tabIndex={0} aria-label="Pedidos (role horizontalmente)">
        <table className="w-full min-w-[760px]" data-testid="pedidos"><caption className="sr-only">Pedidos de contratação e renovação</caption>
          <thead><tr className="text-left text-xs text-fg-muted"><th className="py-1">Pedido</th><th>Escritório</th><th>Plano</th><th>Valor</th><th>Situação</th><th>Ativação</th><th>Ações</th></tr></thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={7} className="py-3 text-fg-muted">Nenhum pedido real ainda.</td></tr>}
            {orders.map((o) => (
              <tr key={o.order_nsu} className="border-t border-line align-top">
                <td className="py-1.5"><code className="text-xs">{o.order_nsu.slice(0, 14)}…</code><br /><span className="text-xs text-fg-muted">{o.kind} · {formatInstant(o.created_at)}</span></td>
                <td>{o.customer.office ?? "—"}<br /><span className="text-xs text-fg-muted">{o.customer.email}</span></td>
                <td>{o.plan_id}/{o.cycle}</td>
                <td className="num">{formatBRL(o.amount)}{o.capture_method ? <span className="block text-xs text-fg-muted">{o.capture_method}</span> : null}</td>
                <td><Badge tone={ORDER_TONE[o.status] ?? "neutral"}>{o.status}</Badge></td>
                <td>{o.activation}{o.activation_error ? <span className="block text-xs text-danger">{o.activation_error}</span> : null}</td>
                <td className="space-y-1">
                  {o.status === "pago" && o.activation !== "concluida" && <button className="btn btn-secondary min-h-9" onClick={() => void act({ action: "order.reactivate", order: o.order_nsu })}>Reprocessar ativação</button>}
                  {o.status === "pendente" && <button className="btn btn-ghost min-h-9" onClick={() => { const tx = prompt("transaction_nsu da venda (painel InfinitePay):"); const slug = tx && prompt("slug da fatura:"); if (tx && slug) void act({ action: "order.check", order: o.order_nsu, transaction_nsu: tx, slug }); }}>Conferir pagamento</button>}
                  {o.status === "pago" && <button className="btn btn-ghost min-h-9 text-danger" onClick={() => { const reason = prompt("Estorno conferido na conta InfinitePay. Motivo:"); if (reason) void act({ action: "order.refund", order: o.order_nsu, reason }); }}>Registrar estorno</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {subs.some((s) => s.change_request || s.cancel_at_period_end) && (
        <section aria-labelledby="pedidos-titular"><h3 id="pedidos-titular" className="font-medium">Pedidos dos titulares</h3>
          <ul className="mt-2 space-y-1">{subs.filter((s) => s.change_request || s.cancel_at_period_end).map((s) => <li key={s.organization_id} className="rounded border border-line p-2">{s.organization_id.slice(0, 8)}: {s.cancel_at_period_end ? "cancelar ao fim do período" : `trocar para ${s.change_request?.plan}`} (vence {s.current_period_end})</li>)}</ul>
        </section>
      )}
    </div>
  );
}
