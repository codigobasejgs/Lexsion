"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bell } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Chips, useUrlState } from "@/modules/shared";
import { NEWS_KIND } from "@/modules/news/labels";
import { formatCivil, formatInstant } from "@/lib/dates";

export default function JornalPage() {
  const url = useUrlState();
  const news = useCollection("news");
  const area = url.get("area") ?? "todas";
  const kind = url.get("tipo") ?? "";
  const areas = useMemo(() => ["todas", ...new Set((news.data ?? []).flatMap((n) => n.areas))], [news.data]);
  const rows = (news.data ?? []).filter((n) => (area === "todas" || n.areas.includes(area)) && (!kind || n.kind === kind)).sort((a, b) => b.originalDate.localeCompare(a.originalDate));
  return (
    <Guard area="jornal">
      <div className="mx-auto max-w-[1000px]">
        <PageHeader title="Jornal do Advogado" description="Amostras de demonstração apontando para fontes oficiais. Sem coleta automática nem atualização instantânea nesta fase." actions={<><SimulatedBadge label="Amostras" /><Link href="/app/jornal/alertas" className="btn btn-secondary"><Bell aria-hidden className="size-4" /> Alertas</Link></>} />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chips label="Área" value={area} onChange={(k) => url.set("area", k === "todas" ? null : k)} options={areas.map((a) => ({ key: a, label: a === "todas" ? "Todas" : a }))} />
          <select aria-label="Tipo" className="field min-h-10 w-auto text-sm" value={kind} onChange={(e) => url.set("tipo", e.target.value || null)}><option value="">Todos os tipos</option>{Object.entries(NEWS_KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </div>
        {news.isPending ? <LoadingBlock /> : !rows.length ? <EmptyState title="Nada neste filtro" text="" /> : (
          <ul className="space-y-3">
            {rows.map((n) => (
              <li key={n.id}><Link href={`/app/jornal/${n.id}`} className="panel block p-4 text-sm hover:border-line-strong">
                <div className="flex flex-wrap items-center gap-2"><Badge tone={NEWS_KIND[n.kind].tone}>{NEWS_KIND[n.kind].label}</Badge><span className="text-fg-muted">{n.source} · {formatCivil(n.originalDate)}</span></div>
                <h2 className="mt-2 font-serif text-lg">{n.title}</h2>
                <p className="mt-1 text-fg-muted">{n.summary}</p>
                <p className="mt-1 text-xs text-fg-muted">Coletado em {formatInstant(n.collectedAt)} · {n.areas.join(", ")}</p>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
    </Guard>
  );
}
