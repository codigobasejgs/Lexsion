"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Stat } from "@/components/ui";
import { readAll } from "@/services/mock/db";
import { saasMetrics } from "@/domain/saas-metrics";
import { formatBRL } from "@/lib/money";
import { PLAN_LABEL, type PlanId } from "@/domain/tenancy";

// Painel executivo SaaS: TODOS os números derivados dos dados da demo (nenhum valor fixo).
export default function AdminPainel() {
  const q = useQuery({ queryKey: ["admin-metrics"], queryFn: async () => saasMetrics(await readAll("tenants"), await readAll("saasInvoices")) });
  const m = q.data;
  return (
    <>
      <PageHeader title="Painel geral" description="Indicadores da plataforma calculados a partir dos dados fictícios da demonstração — não são resultados reais." />
      {m && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="sa-indicadores">
            <Stat label="Receita recorrente mensal (MRR)" value={formatBRL(m.mrr)} href="/admin/faturamento" hint="Assinaturas ativas e inadimplentes" />
            <Stat label="Receita anual estimada (ARR)" value={formatBRL(m.arr)} href="/admin/faturamento" hint="MRR × 12" />
            <Stat label="Receita média por escritório (ARPA)" value={formatBRL(m.arpa)} href="/admin/organizacoes" hint="MRR ÷ escritórios pagantes" />
            <Stat label="Cancelamento (churn)" value={`${m.churnPct.toFixed(1)}%`} href="/admin/organizacoes?status=cancelada" hint={`${m.byStatus.cancelada ?? 0} cancelados de ${m.total}`} />
            <Stat label="Escritórios" value={m.total} href="/admin/organizacoes" hint={`${m.byStatus.ativa ?? 0} ativos`} />
            <Stat label="Em período de teste" value={m.byStatus.trial ?? 0} href="/admin/organizacoes?status=trial" hint={`${m.trialEndingSoon} terminam em até 7 dias`} />
            <Stat label="Suspensos ou inadimplentes" value={(m.byStatus.suspensa ?? 0) + (m.byStatus.inadimplente ?? 0)} href="/admin/organizacoes?status=suspensa" tone={(m.byStatus.suspensa ?? 0) + (m.byStatus.inadimplente ?? 0) ? "warning" : "neutral"} />
            <Stat label="Faturas SaaS em aberto" value={formatBRL(m.openInvoices)} href="/admin/faturamento" hint={`${m.overdueCount} vencidas`} tone={m.overdueCount ? "danger" : "neutral"} />
          </div>
          <section className="panel p-5" aria-labelledby="dist">
            <h2 id="dist" className="mb-3 font-semibold">Distribuição por plano</h2>
            <ul className="space-y-2 text-sm">
              {(Object.keys(PLAN_LABEL) as PlanId[]).map((p) => {
                const n = m.byPlan[p] ?? 0;
                return (
                  <li key={p} className="flex items-center gap-3">
                    <span className="w-28 shrink-0">{PLAN_LABEL[p]}</span>
                    <span className="h-2 min-w-0 flex-1 overflow-hidden rounded bg-surface-muted"><span className="block h-full bg-brand" style={{ width: `${m.total ? (n / m.total) * 100 : 0}%` }} /></span>
                    <span className="num w-6 text-right">{n}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-fg-muted">Honorários cobrados pelos escritórios aos clientes deles <strong>não</strong> entram nestes números. <Link href="/admin/faturamento" className="text-accent underline">Ver faturas SaaS</Link></p>
          </section>
        </>
      )}
    </>
  );
}
