"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction, useLive, userName } from "@/modules/shared";
import { ProposalForm } from "@/modules/commercial/proposal-form";
import { FEE_KIND, PROPOSAL_STATUS } from "@/modules/commercial/labels";
import { commercialService } from "@/services/mock/ops-repo";
import { canApprove } from "@/domain/permissions";
import { formatBRL } from "@/lib/money";
import { formatCivil, formatInstant } from "@/lib/dates";

export default function PropostaPage({ params }: PageProps<"/app/propostas/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useSession();
  const live = useLive();
  const props = useCollection("proposals");
  const clients = useCollection("clients");
  const leads = useCollection("leads");
  const act = useAction("proposals", "contracts");
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState("");
  const p = props.data?.find((x) => x.id === id);
  if (props.isPending) return <LoadingBlock />;
  if (!p) return <EmptyState title="Proposta não encontrada" text="" action={<Link href="/app/propostas" className="btn btn-secondary">Voltar</Link>} />;
  const lead = leads.data?.find((l) => l.id === p.leadId);
  const suggestedClient = p.clientId ?? lead?.clientId ?? "";
  const editable = !["aceita", "recusada"].includes(p.status) && !p.contractId;

  return (
    <Guard area="propostas">
      <div className="mx-auto max-w-[1000px]">
        <PageHeader breadcrumb={[{ href: "/app/propostas", label: "Propostas" }]} title={p.title} description={`${p.service} · v${p.version} · validade ${formatCivil(p.validUntil)}`} actions={<Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label}</Badge>} />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="panel space-y-3 p-4 text-sm">
            <p>{p.scope}</p>
            <p><span className="text-fg-muted">Honorários:</span> {FEE_KIND[p.feeKind]}{p.successPercent ? ` · êxito ${p.successPercent}% sobre ${p.successBase}` : ""}</p>
            {p.schedule.length > 0 && (
              <table className="w-full text-sm"><caption className="sr-only">Cronograma</caption>
                <thead className="text-left text-xs uppercase text-fg-muted"><tr><th className="py-1">Parcela</th><th>Vencimento</th><th className="text-right">Valor</th></tr></thead>
                <tbody>{p.schedule.map((s) => <tr key={s.label} className="border-t border-line"><td className="py-1.5">{s.label}</td><td className="num">{formatCivil(s.due)}</td><td className="num text-right">{formatBRL(s.amount)}</td></tr>)}
                  <tr className="border-t border-line font-semibold"><td className="py-1.5">Total</td><td /><td className="num text-right">{formatBRL(p.total)}</td></tr></tbody>
              </table>
            )}
            {editable && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Editar (nova versão)</button>}
          </section>
          <aside className="space-y-4">
            <section className="panel space-y-2 p-4 text-sm" data-tour="fluxo-proposta">
              <h2 className="font-semibold">Fluxo</h2>
              {p.status === "rascunho" && <button className="btn btn-secondary w-full" onClick={() => act.run((ctx) => commercialService.setProposalStatus(p.id, "em_revisao", ctx))}>Enviar para revisão</button>}
              {p.status === "em_revisao" && user && canApprove(user.role) && <button className="btn btn-primary w-full" onClick={() => act.run((ctx) => commercialService.setProposalStatus(p.id, "aprovada", ctx))}>Aprovar</button>}
              {p.status === "aprovada" && <button className="btn btn-primary w-full" onClick={() => act.run((ctx) => commercialService.setProposalStatus(p.id, "enviada", ctx), "Marcada como enviada (simulação — nada foi enviado).")}>Enviar ao cliente (simulação)</button>}
              {p.status === "enviada" && <>
                <div className="flex items-center gap-2">{live ? <span className="text-fg-muted">Registrar a resposta do cliente (recebida por e-mail, telefone ou pessoalmente)</span> : <><SimulatedBadge /><span className="text-fg-muted">resposta do cliente</span></>}</div>
                <button className="btn btn-primary w-full" onClick={() => act.run((ctx) => commercialService.setProposalStatus(p.id, "aceita", ctx))}>{live ? "Cliente aceitou" : "Simular aceite"}</button>
                <button className="btn btn-ghost w-full" onClick={() => act.run((ctx) => commercialService.setProposalStatus(p.id, "recusada", ctx))}>{live ? "Cliente recusou" : "Simular recusa"}</button>
              </>}
              {p.status === "aceita" && !p.contractId && (
                <div className="space-y-2">
                  <label className="block"><span className="label">Cliente contratante</span>
                    <select className="field" value={clientId || suggestedClient} onChange={(e) => setClientId(e.target.value)}><option value="">Escolha…</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  </label>
                  {!suggestedClient && lead && <Link className="text-accent underline underline-offset-2" href={`/app/crm/leads/${lead.id}`}>Converter o lead em cliente primeiro</Link>}
                  <button className="btn btn-primary w-full" disabled={!(clientId || suggestedClient)} onClick={async () => { const c = await act.run((ctx) => commercialService.createContract(p.id, clientId || suggestedClient, ctx)); if (c) router.push(`/app/contratos/${c.id}`); }}>Gerar contrato</button>
                </div>
              )}
              {p.contractId && <Link className="btn btn-secondary w-full" href={`/app/contratos/${p.contractId}`}>Abrir contrato</Link>}
              <Feedback error={act.error} notice={act.notice} />
            </section>
            <section className="panel p-4 text-sm"><h2 className="mb-2 font-semibold">Histórico</h2><ol className="space-y-1 text-fg-muted">{[...p.history].reverse().map((h, i) => <li key={i}>{formatInstant(h.at)} · {userName(h.actorId)} — {h.text}</li>)}</ol></section>
          </aside>
        </div>
      </div>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar proposta" wide><ProposalForm p={p} onSaved={() => setEditing(false)} /></Dialog>
    </Guard>
  );
}
