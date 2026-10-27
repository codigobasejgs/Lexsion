"use client";

import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { formatInstant } from "@/lib/dates";

export default function AutomacaoExecucoesPage() {
  const runs = useCollection("automationRuns");
  const autos = useCollection("automations");
  return (
    <Guard area="automacoes">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader breadcrumb={[{ href: "/app/automacoes", label: "Automações" }]} title="Execuções de automações" description="Histórico com resultado, motivo de interrupção e chave de deduplicação." />
        {runs.isPending ? <LoadingBlock /> : !runs.data?.length ? <EmptyState title="Sem execuções" text="" /> : (
          <ul className="panel divide-y divide-line">
            {[...runs.data].reverse().map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="num text-fg-muted">{formatInstant(r.at)}</span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{autos.data?.find((a) => a.id === r.automationId)?.name}</span><span className="text-fg-muted">{r.target} — {r.detail}</span></span>
                <Badge tone={r.result === "erro" ? "danger" : r.result === "ignorada" ? "neutral" : "success"} icon={false}>{r.result}</Badge>
                <code className="text-xs text-fg-muted">{r.dedupeKey}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Guard>
  );
}
