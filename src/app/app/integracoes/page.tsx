"use client";

import Link from "next/link";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { INT_STATUS } from "@/modules/integrations/labels";

export default function IntegracoesPage() {
  const ints = useCollection("integrations");
  return (
    <Guard area="integracoes">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Integrações" description="Catálogo de conectores. Nesta fase tudo opera em modo demonstração: “operacional” significa simulado, nunca conectado a conta real." actions={<Link className="btn btn-secondary" href="/app/integracoes/eventos">Log de eventos</Link>} />
        {ints.isPending ? <LoadingBlock /> : !ints.data?.length ? <EmptyState title="Sem integrações" text="" /> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ints.data.map((i) => (
              <li key={i.id}><Link href={`/app/integracoes/${i.provider}`} className="panel flex h-full flex-col gap-2 p-4 text-sm hover:border-line-strong">
                <div className="flex items-center gap-2"><h2 className="flex-1 font-semibold">{i.name}</h2><Badge tone={INT_STATUS[i.status].tone}>{INT_STATUS[i.status].label}</Badge></div>
                <p className="text-fg-muted">{i.purpose}</p>
                <p className="mt-auto text-xs text-fg-muted">Modo: {i.mode}{i.lastError ? ` · erro: ${i.lastError}` : ""}</p>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
    </Guard>
  );
}
