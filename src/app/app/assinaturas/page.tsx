"use client";

import Link from "next/link";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { CONTRACT_STATUS } from "@/modules/commercial/labels";

export default function AssinaturasPage() {
  const contracts = useCollection("contracts");
  const open = (contracts.data ?? []).filter((c) => c.status === "enviado" || c.status === "parcial" || c.status === "rascunho");
  return (
    <Guard area="propostas">
      <div className="mx-auto max-w-[1000px]">
        <PageHeader breadcrumb={[{ href: "/app/contratos", label: "Contratos" }]} title="Assinaturas" description="Contratos aguardando assinatura. A assinatura de uma pessoa não conclui o contrato: todos os obrigatórios precisam assinar." />
        {contracts.isPending ? <LoadingBlock /> : !open.length ? <EmptyState title="Nada pendente" text="Nenhum contrato aguardando assinatura." /> : (
          <ul className="space-y-2">
            {open.map((c) => {
              const req = (c.signers ?? []).filter((s) => s.required);
              const done = req.filter((s) => s.status === "assinado").length;
              return (
                <li key={c.id}><Link href={`/app/contratos/${c.id}`} className="panel flex flex-wrap items-center gap-3 p-4 text-sm hover:border-line-strong">
                  <span className="min-w-0 flex-1 font-medium">{c.title}</span>
                  <span className="num text-fg-muted">{done}/{req.length} obrigatórios</span>
                  <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge>
                </Link></li>
              );
            })}
          </ul>
        )}
      </div>
    </Guard>
  );
}
