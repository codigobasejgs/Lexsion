"use client";

import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { AiNav } from "@/modules/ai/subnav";
import { formatInstant } from "@/lib/dates";

export default function ExecucoesPage() {
  const runs = useCollection("agentRuns");
  const agents = useCollection("agents");
  return (
    <Guard area="ia">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Execuções e logs" description="Cada execução registra fontes usadas, dados capturados e ações propostas." />
        <AiNav />
        {runs.isPending ? <LoadingBlock /> : !runs.data?.length ? <EmptyState title="Nenhuma execução" text="Rode um teste no simulador." /> : (
          <ul className="space-y-2">
            {[...runs.data].reverse().map((r) => (
              <li key={r.id} className="panel p-3 text-sm">
                <p className="font-medium">{agents.data?.find((a) => a.id === r.agentId)?.name} · {r.persona}</p>
                <p className="num text-xs text-fg-muted">{formatInstant(r.at)} · {r.steps.length} passos · fontes: {r.sources.join(", ")}</p>
                <p>{r.outcome}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Guard>
  );
}
