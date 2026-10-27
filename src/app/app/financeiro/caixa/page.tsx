"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { FinanceNav } from "@/modules/finance/subnav";
import { downloadText, toCsv } from "@/domain/csv";
import { formatBRL } from "@/lib/money";
import { formatCivil } from "@/lib/dates";

/** Caixa realizado: só o que efetivamente entrou/saiu (data efetiva). Propostas e previsões não entram. */
export default function CaixaPage() {
  const pays = useCollection("payments");
  const exps = useCollection("expenses");
  const insts = useCollection("installments");
  const clients = useCollection("clients");
  const rows = useMemo(() => {
    const out = [
      ...(pays.data ?? []).map((p) => {
        const i = insts.data?.find((x) => x.id === p.installmentId);
        return { date: p.date, desc: `${p.amount < 0 ? "Estorno" : "Recebimento"} — ${i?.label ?? ""} — ${clients.data?.find((c) => c.id === i?.clientId)?.name ?? ""}`, kind: "Honorários", amount: p.amount };
      }),
      ...(exps.data ?? []).filter((e) => e.paidOn).map((e) => ({ date: e.paidOn!, desc: e.description, kind: e.category, amount: -e.amount })),
    ];
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [pays.data, exps.data, insts.data, clients.data]);
  const withBalance = rows.reduce<(typeof rows[number] & { balance: number })[]>((acc, r) => [...acc, { ...r, balance: (acc.at(-1)?.balance ?? 0) + r.amount }], []);
  const inflow = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const outflow = rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);

  return (
    <Guard area="financeiro">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Caixa realizado" description="Entradas e saídas pela data efetiva. Proposta pendente e parcela futura não entram. Dinheiro de cliente (repasse) não é receita de honorários."
          actions={<button className="btn btn-secondary" onClick={() => downloadText("caixa-demo.csv", toCsv(["Data", "Descrição", "Categoria", "Valor (centavos)", "Saldo (centavos)"], withBalance.map((r) => [formatCivil(r.date), r.desc, r.kind, r.amount, r.balance])), "text/csv;charset=utf-8")} disabled={!rows.length}><Download aria-hidden className="size-4" /> Exportar CSV</button>} />
        <FinanceNav />
        <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="panel p-3"><p className="text-fg-muted">Entradas</p><p className="num text-lg font-semibold text-success">{formatBRL(inflow)}</p></div>
          <div className="panel p-3"><p className="text-fg-muted">Saídas</p><p className="num text-lg font-semibold text-danger">{formatBRL(outflow)}</p></div>
          <div className="panel p-3"><p className="text-fg-muted">Saldo do período</p><p className="num text-lg font-semibold">{formatBRL(inflow + outflow)}</p></div>
        </div>
        {pays.isPending ? <LoadingBlock /> : !rows.length ? <EmptyState title="Sem movimentações" text="Registros aparecem ao dar baixa em parcelas ou pagar despesas." /> : (
          <div className="panel relative overflow-x-auto" tabIndex={0} role="region" aria-label="Movimentações de caixa (role horizontalmente)">
            <table className="w-full text-sm"><caption className="sr-only">Movimentações de caixa</caption>
              <thead className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wider text-fg-muted"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Saldo</th></tr></thead>
              <tbody className="divide-y divide-line">{withBalance.map((r, i) => <tr key={i}><td className="num px-4 py-2">{formatCivil(r.date)}</td><td className="px-4 py-2">{r.desc}</td><td className="px-4 py-2 text-fg-muted">{r.kind}</td><td className={`num px-4 py-2 text-right ${r.amount < 0 ? "text-danger" : ""}`}>{formatBRL(r.amount)}</td><td className="num px-4 py-2 text-right">{formatBRL(r.balance)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </Guard>
  );
}
