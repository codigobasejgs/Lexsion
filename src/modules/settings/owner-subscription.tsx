"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Badge, LoadingBlock } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { formatCivil, formatInstant } from "@/lib/dates";
import type { PublicPlan } from "@/domain/saas";

// Titular (operação real): plano contratado, vencimento, pagamentos, troca e cancelamento. A RLS só devolve
// o que é DESTE escritório; alterações passam por /api/assinatura (confere titularidade no servidor).
type Sub = { plan_id: string; cycle: string; status: string; price: number; max_users: number; current_period_end: string; cancel_at_period_end: boolean; change_request: { plan?: string } | null; plan_snapshot: { label?: string } };
type Order = { order_nsu: string; kind: string; amount: number; status: string; paid_at: string | null; created_at: string; checkout_url: string | null; receipt_url: string | null; period_end: string | null };

export function OwnerSubscription({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const q = useQuery({
    queryKey: ["owner-sub", organizationId],
    queryFn: async () => {
      const sb = supabaseBrowser();
      const [s, o, p, c] = await Promise.all([
        sb.from("saas_subscriptions").select("*").eq("organization_id", organizationId).maybeSingle(),
        sb.from("saas_orders").select("order_nsu,kind,amount,status,paid_at,created_at,checkout_url,receipt_url,period_end").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        sb.from("saas_plans").select("id,label,price_monthly,price_yearly,max_users,approved").eq("approved", true).order("sort"),
        sb.from("saas_contracts").select("number,status,accepted_at,document_sha256,plan_id,cycle,amount").eq("organization_id", organizationId).order("created_at", { ascending: false }),
      ]);
      return { sub: s.data as Sub | null, orders: (o.data ?? []) as Order[], plans: (p.data ?? []) as PublicPlan[], contracts: (c.data ?? []) as { number: string; status: string; accepted_at: string | null; document_sha256: string; plan_id: string; cycle: string; amount: number }[] };
    },
  });
  if (q.isPending) return <LoadingBlock rows={3} />;
  const { sub, orders, plans, contracts } = q.data!;
  const pdf = async (number: string) => {
    const r = await fetch("/api/assinatura/contrato", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number }) });
    if (!r.ok) return setMsg({ ok: false, text: "PDF indisponível agora." });
    const url = URL.createObjectURL(await r.blob()); Object.assign(document.createElement("a"), { href: url, download: `contrato-lexsion-${number}.pdf` }).click(); URL.revokeObjectURL(url);
  };
  const contractsPanel = (
    <div className="panel space-y-2 p-5" data-testid="meu-contrato">
      <h2 className="font-semibold">Meu contrato</h2>
      {!contracts.length ? <p className="text-fg-muted">Nenhum contrato SaaS registrado para este escritório.</p> : (
        <ul className="space-y-2">{contracts.map((c) => <li key={c.number} className="flex flex-wrap items-center gap-2 rounded border border-line p-2">
          <span className="flex-1">Contrato <strong>{c.number}</strong> · {c.plan_id}/{c.cycle} · {formatBRL(c.amount)} · {c.accepted_at ? `aceito eletronicamente em ${formatInstant(c.accepted_at)}` : "não aceito"}<br /><span className="break-all text-xs text-fg-muted">SHA-256 {c.document_sha256}</span></span>
          {c.accepted_at && <button className="btn btn-secondary min-h-9" onClick={() => void pdf(c.number)}>Baixar PDF</button>}
        </li>)}</ul>
      )}
    </div>
  );
  if (!sub) return <section className="space-y-4 text-sm" data-testid="minha-assinatura"><p className="panel p-5 text-fg-muted">Este escritório foi criado pela equipe LexSion, sem assinatura pelo site. Condições e pagamentos: fale com o suporte LexSion.</p>{contractsPanel}</section>;
  const call = async (body: Record<string, unknown>, ok: string) => {
    setMsg(null);
    const r = await fetch("/api/assinatura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, ...body }) }).then((x) => x.json()).catch(() => null);
    setMsg(r?.ok ? { ok: true, text: ok } : { ok: false, text: r?.error?.message ?? "Sem conexão. Nada foi alterado." });
    await qc.invalidateQueries({ queryKey: ["owner-sub", organizationId] });
  };
  const open = orders.find((o) => o.status === "pendente" && o.kind === "renovacao" && o.checkout_url);
  return (
    <section className="space-y-4 text-sm" data-testid="minha-assinatura">
      <div className="panel space-y-2 p-5">
        <h2 className="font-semibold">Plano {sub.plan_snapshot.label ?? sub.plan_id} · {sub.cycle} · {formatBRL(sub.price)}</h2>
        <p>Situação: <Badge tone={sub.status === "ativa" ? "success" : "warning"}>{sub.status}</Badge> · até {sub.max_users} usuário(s)</p>
        <p>{sub.cancel_at_period_end ? "Cancelamento agendado: o acesso termina em " : sub.status === "teste" ? "Teste grátis até " : "Período pago até "}<strong className="num">{formatCivil(sub.current_period_end)}</strong>. Sem débito automático: a cobrança do próximo período chega por e-mail 7 dias antes.</p>
        {open && <p><a className="btn btn-primary" href={open.checkout_url!} rel="noopener">Pagar a renovação ({formatBRL(open.amount)})</a></p>}
        {sub.change_request?.plan && <p className="text-info">Troca para {plans.find((p) => p.id === sub.change_request!.plan)?.label ?? sub.change_request.plan} a partir do próximo período.</p>}
      </div>
      <div className="panel space-y-3 p-5">
        <h2 className="font-semibold">Trocar de plano ou cancelar</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block"><span className="label">Plano do próximo período</span>
            <select className="field" defaultValue={sub.change_request?.plan ?? sub.plan_id} id="novo-plano">{plans.map((p) => <option key={p.id} value={p.id}>{p.label} — {formatBRL(sub.cycle === "anual" && p.price_yearly ? p.price_yearly : p.price_monthly)} · {p.max_users} usuário(s)</option>)}</select></label>
          <button className="btn btn-secondary" onClick={() => void call({ action: "change", plan: (document.getElementById("novo-plano") as HTMLSelectElement).value }, "Troca registrada para o próximo período.")}>Pedir troca</button>
        </div>
        {sub.cancel_at_period_end
          ? <button className="btn btn-secondary" onClick={() => void call({ action: "undo-cancel" }, "Cancelamento desfeito.")}>Desfazer cancelamento</button>
          : <button className="btn btn-ghost text-danger" onClick={() => { if (confirm(`Cancelar ao fim do período pago (${formatCivil(sub.current_period_end)})? Os dados ficam preservados por 90 dias.`)) void call({ action: "cancel" }, "Cancelamento agendado para o fim do período."); }}>Cancelar assinatura</button>}
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}
      </div>
      {contractsPanel}
      <div className="panel overflow-x-auto p-5">
        <h2 className="mb-3 font-semibold">Pagamentos</h2>
        <table className="w-full min-w-[480px]"><caption className="sr-only">Pagamentos da assinatura LexSion</caption>
          <thead><tr className="text-left text-xs text-fg-muted"><th className="py-1">Data</th><th>Tipo</th><th>Valor</th><th>Situação</th><th>Comprovante</th></tr></thead>
          <tbody>{orders.map((o) => <tr key={o.order_nsu} className="border-t border-line"><td className="num py-2">{formatInstant(o.paid_at ?? o.created_at)}</td><td>{o.kind === "renovacao" ? "Renovação" : "Contratação"}</td><td className="num">{formatBRL(o.amount)}</td><td>{o.status}</td><td>{o.receipt_url ? <a className="text-accent underline" href={o.receipt_url} rel="noopener noreferrer" target="_blank">ver</a> : "—"}</td></tr>)}</tbody>
        </table>
        <p className="mt-3 text-xs text-fg-muted">Separado dos honorários que o escritório cobra dos clientes.</p>
      </div>
    </section>
  );
}
