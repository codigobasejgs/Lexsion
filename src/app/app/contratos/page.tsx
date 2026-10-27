"use client";

import Link from "next/link";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { ResponsiveList } from "@/modules/shared";
import { CONTRACT_STATUS } from "@/modules/commercial/labels";
import { formatBRL } from "@/lib/money";

export default function ContratosPage() {
  const contracts = useCollection("contracts");
  const clients = useCollection("clients");
  return (
    <Guard area="propostas">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Contratos" description="Contrato guarda os dados aceitos (congelados). Assinatura simulada não tem validade jurídica." actions={<Link href="/app/assinaturas" className="btn btn-secondary">Assinaturas pendentes</Link>} />
        {contracts.isPending ? <LoadingBlock /> : !contracts.data?.length ? <EmptyState title="Sem contratos" text="Gere a partir de uma proposta aceita." /> : (
          <ResponsiveList rows={contracts.data} rowKey={(c) => c.id} caption="Contratos" href={(c) => `/app/contratos/${c.id}`}
            columns={[
              { label: "Contrato", cell: (c) => <Link href={`/app/contratos/${c.id}`} className="font-medium hover:underline">{c.title}{c.version && c.version > 1 ? ` (v${c.version})` : ""}</Link> },
              { label: "Cliente", cell: (c) => clients.data?.find((x) => x.id === c.clientId)?.name },
              { label: "Total", cell: (c) => formatBRL(c.total), align: "right" },
              { label: "Situação", cell: (c) => <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge> },
            ]}
            cardTitle={(c) => c.title} cardMeta={(c) => clients.data?.find((x) => x.id === c.clientId)?.name} cardRight={(c) => <Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge>} />
        )}
      </div>
    </Guard>
  );
}
