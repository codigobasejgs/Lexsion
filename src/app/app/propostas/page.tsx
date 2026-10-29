"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { ResponsiveList } from "@/modules/shared";
import { FEE_KIND, PROPOSAL_STATUS } from "@/modules/commercial/labels";
import { formatBRL } from "@/lib/money";
import { formatCivil } from "@/lib/dates";

export default function PropostasPage() {
  const props = useCollection("proposals");
  const leads = useCollection("leads");
  const clients = useCollection("clients");
  const who = (p: { leadId?: string; clientId?: string }) => clients.data?.find((c) => c.id === p.clientId)?.name ?? leads.data?.find((l) => l.id === p.leadId)?.name ?? "—";
  return (
    <Guard area="propostas">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Propostas" description="Proposta → revisão → aprovação → envio → aceite → contrato com dados congelados." actions={<Link href="/app/propostas/nova" className="btn btn-primary"><Plus aria-hidden className="size-4" /> Nova proposta</Link>} />
        {props.isPending ? <LoadingBlock /> : !props.data?.length ? <EmptyState title="Sem propostas" text="Crie a partir de um lead em negociação." /> : (
          <ResponsiveList rows={props.data} rowKey={(p) => p.id} caption="Propostas" href={(p) => `/app/propostas/${p.id}`}
            columns={[
              { label: "Proposta", cell: (p) => <Link href={`/app/propostas/${p.id}`} className="font-medium hover:underline">{p.title}</Link> },
              { label: "Para", cell: who },
              { label: "Honorários", cell: (p) => FEE_KIND[p.feeKind] },
              { label: "Total", cell: (p) => formatBRL(p.total), align: "right" },
              { label: "Validade", cell: (p) => formatCivil(p.validUntil) },
              { label: "Situação", cell: (p) => <Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label} · v{p.version}</Badge> },
            ]}
            cardTitle={(p) => p.title} cardMeta={(p) => `${who(p)} · ${FEE_KIND[p.feeKind]}`} cardRight={(p) => <><p className="num font-semibold">{formatBRL(p.total)}</p><Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label}</Badge></>} />
        )}
      </div>
    </Guard>
  );
}
