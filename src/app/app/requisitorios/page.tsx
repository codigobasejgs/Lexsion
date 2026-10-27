"use client";

import Link from "next/link";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { ResponsiveList } from "@/modules/shared";
import { formatBRL } from "@/lib/money";
import { REQ_STATUS } from "@/modules/requisitions/labels";

export default function RequisitoriosPage() {
  const reqs = useCollection("requisitions");
  const clients = useCollection("clients");
  return (
    <Guard area="requisitorios">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="RPV e precatórios" description="Previsão informada não é promessa de pagamento. Depósito, disponibilidade, levantamento e repasse ao cliente são etapas diferentes." />
        {reqs.isPending ? <LoadingBlock /> : !reqs.data?.length ? <EmptyState title="Nenhum requisitório" text="Cadastre a partir do caso." /> : (
          <ResponsiveList rows={reqs.data} rowKey={(r) => r.id} caption="Requisitórios" href={(r) => `/app/requisitorios/${r.id}`}
            columns={[
              { label: "Tipo", cell: (r) => <Badge icon={false}>{r.kind}</Badge> },
              { label: "Requisição", cell: (r) => <Link href={`/app/requisitorios/${r.id}`} className="font-medium hover:underline">{r.number}</Link> },
              { label: "Beneficiário", cell: (r) => clients.data?.find((c) => c.id === r.clientId)?.name },
              { label: "Valor informado", cell: (r) => formatBRL(r.informedAmount), align: "right" },
              { label: "Situação", cell: (r) => <Badge tone={REQ_STATUS[r.status].tone}>{REQ_STATUS[r.status].label}</Badge> },
            ]}
            cardTitle={(r) => `${r.kind} · ${r.number}`} cardMeta={(r) => clients.data?.find((c) => c.id === r.clientId)?.name} cardRight={(r) => <span className="num font-semibold">{formatBRL(r.informedAmount)}</span>} />
        )}
      </div>
    </Guard>
  );
}
