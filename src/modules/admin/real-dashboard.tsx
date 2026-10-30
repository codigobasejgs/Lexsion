"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, RefreshCw } from "lucide-react";
import { EmptyState, LoadingBlock, Stat } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { fmtDateTime, loadMetrics } from "./real-api";
import { PlatformHealth } from "./platform-health";

// Painel geral da OPERAÇÃO REAL: só dados do Supabase (função platform_metrics, com MFA). Fórmulas declaradas na tela
// e em docs/PRODUCAO_REAL/18. Teste e cortesia não entram em receita. Suporte não recebe valores (aparece "restrito").
const money = (v: number | null) => (v === null ? "restrito" : formatBRL(v));

export function RealDashboard() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["platform-metrics", days], queryFn: () => loadMetrics(days), refetchInterval: 120_000 });
  if (q.isPending) return <LoadingBlock rows={4} />;
  if (q.error) return <p role="alert" className="panel p-5 text-sm text-danger">Não foi possível ler os indicadores reais: {(q.error as Error).message}. Nenhum número da demonstração é mostrado no lugar.</p>;
  const m = q.data!;
  const st = (k: string) => m.by_status[k] ?? 0;
  const arr = m.mrr === null ? null : m.mrr * 12;
  const arpa = m.mrr === null ? null : m.paying ? Math.round(m.mrr / m.paying) : 0;
  const conv = m.trials_ever ? `${((m.trials_converted / m.trials_ever) * 100).toFixed(0)}%` : "—";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-success/30 bg-success-bg px-3 py-2 text-sm text-success" data-testid="fonte-real">
        <Database aria-hidden className="size-4" /> <strong>Administração da plataforma · Dados reais</strong>
        <span className="text-fg-muted">Lidos do banco em {fmtDateTime(m.generated_at)}</span>
        <button className="btn btn-ghost ml-auto min-h-9" onClick={() => void q.refetch()} aria-label="Atualizar indicadores"><RefreshCw aria-hidden className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar</button>
        <label className="flex items-center gap-2 text-fg"><span>Período</span><select className="field min-h-9 w-auto py-0" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90].map((d) => <option key={d} value={d}>{d} dias</option>)}</select></label>
      </div>
      {m.orgs_total === 0 && <EmptyState title="Nenhum escritório real cadastrado ainda" text="Os números abaixo são zero porque o banco de produção não tem contratantes. Nenhum dado fictício é exibido aqui." action={<div className="flex flex-wrap justify-center gap-2"><Link href="/admin/organizacoes?novo=1" className="btn btn-primary">Criar escritório</Link><Link href="/admin/planos" className="btn btn-secondary">Abrir planos</Link></div>} />}
      <section aria-labelledby="k-c"><h2 id="k-c" className="mb-2 font-semibold">Contratantes</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="sa-indicadores">
          <Stat label="Escritórios" value={m.orgs_total} href="/admin/organizacoes" hint={`${m.new_orgs} novos em ${days} dias`} />
          <Stat label="Em teste" value={st("trial")} href="/admin/organizacoes?f=teste" hint={`${m.trial_ending_7d} terminam em até 7 dias`} tone={m.trial_ending_7d ? "warning" : "neutral"} />
          <Stat label="Teste vencido (aguardando rotina)" value={m.trial_expired} href="/admin/organizacoes?f=teste_expirado" tone={m.trial_expired ? "warning" : "neutral"} />
          <Stat label="Cortesias vigentes" value={m.courtesy} href="/admin/organizacoes?f=cortesia" hint="Sem pagamento; fora da receita" />
          <Stat label="Pagantes" value={m.paying} href="/admin/organizacoes?f=pagante" hint="Assinatura ativa com pagamento confirmado" />
          <Stat label="Suspensos" value={st("suspensa")} href="/admin/organizacoes?f=suspenso" tone={st("suspensa") ? "warning" : "neutral"} />
          <Stat label="Cancelados" value={st("cancelada")} href="/admin/organizacoes?f=cancelado" />
          <Stat label="Titulares sem primeiro acesso" value={m.invites_pending} href="/admin/organizacoes?f=sem_acesso" tone={m.invites_pending ? "warning" : "neutral"} />
        </div>
      </section>
      <section aria-labelledby="k-r"><h2 id="k-r" className="mb-2 font-semibold">Receita da LexSion (não inclui honorários dos escritórios)</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="MRR" value={money(m.mrr)} href="/admin/faturamento" hint="Σ assinaturas ativas pagas (anual ÷ 12)" />
          <Stat label="ARR" value={money(arr)} href="/admin/faturamento" hint="MRR × 12" />
          <Stat label="ARPA" value={money(arpa)} href="/admin/faturamento" hint="MRR ÷ escritórios pagantes" />
          <Stat label={`Recebido em ${days} dias`} value={money(m.paid_in_period)} href="/admin/faturamento" hint={`${m.paid_count} pagamento(s) confirmados no payment_check`} />
          <Stat label="Cobranças em aberto" value={money(m.pending_amount)} href="/admin/faturamento" />
          <Stat label={`Estornos em ${days} dias`} value={money(m.refunded_in_period)} href="/admin/faturamento" />
          <Stat label="Pagos sem ativação" value={m.paid_without_activation} href="/admin/faturamento" tone={m.paid_without_activation ? "danger" : "neutral"} hint="Precisam de reprocessamento" />
          <Stat label="Conversão teste → pago" value={conv} href="/admin/organizacoes?f=pagante" hint={`${m.trials_converted} de ${m.trials_ever} escritórios que testaram`} />
        </div>
      </section>
      <section aria-labelledby="k-f" className="panel p-4 text-sm"><h2 id="k-f" className="mb-2 font-semibold">Funil de contratação ({days} dias)</h2>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-6">{[["Contratos gerados", "contratos_criados"], ["Contratos aceitos", "contratos_aceitos"], ["Testes iniciados", "testes"], ["Pedidos de pagamento", "pedidos"], ["Pagos", "pagos"], ["Escritórios ativados", "ativados"]].map(([l, k]) => <li key={k} className="rounded border border-line p-2"><span className="block text-xs text-fg-muted">{l}</span><span className="num text-lg font-semibold">{m.funnel[k] ?? 0}</span></li>)}</ol>
        <p className="mt-2 text-xs text-fg-muted">Visitas a /planos não são medidas (sem ferramenta de análise instalada); por isso o funil começa no contrato gerado.</p>
      </section>
      <section aria-labelledby="k-p" className="panel p-4 text-sm"><h2 id="k-p" className="mb-2 font-semibold">Escritórios por plano</h2>
        {Object.keys(m.by_plan).length ? <ul className="flex flex-wrap gap-2">{Object.entries(m.by_plan).map(([p, n]) => <li key={p}><Link className="btn btn-ghost min-h-9" href={`/admin/organizacoes?plano=${p}`}>{p}: <strong className="num">{n}</strong></Link></li>)}</ul> : <p className="text-fg-muted">Sem escritórios.</p>}
      </section>
      <PlatformHealth />
    </div>
  );
}
