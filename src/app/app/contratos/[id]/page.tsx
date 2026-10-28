"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileSignature, XCircle } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { CONTRACT_STATUS } from "@/modules/commercial/labels";
import { commercialService } from "@/services/mock/ops-repo";
import { formatBRL } from "@/lib/money";
import { formatCivil, formatInstant } from "@/lib/dates";

export default function ContratoPage({ params }: PageProps<"/app/contratos/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const contracts = useCollection("contracts");
  const insts = useCollection("installments");
  const act = useAction("contracts", "installments", "leads", "cases");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const c = contracts.data?.find((x) => x.id === id);
  if (contracts.isPending) return <LoadingBlock />;
  if (!c) return <EmptyState title="Contrato não encontrado" text="" action={<Link href="/app/contratos" className="btn btn-secondary">Voltar</Link>} />;
  const generated = (insts.data ?? []).filter((i) => i.contractId === c.id);
  const signers = [...(c.signers ?? [])].sort((a, b) => a.order - b.order);

  return (
    <Guard area="propostas">
      <div className="mx-auto max-w-[1000px]">
        <PageHeader breadcrumb={[{ href: "/app/contratos", label: "Contratos" }]} title={c.title} description={`Versão ${c.version ?? 1}${c.previousVersionId ? " · substitui versão anterior (preservada)" : ""}`} actions={<><SimulatedBadge label="Assinatura simulada" /><Badge tone={CONTRACT_STATUS[c.status].tone}>{CONTRACT_STATUS[c.status].label}</Badge></>} />
        <p className="mb-4 rounded-[var(--radius-control)] border border-dashed border-accent/60 p-3 text-sm text-accent">Simulação de assinatura: não tem validade jurídica. Integração ZapSign futura usará os mesmos estados.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="panel p-4 text-sm">
            <h2 className="mb-2 font-semibold">Dados congelados no contrato</h2>
            {c.snapshot ? (
              <>
              <dl className="space-y-1">
                <div><dt className="inline text-fg-muted">Contratante: </dt><dd className="inline">{c.snapshot.clientName} · {c.snapshot.document}</dd></div>
                <div><dt className="inline text-fg-muted">Serviço: </dt><dd className="inline">{c.snapshot.service}</dd></div>
                <div><dt className="inline text-fg-muted">Honorários: </dt><dd className="inline">{c.snapshot.feeText}</dd></div>
              </dl>
              <ul className="mt-2 space-y-0.5">{c.snapshot.schedule.map((s) => <li key={s.label} className="num flex justify-between"><span>{s.label} · {formatCivil(s.due)}</span><span>{formatBRL(s.amount)}</span></li>)}</ul>
              </>
            ) : <p className="text-fg-muted">Contrato antigo sem snapshot (importado).</p>}
            <p className="mt-2 text-xs text-fg-muted">Alterar o cadastro do cliente não muda este contrato.</p>
          </section>
          <section className="panel p-4 text-sm" data-tour="signatarios">
            <h2 className="mb-2 font-semibold">Signatários</h2>
            <ol className="space-y-2">
              {signers.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-line p-2">
                  {s.status === "assinado" ? <CheckCircle2 aria-hidden className="size-4 text-success" /> : s.status === "recusado" ? <XCircle aria-hidden className="size-4 text-danger" /> : <Clock aria-hidden className="size-4 text-fg-muted" />}
                  <span className="min-w-0 flex-1"><span className="block font-medium">{s.order}. {s.name}</span><span className="text-fg-muted">{s.role}{s.required ? " · obrigatório" : " · opcional"}{s.signedAt ? ` · ${formatInstant(s.signedAt)}` : ""}</span></span>
                  {(c.status === "enviado" || c.status === "parcial") && s.status === "pendente" && <button className="btn btn-secondary min-h-9" onClick={() => act.run((ctx) => commercialService.sign(c.id, s.id, ctx), (r) => (r.created ? `Contrato concluído: ${r.created} parcela(s) criada(s) no financeiro.` : r.contract.status === "concluido" ? "Contrato concluído." : "Assinatura registrada (simulação)."))}><FileSignature aria-hidden className="size-4" /> Simular assinatura</button>}
                  {s.status === "assinado" && <button className="btn btn-ghost min-h-9 text-xs" onClick={() => act.run((ctx) => commercialService.sign(c.id, s.id, ctx), "Evento repetido ignorado: nada mudou.")}>Reenviar evento</button>}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status === "rascunho" && <button className="btn btn-primary" onClick={() => act.run((ctx) => commercialService.sendForSignature(c.id, ctx))}>Enviar para assinatura (simulação)</button>}
              {(c.status === "enviado" || c.status === "parcial") && <><button className="btn btn-ghost" onClick={() => act.run((ctx) => commercialService.reject(c.id, "recusado", ctx))}>Simular recusa</button><button className="btn btn-ghost" onClick={() => act.run((ctx) => commercialService.reject(c.id, "expirado", ctx))}>Simular expiração</button><button className="btn btn-ghost" onClick={() => setCancelOpen(true)}>Cancelar envio</button></>}
              {(c.status === "recusado" || c.status === "expirado" || c.status === "cancelado") && <button className="btn btn-primary" onClick={async () => { const v = await act.run((ctx) => commercialService.newVersion(c.id, ctx)); if (v) router.push(`/app/contratos/${v.id}`); }}>Corrigir e gerar nova versão</button>}
            </div>
            <Feedback error={act.error} notice={act.notice} />
          </section>
        </div>
        {c.status === "concluido" && (
          <section className="panel mt-5 p-4 text-sm">
            <h2 className="mb-2 font-semibold">Parcelas geradas ({generated.length})</h2>
            <ul className="space-y-1">{generated.map((i) => <li key={i.id} className="num flex justify-between"><Link className="underline underline-offset-2" href={`/app/financeiro?parcela=${i.id}&visao=todas`}>{i.label}</Link><span>{formatCivil(i.due)} · {formatBRL(i.amount)}</span></li>)}</ul>
          </section>
        )}
        <section className="panel mt-5 p-4 text-sm"><h2 className="mb-2 font-semibold">Histórico</h2><ol className="space-y-1 text-fg-muted">{[...(c.history ?? [])].reverse().map((h, i) => <li key={i}>{formatInstant(h.at)} · {userName(h.actorId)} — {h.text}</li>)}</ol></section>
        <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar envio para assinatura?">
          <p className="text-sm">O envelope simulado é encerrado. Assinaturas já registradas ficam no histórico e nenhuma parcela é criada. Depois você pode gerar nova versão.</p>
          <label className="mt-3 block"><span className="label">Motivo (vai para a trilha)</span><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="mt-4 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setCancelOpen(false)}>Voltar</button><button className="btn btn-danger" disabled={reason.trim().length < 5} onClick={async () => { if (await act.run((ctx) => commercialService.cancel(c.id, reason, ctx), "Envio cancelado (simulação).")) { setCancelOpen(false); setReason(""); } }}>Cancelar envio</button></div>
        </Dialog>
      </div>
    </Guard>
  );
}
