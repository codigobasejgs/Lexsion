"use client";

import { usePortalData } from "@/modules/portal/data";
import { formatBRL } from "@/lib/money";
import { formatCivil } from "@/lib/dates";

export default function PortalPagamentosPage() {
  const d = usePortalData();
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-2xl">Pagamentos</h1>
      <section className="panel p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-accent">Em aberto</h2>
        {d.bills.length ? (
          <ul className="mt-3 space-y-3">
            {d.bills.map((b) => {
              const ch = d.charges.find((c) => c.installmentId === b.id && ["pendente", "vencida", "parcialmente_paga"].includes(c.status));
              return (
                <li key={b.id} className="rounded-[var(--radius-control)] border border-line p-3">
                  <p className="num text-xl font-semibold">{formatBRL(b.amount - b.paid)}</p>
                  <p className="text-fg-muted">{b.label} · vence em {formatCivil(b.due)}{b.paid > 0 ? ` · já pago ${formatBRL(b.paid)}` : ""}</p>
                  {ch ? <p className="mt-2 text-sm">Cobrança {ch.method === "pix" ? "Pix" : ch.method} emitida pelo escritório (demonstração: o link não leva a pagamento real).</p> : <p className="mt-2 text-sm text-fg-muted">Pagamento online será habilitado na próxima fase. Dúvidas? Fale com o escritório.</p>}
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-2">Você não tem valores em aberto.</p>}
      </section>
      <section className="panel p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-accent">Pagos</h2>
        {d.paid.length ? <ul className="mt-2 space-y-1">{d.paid.map((p) => <li key={p.id} className="num flex justify-between"><span>{p.label}</span><span>{formatBRL(p.amount)}</span></li>)}</ul> : <p className="mt-2">Nenhum pagamento registrado.</p>}
      </section>
    </div>
  );
}
