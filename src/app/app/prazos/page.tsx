"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Chips, Feedback, useAction, useUrlState, userName } from "@/modules/shared";
import { ConfirmDeadlineDialog, NewDeadlineDialog } from "@/modules/deadlines/deadline-dialogs";
import { deadlineService } from "@/services/mock/ops-repo";
import { diffDays, formatCivil } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import type { Deadline } from "@/domain/types";

export default function PrazosPage() {
  const url = useUrlState();
  const status = (url.get("status") ?? "abertos") as "abertos" | "proposto" | "confirmado" | "cumprido";
  const deadlines = useCollection("deadlines");
  const cases = useCollection("cases");
  const pubs = useCollection("publications");
  const act = useAction("deadlines");
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<Deadline | null>(null);
  const rows = (deadlines.data ?? []).filter((d) => (status === "abertos" ? d.status !== "cumprido" : d.status === status)).sort((a, b) => (a.confirmedEnd ?? a.proposedEnd).localeCompare(b.confirmedEnd ?? b.proposedEnd));
  const newPubs = (pubs.data ?? []).filter((p) => p.status === "nova").length;

  return (
    <Guard area="prazos">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Prazos" description="Prazo proposto (contagem demonstrativa) × prazo confirmado por profissional. Nenhum algoritmo genérico substitui a conferência."
          actions={<><Link href="/app/publicacoes" className="btn btn-secondary">Publicações {newPubs > 0 && <span className="num rounded-full bg-brand px-1.5 text-xs text-on-brand">{newPubs}</span>}</Link><button className="btn btn-primary" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" /> Novo prazo</button></>} />
        <Chips label="Situação" value={status} onChange={(k) => url.set("status", k === "abertos" ? null : k)} options={[{ key: "abertos", label: "Em aberto" }, { key: "proposto", label: "Aguardando confirmação" }, { key: "confirmado", label: "Confirmados" }, { key: "cumprido", label: "Cumpridos" }]} />
        <Feedback error={act.error} notice={act.notice} />
        <div className="mt-4">
          {deadlines.isPending ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="Nenhum prazo nesta situação" text="Prazos criados a partir de publicações ou manualmente aparecem aqui." /> : (
            <ul className="space-y-3">
              {rows.map((d) => {
                const end = d.confirmedEnd ?? d.proposedEnd;
                const n = diffDays(DEMO_TODAY, end);
                const k = cases.data?.find((c) => c.id === d.caseId);
                return (
                  <li key={d.id} id={d.id} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-sm text-fg-muted"><Link href={`/app/casos/${d.caseId}?aba=prazos`} className="underline underline-offset-2">{k?.title}</Link> · {d.days} dias {d.counting === "uteis" ? "úteis" : "corridos"} desde {formatCivil(d.start)} · {d.court ?? "—"} · calendário {d.calendarVersion ?? "—"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="num">Proposto: {formatCivil(d.proposedEnd)}</span>
                        {d.confirmedEnd && <span className="num">· Confirmado: <strong>{formatCivil(d.confirmedEnd)}</strong> por {userName(d.reviewerId)}</span>}
                        {d.status !== "cumprido" && <Badge tone={n < 0 ? "danger" : n <= 2 ? "danger" : n <= 5 ? "warning" : "neutral"}>{n < 0 ? `Vencido há ${-n} dia(s)` : n === 0 ? "Vence hoje" : `Faltam ${n} dia(s)`}</Badge>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {d.status === "proposto" && <button className="btn btn-primary" onClick={() => setConfirming(d)} data-tour="confirmar-prazo">Conferir e confirmar</button>}
                      {d.status === "confirmado" && <button className="btn btn-secondary" onClick={() => act.run((ctx) => deadlineService.complete(d.id, ctx), "Prazo marcado como cumprido.")}><CheckCircle2 aria-hidden className="size-4" /> Marcar cumprido</button>}
                      {d.status === "cumprido" && <Badge tone="success">Cumprido</Badge>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <NewDeadlineDialog open={creating} onClose={() => setCreating(false)} />
      {confirming && <ConfirmDeadlineDialog d={confirming} onClose={() => setConfirming(null)} />}
    </Guard>
  );
}
