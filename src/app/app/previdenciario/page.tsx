"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, HelpCircle } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";

const BENEFITS = ["Aposentadorias (programada, idade, especial, PcD)", "Pensão por morte", "Incapacidade temporária/permanente", "Auxílio-acidente", "Salário-maternidade", "BPC/LOAS (sem decisão automática de elegibilidade)"];
const MODALITIES = ["Planejamento", "Concessão", "Revisão", "Restabelecimento", "Liquidação", "Complementação", "Contribuições em atraso"];
const GLOSSARY: [string, string][] = [
  ["DER", "Data de Entrada do Requerimento: quando o pedido foi feito no INSS."],
  ["DIB", "Data de Início do Benefício."],
  ["DII", "Data de Início da Incapacidade (benefícios por incapacidade)."],
  ["NB", "Número do Benefício."],
  ["CNIS", "Cadastro Nacional de Informações Sociais: histórico de vínculos e contribuições."],
  ["Carência", "Número mínimo de contribuições mensais exigido para alguns benefícios."],
  ["Qualidade de segurado", "Condição de quem está protegido pela Previdência; pode ser mantida por um tempo sem contribuir."],
  ["RMI", "Renda Mensal Inicial: valor do benefício no início (resultado de motor futuro nesta plataforma)."],
];

export default function PrevidenciarioPage() {
  const analyses = useCollection("pensionAnalyses");
  const clients = useCollection("clients");
  const [regime, setRegime] = useState<"RGPS" | "RPPS">("RGPS");
  const rows = (analyses.data ?? []).filter((a) => a.regime === regime);
  return (
    <Guard area="previdenciario">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Previdenciário" description="Análises de CNIS, vínculos, pendências e cenários. Resultados demonstrativos exigem revisão profissional." />
        <div role="tablist" aria-label="Regime" className="mb-4 inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm">
          {(["RGPS", "RPPS"] as const).map((r) => <button key={r} role="tab" aria-selected={regime === r} onClick={() => setRegime(r)} className={`rounded-md px-4 py-1.5 ${regime === r ? "bg-brand text-on-brand" : "text-fg-muted"}`}>{r === "RGPS" ? "RGPS (INSS)" : "RPPS (regimes próprios)"}</button>)}
        </div>
        {regime === "RPPS" && <p className="mb-4 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info">Cada RPPS tem regras do seu ente (União, estado, município). Nada é tratado como igual: regras são parametrizadas por ente quando conhecidas e validadas.</p>}
        {analyses.isPending ? <LoadingBlock /> : rows.length === 0 ? (
          <EmptyState title={`Nenhuma análise ${regime} neste escritório`} text={regime === "RPPS" ? "Ex.: caso Ana Cláudia (RPPS municipal) aguarda cadastro de regras do ente." : "Análises criadas a partir de um caso aparecerão aqui."} action={regime === "RPPS" ? <Link className="btn btn-secondary" href="/app/casos/k-ana-rpps">Abrir caso RPPS</Link> : undefined} />
        ) : (
          <ul className="space-y-2">
            {rows.map((a) => {
              const open = a.pending.filter((p) => !p.resolved).length;
              return (
                <li key={a.id}>
                  <Link href={`/app/previdenciario/${a.modality === "planejamento" ? "planejamentos" : "analises"}/${a.id}`} className="panel flex flex-wrap items-center gap-3 p-4 hover:border-line-strong">
                    <div className="min-w-0 flex-1"><p className="font-medium">{a.benefit} — {clients.data?.find((c) => c.id === a.clientId)?.name}</p><p className="text-sm text-fg-muted">{a.regime} · {a.modality} · {a.periods.length} vínculos · {a.scenarios.length} cenários</p></div>
                    {open > 0 ? <Badge tone="warning">{open} pendência(s)</Badge> : <Badge tone="success">Sem pendências</Badge>}
                    {a.resultsVersion !== a.inputsVersion && <Badge tone="danger">Resultado desatualizado</Badge>}
                    <ChevronRight aria-hidden className="size-4 text-fg-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <section className="panel p-4 text-sm"><h2 className="mb-2 font-semibold">Benefícios cobertos (interface)</h2><ul className="list-disc space-y-1 pl-5">{BENEFITS.map((b) => <li key={b}>{b}</li>)}</ul></section>
          <section className="panel p-4 text-sm"><h2 className="mb-2 font-semibold">Modalidades separadas</h2><div className="flex flex-wrap gap-1.5">{MODALITIES.map((m) => <Badge key={m} icon={false}>{m}</Badge>)}</div><p className="mt-2 text-fg-muted">RMI, valor da causa e atrasados: motores futuros, com fonte e versão das regras.</p></section>
          <section className="panel p-4 text-sm"><h2 className="mb-2 flex items-center gap-1.5 font-semibold"><HelpCircle aria-hidden className="size-4" /> Termos em linguagem simples</h2><dl className="space-y-1.5">{GLOSSARY.map(([k, v]) => <div key={k}><dt className="inline font-medium">{k}: </dt><dd className="inline text-fg-muted">{v}</dd></div>)}</dl></section>
        </div>
      </div>
    </Guard>
  );
}
