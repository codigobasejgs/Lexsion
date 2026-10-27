"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState, PageHeader } from "@/components/ui";
import { readAll } from "@/services/mock/db";
import { formatInstant } from "@/lib/dates";

// Só eventos da PLATAFORMA (organizationId "platform"); a auditoria interna dos escritórios não aparece aqui.
export default function AuditoriaPage() {
  const q = useQuery({ queryKey: ["audit", "platform"], queryFn: async () => (await readAll("audit")).filter((a) => a.organizationId === "platform").reverse() });
  return (
    <>
      <PageHeader title="Auditoria da plataforma" description="Ações do Super Admin: criação, plano, suspensão, reativação e faturas. Registro local da demonstração; em produção será imutável no servidor." />
      {q.data?.length === 0 && <EmptyState title="Sem eventos ainda" text="Crie, suspenda ou altere o plano de um escritório para ver o registro." />}
      <ul className="panel divide-y divide-line text-sm">
        {q.data?.map((a) => <li key={a.id} className="flex flex-wrap gap-x-3 p-3"><span className="num text-fg-muted">{formatInstant(a.at)}</span><span className="font-mono text-xs">{a.action}</span><span className="flex-1">{a.detail}</span><span className="text-fg-muted">{a.entityId}</span></li>)}
      </ul>
    </>
  );
}
