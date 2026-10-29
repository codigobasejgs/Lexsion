"use client";

import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, useLive } from "@/modules/shared";
import { updateRow } from "@/services/mock/generic";
import { formatInstant } from "@/lib/dates";
import type { IntegrationEvent } from "@/domain/types";

export default function EventosPage() {
  const live = useLive();
  const events = useCollection("integrationEvents");
  const act = useAction("integrationEvents");
  const rows = [...(events.data ?? [])].reverse();
  return (
    <Guard area="integracoes">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader breadcrumb={[{ href: "/app/integracoes", label: "Integrações" }]} title="Log de eventos" description="correlationId, tipo, tentativa, horário e status. Dados pessoais mascarados." />
        <Feedback error={act.error} notice={act.notice} />
        {events.isPending ? <LoadingBlock /> : !rows.length ? <EmptyState title="Sem eventos" text="" /> : (
          <div className="panel relative overflow-x-auto" tabIndex={0} role="region" aria-label="Eventos de integração (role horizontalmente se necessário)">
            <table className="w-full text-sm"><caption className="sr-only">Eventos de integração</caption>
              <thead className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wider text-fg-muted"><tr><th className="px-3 py-2">Quando</th><th className="px-3 py-2">Provedor</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Tentativa</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Detalhe</th><th className="px-3 py-2">correlationId</th><th className="px-3 py-2"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody className="divide-y divide-line">{rows.map((e) => (
                <tr key={e.id}>
                  <td className="num px-3 py-2">{formatInstant(e.at)}</td><td className="px-3 py-2">{e.provider}</td><td className="px-3 py-2 font-mono text-xs">{e.type}</td><td className="num px-3 py-2">{e.attempt}</td>
                  <td className="px-3 py-2"><Badge tone={e.status === "sucesso" || e.status === "reprocessado" ? "success" : e.status === "falha" ? "danger" : "warning"}>{e.status}</Badge></td>
                  <td className="px-3 py-2">{e.detail}</td><td className="px-3 py-2 font-mono text-xs">{e.correlationId}</td>
                  <td className="px-3 py-2">{e.status === "falha" && !live && <button className="btn btn-ghost min-h-8 text-xs" onClick={() => act.run((ctx) => updateRow("integrationEvents", e.id, ctx, (x: IntegrationEvent) => ({ ...x, attempt: x.attempt + 1, status: "reprocessado" })), "Reprocessado (simulação).")}>Reprocessar</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </Guard>
  );
}
