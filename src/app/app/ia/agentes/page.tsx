"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { AiNav } from "@/modules/ai/subnav";
import { AGENT_STATUS } from "@/modules/ai/labels";


export default function AgentesPage() {
  const agents = useCollection("agents");
  return (
    <Guard area="ia">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Agentes de IA" description="Assistentes virtuais configuráveis, sempre identificados como assistente. Nenhum modelo real está conectado: respostas são de demonstração." actions={<SimulatedBadge label="Sem modelo real" />} />
        <AiNav />
        {agents.isPending ? <LoadingBlock /> : !agents.data?.length ? <EmptyState title="Sem agentes" text="" /> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.data.map((a) => (
              <li key={a.id}><Link href={`/app/ia/agentes/${a.id}`} className="panel flex h-full flex-col gap-2 p-4 hover:border-line-strong">
                <div className="flex items-center gap-2"><Bot aria-hidden className="size-5 text-ai" /><h2 className="flex-1 font-semibold">{a.name}</h2><Badge tone={AGENT_STATUS[a.status].tone}>{AGENT_STATUS[a.status].label}</Badge></div>
                <p className="text-sm text-fg-muted">{a.objective}</p>
                <p className="num mt-auto text-xs text-fg-muted">v{a.version}{a.publishedVersion ? ` · publicada v${a.publishedVersion}` : ""} · {a.usage.conversations} conversas · {a.usage.handoffs} encaminhamentos</p>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
    </Guard>
  );
}
