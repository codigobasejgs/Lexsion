"use client";

import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { AiNav } from "@/modules/ai/subnav";
import { updateRow } from "@/services/mock/generic";
import { canApprove } from "@/domain/permissions";
import type { Objection } from "@/domain/types";

export default function ObjecoesPage() {
  const { user } = useSession();
  const objs = useCollection("objections");
  const act = useAction("objections");
  return (
    <Guard area="ia">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Biblioteca de objeções" description="Respostas aprovadas para dúvidas comuns. Empatia e transparência: sem explorar vulnerabilidade, sem urgência falsa, sem promessa de êxito." />
        <AiNav />
        <Feedback error={act.error} />
        {objs.isPending ? <LoadingBlock /> : !objs.data?.length ? <EmptyState title="Sem objeções" text="" /> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {objs.data.map((o) => (
              <li key={o.id} className="panel space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2"><Badge icon={false}>{o.topic}</Badge><span className="flex-1 text-fg-muted">{o.service}</span>{o.approved ? <Badge tone="success">Aprovada v{o.version}</Badge> : <Badge tone="warning">Aguardando aprovação</Badge>}</div>
                <p><span className="text-fg-muted">Objetivo:</span> {o.goal}</p>
                <p className="rounded border border-line bg-surface-muted p-2 font-serif">“{o.suggested}”</p>
                <p className="text-fg-muted">Limites: {o.limits}</p>
                <p className="num text-xs text-fg-muted">Responsável: {userName(o.ownerId)} · usada {o.uses} vez(es)</p>
                {!o.approved && user && canApprove(user.role) && <button className="btn btn-secondary min-h-9" onClick={() => act.run((ctx) => updateRow("objections", o.id, ctx, (x: Objection) => ({ ...x, approved: true }), "Objeção aprovada"))}>Aprovar</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Guard>
  );
}
