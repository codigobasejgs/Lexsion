"use client";

import Link from "next/link";
import { useState } from "react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { NewDeadlineDialog } from "@/modules/deadlines/deadline-dialogs";
import { deadlineService } from "@/services/mock/ops-repo";
import { formatCivil } from "@/lib/dates";
import type { Publication } from "@/domain/types";

const ST = { nova: { label: "Nova", tone: "warning" }, triada: { label: "Triada", tone: "info" }, prazo_criado: { label: "Prazo criado", tone: "success" }, descartada: { label: "Descartada", tone: "neutral" } } as const;

export default function PublicacoesPage() {
  const pubs = useCollection("publications");
  const cases = useCollection("cases");
  const act = useAction("publications");
  const [forDeadline, setForDeadline] = useState<Publication | null>(null);
  const [discarding, setDiscarding] = useState<Publication | null>(null);
  const [note, setNote] = useState("");

  return (
    <Guard area="prazos">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader breadcrumb={[{ href: "/app/prazos", label: "Prazos" }]} title="Publicações e intimações" description="Triagem humana: criar prazo proposto (sempre revisado) ou descartar com motivo. Amostras de demonstração — sem captura real de diários." />
        <Feedback error={act.error} notice={act.notice} />
        {pubs.isPending ? <LoadingBlock /> : !pubs.data?.length ? <EmptyState title="Sem publicações" text="Publicações importadas aparecerão aqui." /> : (
          <ul className="mt-4 space-y-3">
            {pubs.data.map((p) => {
              const k = cases.data?.find((c) => c.id === p.caseId);
              return (
                <li key={p.id} className="panel p-4 text-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="num text-fg-muted">{formatCivil(p.publishedOn)} · {p.source}</span>
                    <Badge tone={ST[p.status].tone}>{ST[p.status].label}</Badge>
                    {k ? <Link className="text-accent underline underline-offset-2" href={`/app/casos/${k.id}`}>{k.title}</Link> : <Badge tone="warning">Sem caso vinculado</Badge>}
                  </div>
                  <p className="rounded-[var(--radius-control)] bg-surface-muted p-3 font-serif">{p.text}</p>
                  {p.triageNote && <p className="mt-2 text-fg-muted">Triagem: {p.triageNote}</p>}
                  {p.status === "nova" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {k && <button className="btn btn-primary" onClick={() => setForDeadline(p)}>Criar prazo proposto</button>}
                      <button className="btn btn-secondary" onClick={() => act.run((ctx) => deadlineService.triage(p.id, "triada", "Lida; sem prazo.", ctx), "Publicação triada.")}>Marcar como lida, sem prazo</button>
                      <button className="btn btn-ghost" onClick={() => { setDiscarding(p); setNote(""); }}>Descartar</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {forDeadline && <NewDeadlineDialog open onClose={() => setForDeadline(null)} caseId={forDeadline.caseId} publicationId={forDeadline.id} defaults={{ title: "Prazo da intimação", days: 5, start: forDeadline.publishedOn }} />}
      <Dialog open={!!discarding} onClose={() => setDiscarding(null)} title="Descartar publicação">
        <label className="block"><span className="label">Motivo</span><input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: homônimo" /></label>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setDiscarding(null)}>Cancelar</button>
          <button className="btn btn-danger" onClick={async () => { if (discarding && (await act.run((ctx) => deadlineService.triage(discarding.id, "descartada", note, ctx), "Publicação descartada."))) setDiscarding(null); }}>Descartar</button>
        </div>
      </Dialog>
    </Guard>
  );
}
