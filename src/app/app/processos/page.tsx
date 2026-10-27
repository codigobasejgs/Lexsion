"use client";

import Link from "next/link";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { ResponsiveList } from "@/modules/shared";
import { formatInstant } from "@/lib/dates";

const CATALOG = ["TRF1 (destaque: Bahia)", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6", "JEFs", "CJF", "STF", "INSS/Meu INSS", "CRPS", "e-SAJ", "eproc", "PJe", "Geridprev (a identificar)"];

export default function ProcessosPage() {
  const procs = useCollection("processes");
  const cases = useCollection("cases");
  return (
    <Guard area="casos">
      <div className="mx-auto max-w-[1300px]">
        <PageHeader title="Processos" description="Processos judiciais e administrativos vinculados a casos. Atualização por registro manual ou relatório importado — sem monitoramento em tempo real." actions={<Link href="/app/publicacoes" className="btn btn-secondary">Publicações e intimações</Link>} />
        {procs.isPending ? <LoadingBlock /> : !procs.data?.length ? <EmptyState title="Nenhum processo" text="Vincule processos a partir do caso." /> : (
          <ResponsiveList rows={procs.data} rowKey={(p) => p.id} caption="Processos" href={(p) => `/app/casos/${p.caseId}?aba=processos`}
            columns={[
              { label: "Número", cell: (p) => <Link className="num font-medium hover:underline" href={`/app/casos/${p.caseId}?aba=processos`}>{p.cnj ?? p.adminNumber}</Link> },
              { label: "Caso", cell: (p) => cases.data?.find((k) => k.id === p.caseId)?.title },
              { label: "Órgão", cell: (p) => `${p.court} · ${p.system}` },
              { label: "Atualização", cell: (p) => <Badge tone={p.syncStatus === "importado" ? "info" : "neutral"}>{p.syncStatus === "importado" ? `Relatório ${p.lastSync ? formatInstant(p.lastSync) : ""}` : "Manual"}</Badge> },
            ]}
            cardTitle={(p) => p.cnj ?? p.adminNumber} cardMeta={(p) => `${p.court} · ${cases.data?.find((k) => k.id === p.caseId)?.title ?? ""}`} />
        )}
        <section className="panel mt-6 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Catálogo de fontes planejadas</h2>
          <div className="flex flex-wrap gap-1.5">{CATALOG.map((c) => <Badge key={c} icon={false}>{c}</Badge>)}</div>
          <p className="mt-2 text-fg-muted">Cada fonte depende de autorização e cobertura contratada. Nenhum conector está ativo nesta demonstração.</p>
        </section>
      </div>
    </Guard>
  );
}
