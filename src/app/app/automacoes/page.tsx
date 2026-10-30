"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";

const ST = { ativa: { label: "Ativa", tone: "success" }, pausada: { label: "Pausada", tone: "warning" }, rascunho: { label: "Rascunho", tone: "neutral" } } as const;

export default function AutomacoesPage() {
  const autos = useCollection("automations");
  return (
    <Guard area="automacoes">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Automações" description="Gatilho → condições → espera → ação → encerramento. Disparo em massa fica desligado por padrão. Ações externas são sugeridas, não enviadas." actions={<Link href="/app/automacoes/execucoes" className="btn btn-secondary">Execuções</Link>} />
        {autos.isPending ? <LoadingBlock /> : !autos.data?.length ? <EmptyState title="Sem automações" text="" /> : (
          <ul className="space-y-3">
            {autos.data.map((a) => (
              <li key={a.id}><Link href={`/app/automacoes/${a.id}`} className="panel block p-4 text-sm hover:border-line-strong">
                <div className="flex flex-wrap items-center gap-2"><p className="flex-1 font-medium">{a.name}</p><Badge tone={ST[a.status].tone}>{ST[a.status].label}</Badge><span className="num text-xs text-fg-muted">v{a.version}</span></div>
                <p className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 text-fg-muted [&>span]:max-w-full [&>span]:whitespace-normal [&>span]:break-words">
                  <Badge icon={false}>{a.trigger}</Badge><ArrowRight aria-hidden className="size-3.5" />
                  {a.conditions.map((c) => <Badge key={c} icon={false}>{c}</Badge>)}<ArrowRight aria-hidden className="size-3.5" />
                  <Badge icon={false}>espera {a.waitHours}h</Badge><ArrowRight aria-hidden className="size-3.5" />
                  <Badge tone="brand" icon={false}>{a.action}</Badge>
                </p>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
    </Guard>
  );
}
