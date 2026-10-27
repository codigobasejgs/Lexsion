"use client";

import Link from "next/link";
import { use, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileSearch, GitCompare, Layers, ListChecks } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useInvalidate, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { pensionService } from "@/services/mock/repo";
import { diffDays, formatCivil } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { ContributionPeriod } from "@/domain/types";
import { PensionReport } from "@/modules/pension/report";
import { allowed } from "@/domain/permissions";

const STEPS = ["Cliente", "Documentos", "Vínculos", "Pendências", "Cenários", "Revisão", "Relatório"];

const FLAG: Record<NonNullable<ContributionPeriod["flag"]>, { label: string; tone: "warning" | "danger" | "info" }> = {
  lacuna_depois: { label: "Lacuna após o período", tone: "warning" },
  concomitante: { label: "Concomitância", tone: "info" },
  divergencia_remuneracao: { label: "Divergência de remuneração", tone: "danger" },
  sem_data_fim: { label: "Sem data de fim", tone: "warning" },
};
const CATEGORY: Record<ContributionPeriod["category"], string> = { empregado: "Empregado", contribuinte_individual: "Contribuinte individual", facultativo: "Facultativo", rural: "Rural", especial: "Especial" };

export default function AnalisePage({ params }: PageProps<"/app/previdenciario/analises/[id]">) {
  const { id } = use(params);
  const { ctx, user } = useSession();
  const invalidate = useInvalidate();
  const analyses = useCollection("pensionAnalyses");
  const clients = useCollection("clients");
  const docs = useCollection("documents");
  const a = analyses.data?.find((x) => x.id === id);
  const [selected, setSelected] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"dados" | "documento">("dados");

  if (analyses.isPending) return <LoadingBlock rows={6} />;
  if (!a || !ctx) return <EmptyState title="Análise não encontrada" text="Ela pode pertencer a outro escritório." action={<Link href="/app/previdenciario" className="btn btn-secondary">Voltar</Link>} />;

  const client = clients.data?.find((c) => c.id === a.clientId);
  const stale = a.resultsVersion !== a.inputsVersion;
  const sel = a.periods.find((p) => p.id === selected) ?? a.periods[0];
  const evidenceDoc = docs.data?.find((d) => d.id === sel.evidence.documentId);
  const canApprove = allowed(user?.role, "aprovar_peca");
  const step = a.step;

  const run = async (fn: () => Promise<unknown>) => {
    await fn();
    await invalidate("pensionAnalyses");
  };
  const goStep = (s: number) => run(() => pensionService.setStep(a.id, Math.max(0, Math.min(STEPS.length - 1, s)), ctx));

  // Linha do tempo proporcional: de 1983 a 2026.
  const t0 = a.periods.reduce((m, p) => (p.start < m ? p.start : m), a.periods[0].start);
  const t1 = a.periods.reduce((m, p) => (p.end > m ? p.end : m), a.periods[0].end);
  const span = diffDays(t0, t1);
  const pos = (d: string) => (diffDays(t0, d) / span) * 100;

  return (
    <Guard area="previdenciario">
      <div className="mx-auto max-w-[1400px]">
        <PageHeader
          breadcrumb={[{ href: "/app/previdenciario", label: "Previdenciário" }]}
          title={`${a.benefit} — ${client?.name ?? ""}`}
          description={<>{a.regime} · {a.modality === "planejamento" ? "Planejamento" : a.modality === "concessao" ? "Concessão" : "Revisão"} · <Link className="text-accent underline underline-offset-2" href={`/app/clientes/${a.clientId}`}>abrir cliente</Link></>}
        />

        <div role="note" className="mb-5 flex items-start gap-2 rounded-[var(--radius-control)] border border-dashed border-accent/60 px-3 py-2 text-sm text-accent">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          Exemplo demonstrativo — cálculo jurídico não validado. Resultados são fixos de cenário de teste e exigem revisão profissional.
        </div>

        {/* Stepper */}
        <nav aria-label="Etapas da análise" data-tour="etapas-analise" className="mb-5 overflow-x-auto">
          <ol className="flex min-w-max gap-1">
            {STEPS.map((s, i) => (
              <li key={s}>
                <button onClick={() => goStep(i)} aria-current={i === step ? "step" : undefined} className={`flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm ${i === step ? "border-brand bg-selection font-medium text-fg" : i < step ? "border-line text-fg" : "border-line text-fg-muted"}`}>
                  <span className={`num inline-flex size-5 items-center justify-center rounded-full text-xs ${i < step ? "bg-success-bg text-success" : i === step ? "bg-brand text-on-brand" : "bg-surface-muted"}`}>{i < step ? "✓" : i + 1}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {/* Linha do tempo de vínculos */}
            <section className="panel p-4" aria-labelledby="tl-title">
              <h2 id="tl-title" className="mb-3 flex items-center gap-2 font-semibold"><Layers aria-hidden className="size-4 text-accent" /> Linha do tempo dos vínculos</h2>
              <div className="space-y-1.5">
                {a.periods.map((p) => (
                  <button key={p.id} onClick={() => { setSelected(p.id); setMobilePane("documento"); }} className="grid w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-2 text-left sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]" aria-label={`${p.employer}, ${formatCivil(p.start)} a ${formatCivil(p.end)}${p.flag ? `, ${FLAG[p.flag].label}` : ""}`}>
                    <span className={`truncate text-xs ${sel.id === p.id ? "font-semibold text-fg" : "text-fg-muted"}`}>{p.employer}</span>
                    <span className="relative block h-6 rounded bg-surface-muted/60">
                      <span
                        className={`absolute inset-y-0 rounded ${sel.id === p.id ? "ring-2 ring-[var(--focus)]" : ""} ${p.flag === "divergencia_remuneracao" ? "bg-danger/70" : p.flag === "concomitante" ? "bg-info/70" : "bg-brand/80"}`}
                        style={{ left: `${pos(p.start)}%`, width: `${Math.max(1, pos(p.end) - pos(p.start))}%` }}
                      />
                    </span>
                  </button>
                ))}
              </div>
              <div className="num mt-2 ml-[calc(9rem+0.5rem)] flex flex-wrap justify-between gap-x-2 text-xs text-fg-muted max-[400px]:ml-0 sm:ml-[calc(12rem+0.5rem)]"><span>{formatCivil(t0)}</span><span>{formatCivil(t1)}</span></div>
              <p className="mt-2 text-xs text-fg-muted">Cores: dourado = período sem alerta; azul = concomitância; vermelho = divergência. Cada barra também tem rótulo e alerta em texto na tabela abaixo.</p>
            </section>

            {/* Celular: alterna dados × documento */}
            <div role="tablist" aria-label="Visualização" className="flex rounded-[var(--radius-control)] border border-line p-0.5 xl:hidden">
              {(["dados", "documento"] as const).map((k) => (
                <button key={k} role="tab" aria-selected={mobilePane === k} onClick={() => setMobilePane(k)} className={`flex-1 rounded-md py-2 text-sm ${mobilePane === k ? "bg-brand text-on-brand" : "text-fg-muted"}`}>{k === "dados" ? "Dados" : "Documento"}</button>
              ))}
            </div>

            <section className={`panel ${mobilePane === "dados" ? "" : "hidden xl:block"}`} aria-labelledby="vinc-title">
              <h2 id="vinc-title" className="border-b border-line p-4 font-semibold">Vínculos e contribuições</h2>
              <ul className="divide-y divide-line">
                {a.periods.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => { setSelected(p.id); setMobilePane("documento"); }} aria-pressed={sel.id === p.id} className={`flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left text-sm ${sel.id === p.id ? "bg-selection" : "hover:bg-surface-muted/60"}`}>
                      <span className="min-w-0 flex-1 font-medium">{p.employer}</span>
                      <span className="num text-fg-muted">{formatCivil(p.start)} – {formatCivil(p.end)}</span>
                      <span className="text-fg-muted">{CATEGORY[p.category]}</span>
                      <Badge icon={false}>{p.source}</Badge>
                      {p.flag && <Badge tone={FLAG[p.flag].tone}>{FLAG[p.flag].label}</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel p-4" aria-labelledby="pend-title">
              <h2 id="pend-title" className="mb-1 flex items-center gap-2 font-semibold"><ListChecks aria-hidden className="size-4 text-accent" /> Pendências</h2>
              <p className="mb-3 text-sm text-fg-muted">Marcar uma pendência altera as entradas e invalida os resultados anteriores.</p>
              <ul className="space-y-2">
                {a.pending.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line p-3 text-sm">
                      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={p.resolved} onChange={() => run(() => pensionService.togglePending(a.id, p.id, ctx))} />
                      <span className={p.resolved ? "text-fg-muted line-through" : ""}>{p.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel p-4" aria-labelledby="cen-title" data-tour="cenarios">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 id="cen-title" className="flex flex-1 items-center gap-2 font-semibold"><GitCompare aria-hidden className="size-4 text-accent" /> Cenários comparados</h2>
                <SimulatedBadge label="Resultado demonstrativo" />
              </div>
              {stale && (
                <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning">
                  <AlertTriangle aria-hidden className="size-4" />
                  <span className="flex-1">Resultado desatualizado: entradas mudaram depois deste resultado (versão {a.resultsVersion} × entradas {a.inputsVersion}).</span>
                  {canApprove ? (
                    <button className="btn btn-secondary min-h-9" onClick={() => run(() => pensionService.acceptDemoResults(a.id, ctx))}>Marcar exemplo como revisado</button>
                  ) : <span>Peça revisão a um(a) advogado(a).</span>}
                </div>
              )}
              <div className={`grid gap-3 md:grid-cols-3 ${stale ? "opacity-50" : ""}`} aria-disabled={stale}>
                {a.scenarios.map((s) => (
                  <article key={s.id} className="flex flex-col rounded-[var(--radius-panel)] border border-line p-4">
                    <h3 className="font-medium">{s.label}</h3>
                    <p className="text-xs text-fg-muted">{s.rule}</p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div><dt className="text-fg-muted">Data provável</dt><dd className="num font-semibold">{s.eligibleOn ? formatCivil(s.eligibleOn) : "Não calculável"}</dd></div>
                      <div><dt className="text-fg-muted">Benefício estimado</dt><dd className="num font-semibold">{s.estimatedBenefit !== null ? formatBRL(s.estimatedBenefit) : "Depende de motor futuro"}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs font-medium text-fg-muted">Premissas</p>
                    <ul className="list-disc pl-4 text-xs text-fg-muted">{s.assumptions.map((x) => <li key={x}>{x}</li>)}</ul>
                    {s.pending.length > 0 && <div className="mt-2"><Badge tone="warning">{s.pending.length} pendência(s)</Badge></div>}
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Evidência ao lado (desktop) / painel alternado (celular) */}
          <aside className={`${mobilePane === "documento" ? "" : "hidden xl:block"} xl:sticky xl:top-20 xl:self-start`} aria-labelledby="ev-title">
            <section className="panel p-4">
              <h2 id="ev-title" className="mb-1 flex items-center gap-2 font-semibold"><FileSearch aria-hidden className="size-4 text-accent" /> Evidência do campo</h2>
              <p className="mb-3 text-sm text-fg-muted">{sel.employer}</p>
              <div className="rounded-[var(--radius-control)] bg-[#fbf8f2] p-4 font-mono text-[0.8rem] leading-relaxed text-[#211a10] shadow-inner">
                <p className="mb-2 text-[0.7rem] uppercase tracking-wider text-[#655744]">{evidenceDoc?.name} · página {sel.evidence.page}</p>
                <p><mark className="rounded bg-[#f1d397] px-1 text-[#211a10]">{sel.evidence.excerpt}</mark></p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-fg-muted">Fonte</dt><dd>{sel.source} (fixture de teste)</dd>
                <dt className="text-fg-muted">Período</dt><dd className="num">{formatCivil(sel.start)} – {formatCivil(sel.end)}</dd>
                <dt className="text-fg-muted">Confiança</dt><dd>Indicativa — revisar</dd>
              </dl>
              <p className="mt-3 flex items-start gap-2 text-xs text-fg-muted"><CheckCircle2 aria-hidden className="mt-0.5 size-3.5 shrink-0" /> O documento original é preservado. Correções geram nova revisão, não alteram o arquivo.</p>
            </section>
          </aside>
        </div>

        <PensionReport analysisId={a.id} clientId={a.clientId} caseId={a.caseId} clientName={client?.name ?? ""} stale={stale} pending={a.pending.filter((p) => !p.resolved).map((p) => p.text)} scenarios={a.scenarios.map((s) => `${s.label}: ${s.eligibleOn ? formatCivil(s.eligibleOn) : "não calculável"}; ${s.estimatedBenefit !== null ? formatBRL(s.estimatedBenefit) : "valor depende de motor futuro"}. Premissas: ${s.assumptions.join("; ")}`)} />

        <div className="mt-6 flex justify-between gap-2">
          <button className="btn btn-secondary" disabled={step === 0} onClick={() => goStep(step - 1)}><ChevronLeft aria-hidden className="size-4" /> Etapa anterior</button>
          <button className="btn btn-primary" disabled={step === STEPS.length - 1} onClick={() => goStep(step + 1)}>Próxima etapa <ChevronRight aria-hidden className="size-4" /></button>
        </div>
      </div>
    </Guard>
  );
}
