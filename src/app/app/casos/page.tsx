"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Chips, ResponsiveList, SearchBox, userName, useUrlState } from "@/modules/shared";
import { PHASE_LABEL } from "@/modules/cases/labels";

export default function CasosPage() {
  const url = useUrlState();
  const cases = useCollection("cases");
  const clients = useCollection("clients");
  const q = url.get("q") ?? "";
  const kind = (url.get("tipo") ?? "todos") as "todos" | "consultivo" | "administrativo" | "judicial";
  const rows = useMemo(() => (cases.data ?? []).filter((k) => (kind === "todos" || k.kind === kind) && `${k.title} ${k.area} ${k.processNumber ?? ""} ${clients.data?.find((c) => c.id === k.clientId)?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())), [cases.data, clients.data, q, kind]);
  const cn = (id: string) => clients.data?.find((c) => c.id === id)?.name ?? "";

  return (
    <Guard area="casos">
      <div className="mx-auto max-w-[1300px]">
        <PageHeader title="Casos" description="Caso é o trabalho jurídico; pode ser consultivo, administrativo ou judicial e ter zero ou vários processos." actions={<Link href="/app/clientes" className="btn btn-primary">Abrir caso por cliente</Link>} />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchBox label="Buscar caso" placeholder="Título, área, cliente ou número" value={q} onChange={(v) => url.set("q", v || null)} />
          <Chips label="Tipo" value={kind} onChange={(k) => url.set("tipo", k === "todos" ? null : k)} options={[{ key: "todos", label: "Todos" }, { key: "consultivo", label: "Consultivo" }, { key: "administrativo", label: "Administrativo" }, { key: "judicial", label: "Judicial" }]} />
        </div>
        {cases.isPending ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="Nenhum caso" text="Ajuste a busca ou abra um caso a partir do cliente." /> : (
          <ResponsiveList
            rows={rows} rowKey={(k) => k.id} caption="Casos" href={(k) => `/app/casos/${k.id}`}
            columns={[
              { label: "Caso", cell: (k) => <Link className="font-medium hover:underline" href={`/app/casos/${k.id}`}>{k.title}</Link> },
              { label: "Cliente", cell: (k) => cn(k.clientId) },
              { label: "Área", cell: (k) => k.area },
              { label: "Fase", cell: (k) => <Badge tone={k.phase === "judicial" ? "info" : "neutral"}>{PHASE_LABEL[k.phase]}</Badge> },
              { label: "Responsável", cell: (k) => userName(k.ownerId) },
              { label: "Sigilo", cell: (k) => (k.confidential ? <Badge tone="warning">Sigiloso</Badge> : "—") },
            ]}
            cardTitle={(k) => k.title}
            cardMeta={(k) => <>{cn(k.clientId)} · {k.area}</>}
            cardRight={(k) => <Badge tone={k.phase === "judicial" ? "info" : "neutral"}>{PHASE_LABEL[k.phase]}</Badge>}
          />
        )}
      </div>
    </Guard>
  );
}
