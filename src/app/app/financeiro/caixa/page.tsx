"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { FinanceNav } from "@/modules/finance/subnav";
import { useUrlState } from "@/modules/shared";
import { downloadText, toCsv } from "@/domain/csv";
import { formatBRL } from "@/lib/money";
import { formatCivil } from "@/lib/dates";

const monthLabel = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

/** Caixa realizado: só o que efetivamente entrou/saiu (data efetiva). Propostas e previsões não entram. */
export default function CaixaPage() {
  const url = useUrlState();
  const month = url.get("mes") ?? ""; // "" = todo o período
  const pays = useCollection("payments");
  const exps = useCollection("expenses");
  const insts = useCollection("installments");
  const clients = useCollection("clients");
  const all = useMemo(() => {
    const out = [
      ...(pays.data ?? []).map((p) => {
        const i = insts.data?.find((x) => x.id === p.installmentId);
        return { date: p.date, desc: `${p.amount < 0 ? "Estorno" : "Recebimento"} — ${i?.label ?? ""} — ${clients.data?.find((c) => c.id === i?.clientId)?.name ?? ""}`, kind: "Honorários", amount: p.amount };
      }),
      ...(exps.data ?? []).filter((e) => e.paidOn).map((e) => ({ date: e.paidOn!, desc: e.description, kind: e.category, amount: -e.amount })),
    ];
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [pays.data, exps.data, insts.data, clients.data]);
  const months = [...new Set(all.map((r) => r.date.slice(0, 7)))].sort().reverse();
  // Saldo acumulado parte do que veio antes do mês escolhido (saldo inicial do período).
  const opening = month ? all.filter((r) => r.date.slice(0, 7) < month).reduce((s, r) => s + r.amount, 0) : 0;
  const rows = month ? all.filter((r) => r.date.startsWith(month)) : all;
  const withBalance = rows.reduce<(typeof rows[number] & { balance: number })[]>((acc, r) => [...acc, { ...r, balance: (acc.at(-1)?.balance ?? opening) + r.amount }], []);
  const inflow = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const outflow = rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);

  return (
    <Guard area="financeiro">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Caixa realizado" description="Entradas e saídas pela data efetiva. Proposta pendente e parcela futura não entram. Dinheiro de cliente (repasse) não é receita de honorários."
          actions={<button className="btn btn-secondary" onClick={() => downloadText(`caixa-demo${month ? `-${month}` : ""}.csv`, toCsv(["Data", "Descrição", "Categoria", "Valor (centavos)", "Saldo (centavos)"], withBalance.map((r) => [formatCivil(r.date), r.desc, r.kind, r.amount, r.balance])), "text/csv;charset=utf-8")} disabled={!rows.length}><Download aria-hidden className="size-4" /> Exportar CSV</button>} />
        <FinanceNav />
        <label className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span className="text-fg-muted">Período</span>
          <select className="field min-h-10 w-auto" value={month} onChange={(e) => url.set("mes", e.target.value || null)}>
            <option value="">Todo o período</option>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
        <div className="mb-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" aria-live="polite">
          <div className="panel p-3"><p className="text-fg-muted">Entradas</p><p className="num text-lg font-semibold text-success">{formatBRL(inflow)}</p></div>
          <div className="panel p-3"><p className="text-fg-muted">Saídas</p><p className="num text-lg font-semibold text-danger">{formatBRL(outflow)}</p></div>
          <div className="panel p-3"><p className="text-fg-muted">Resultado do período</p><p className="num text-lg font-semibold">{formatBRL(inflow + outflow)}</p>{month && <p className="text-xs text-fg-muted">Saldo inicial {formatBRL(opening)}</p>}</div>
        </div>
        {pays.isPending ? <LoadingBlock /> : !rows.length ? <EmptyState title="Sem movimentações" text={month ? "Nada entrou ou saiu neste mês." : "Registros aparecem ao dar baixa em parcelas ou pagar despesas."} /> : (
          <>
            <div className="panel relative hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Movimentações de caixa (role horizontalmente se necessário)">
              <table className="w-full text-sm"><caption className="sr-only">Movimentações de caixa</caption>
                <thead className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wider text-fg-muted"><tr><th scope="col" className="px-4 py-3">Data</th><th scope="col" className="px-4 py-3">Descrição</th><th scope="col" className="px-4 py-3">Categoria</th><th scope="col" className="px-4 py-3 text-right">Valor</th><th scope="col" className="px-4 py-3 text-right">Saldo</th></tr></thead>
                <tbody className="divide-y divide-line">{withBalance.map((r, i) => <tr key={i}><td className="num px-4 py-2">{formatCivil(r.date)}</td><td className="px-4 py-2">{r.desc}</td><td className="px-4 py-2 text-fg-muted">{r.kind}</td><td className={`num px-4 py-2 text-right ${r.amount < 0 ? "text-danger" : ""}`}>{formatBRL(r.amount)}</td><td className="num px-4 py-2 text-right">{formatBRL(r.balance)}</td></tr>)}</tbody>
              </table>
            </div>
            {/* Celular: cartões, sem rolagem lateral (FIN-09) */}
            <ul className="space-y-2 md:hidden" aria-label="Movimentações de caixa">
              {withBalance.map((r, i) => (
                <li key={i} className="panel p-3 text-sm">
                  <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words">{r.desc}</span><span className={`num shrink-0 font-semibold ${r.amount < 0 ? "text-danger" : "text-success"}`}>{formatBRL(r.amount)}</span></div>
                  <p className="num mt-1 text-fg-muted">{formatCivil(r.date)} · {r.kind} · saldo {formatBRL(r.balance)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Guard>
  );
}
