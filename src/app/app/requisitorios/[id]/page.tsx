"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { REQ_ORDER, REQ_STATUS } from "@/modules/requisitions/labels";
import { updateRow } from "@/services/mock/generic";
import { canApprove } from "@/domain/permissions";
import { formatBRL } from "@/lib/money";
import { formatInstant } from "@/lib/dates";
import type { Requisition } from "@/domain/types";

export default function RequisitorioPage({ params }: PageProps<"/app/requisitorios/[id]">) {
  const { id } = use(params);
  const { user } = useSession();
  const reqs = useCollection("requisitions");
  const clients = useCollection("clients");
  const act = useAction("requisitions");
  const [status, setStatus] = useState<Requisition["status"] | "">("");
  const [note, setNote] = useState("");
  const r = reqs.data?.find((x) => x.id === id);
  if (reqs.isPending) return <LoadingBlock />;
  if (!r) return <EmptyState title="Requisitório não encontrado" text="" action={<Link href="/app/requisitorios" className="btn btn-secondary">Voltar</Link>} />;
  const needsHuman = status === "liberado" || status === "conferencia";

  return (
    <Guard area="requisitorios">
      <div className="mx-auto max-w-[1000px]">
        <PageHeader breadcrumb={[{ href: "/app/requisitorios", label: "RPV e precatórios" }]} title={`${r.kind} · ${r.number}`} description={clients.data?.find((c) => c.id === r.clientId)?.name} actions={<Badge tone={REQ_STATUS[r.status].tone}>{REQ_STATUS[r.status].label}</Badge>} />
        <section className="panel mb-5 grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[["Tribunal", r.court], ["Ente devedor", r.debtor], ["Processo de origem", r.originProcess], ["Natureza", r.nature], ["Exercício", r.fiscalYear ?? "—"], ["Prioridade informada", r.priority ?? "—"], ["Valor informado", formatBRL(r.informedAmount)], ["Honorários destacados", formatBRL(r.fees)], ["Fonte / última consulta", `${r.source} · ${r.lastCheck ? formatInstant(r.lastCheck) : "—"}`]].map(([k, v]) => (
            <div key={String(k)}><p className="text-fg-muted">{k}</p><p className="num font-medium [overflow-wrap:anywhere]">{v}</p></div>
          ))}
        </section>
        {r.forecast && <p className="mb-5 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning">{r.forecast}</p>}
        <section className="panel space-y-3 p-4 text-sm">
          <h2 className="font-semibold">Atualizar situação</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <label className="block"><span className="label">Nova situação</span><select className="field" value={status} onChange={(e) => setStatus(e.target.value as Requisition["status"])}><option value="">Escolha…</option>{REQ_ORDER.map((s) => <option key={s} value={s}>{REQ_STATUS[s].label}</option>)}</select></label>
            <label className="block"><span className="label">Observação e fonte</span><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <button className="btn btn-primary" disabled={!status || !note.trim() || (needsHuman && !(user && canApprove(user.role)))} onClick={async () => { if (await act.run((ctx) => updateRow("requisitions", r.id, ctx, (x: Requisition) => ({ ...x, status: status as Requisition["status"], lastCheck: new Date().toISOString(), history: [...x.history, { at: new Date().toISOString(), actorId: ctx.actorId, status: String(status), note }] }), `Requisitório: ${status}`))) { setStatus(""); setNote(""); } }}>Registrar</button>
          </div>
          {needsHuman && <p className="text-fg-muted">Conferência/liberação exige advogado(a) ou administrador. Associar pagamento à requisição só após conferência humana.</p>}
          <Feedback error={act.error} />
        </section>
        <section className="panel mt-5 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Trilha</h2>
          <ol className="space-y-2 border-l border-line pl-4">{[...r.history].reverse().map((h, i) => <li key={i}><p className="num text-xs text-fg-muted">{formatInstant(h.at)} · {userName(h.actorId)}</p><p><strong>{REQ_STATUS[h.status as Requisition["status"]]?.label ?? h.status}</strong> — {h.note}</p></li>)}</ol>
        </section>
      </div>
    </Guard>
  );
}
