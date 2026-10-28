"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Field } from "@/components/form";
import { Feedback, useAction, useUrlState, userName } from "@/modules/shared";
import { DOC_STATUS, EVENT_TYPE, PHASE_LABEL } from "@/modules/cases/labels";
import { createRow, updateRow } from "@/services/mock/generic";
import { portalService } from "@/services/mock/ops-repo";
import { useSession } from "@/components/providers";
import { canApprove } from "@/domain/permissions";
import { formatCnj, isValidCnj } from "@/domain/deadlines";
import { civilFromInstant, formatCivil, formatInstant, formatTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import type { Case, CaseEvent, CourtProcess } from "@/domain/types";

const TABS = ["geral", "processos", "documentos", "tarefas", "prazos", "agenda", "analises", "calculos", "minutas", "financeiro"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = { geral: "Visão geral", processos: "Processos e eventos", documentos: "Documentos", tarefas: "Tarefas", prazos: "Prazos", agenda: "Agenda", analises: "Análises", calculos: "Cálculos", minutas: "Minutas", financeiro: "Financeiro" };

// Endereços públicos configurados por sistema (abrir fonte; não é acesso automatizado).
const PUBLIC_SOURCE: Record<string, string> = { PJe: "https://pje1g.trf1.jus.br/consultapublica/ConsultaPublica/listView.seam", "Meu INSS": "https://meu.inss.gov.br/", "PJe-JT": "https://pje.trt5.jus.br/consultaprocessual/" };

export default function CasoPage({ params }: PageProps<"/app/casos/[id]">) {
  const { id } = use(params);
  const url = useUrlState();
  const tab = (url.get("aba") as (typeof TABS)[number]) ?? "geral";
  const cases = useCollection("cases");
  const clients = useCollection("clients");
  const procs = useCollection("processes");
  const evs = useCollection("caseEvents");
  const docs = useCollection("documents");
  const tasks = useCollection("tasks");
  const deadlines = useCollection("deadlines");
  const events = useCollection("events");
  const analyses = useCollection("pensionAnalyses");
  const drafts = useCollection("drafts");
  const calcs = useCollection("calculations");
  const insts = useCollection("installments");
  const act = useAction("cases", "processes", "caseEvents");
  const [addProc, setAddProc] = useState(false);
  const [addEvent, setAddEvent] = useState<string | null>(null);
  const k = cases.data?.find((x) => x.id === id);
  if (cases.isPending) return <LoadingBlock rows={6} />;
  if (!k) return <EmptyState title="Caso não encontrado" text="Pode pertencer a outro escritório." action={<Link href="/app/casos" className="btn btn-secondary">Voltar</Link>} />;

  const client = clients.data?.find((c) => c.id === k.clientId);
  const my = {
    procs: (procs.data ?? []).filter((p) => p.caseId === id),
    evs: (evs.data ?? []).filter((e) => e.caseId === id).sort((a, b) => b.at.localeCompare(a.at)),
    docs: (docs.data ?? []).filter((d) => d.caseId === id),
    tasks: (tasks.data ?? []).filter((t) => t.caseId === id),
    deadlines: (deadlines.data ?? []).filter((d) => d.caseId === id),
    events: (events.data ?? []).filter((e) => e.caseId === id).sort((a, b) => a.start.localeCompare(b.start)),
    analyses: (analyses.data ?? []).filter((a) => a.caseId === id),
    drafts: (drafts.data ?? []).filter((d) => d.caseId === id),
    calcs: (calcs.data ?? []).filter((c) => c.caseId === id),
    insts: (insts.data ?? []).filter((i) => i.caseId === id),
  };

  return (
    <Guard area="casos">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader breadcrumb={[{ href: "/app/casos", label: "Casos" }]} title={k.title} description={<>{client && <Link className="text-accent underline underline-offset-2" href={`/app/clientes/${client.id}`}>{client.name}</Link>} · {k.area} · {k.service}</>} />
        <section data-tour="resumo-caso" className="panel mb-5 grid grid-cols-2 gap-4 p-4 text-sm sm:grid-cols-4">
          <div><p className="text-fg-muted">Tipo</p><p className="font-medium capitalize">{k.kind}</p></div>
          <div>
            <label className="text-fg-muted" htmlFor="phase">Fase</label>
            <select id="phase" className="field mt-1 min-h-9 text-sm" value={k.phase} onChange={(e) => act.run((ctx) => updateRow("cases", k.id, ctx, (c: Case) => ({ ...c, phase: e.target.value as Case["phase"] }), `Fase: ${e.target.value}`))}>
              {Object.entries(PHASE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><p className="text-fg-muted">Responsável</p><p className="font-medium">{userName(k.ownerId)}</p></div>
          <div><p className="text-fg-muted">Prioridade / sigilo</p><p className="flex flex-wrap gap-1"><Badge tone={k.priority === "alta" ? "danger" : "neutral"}>{k.priority}</Badge>{k.confidential && <Badge tone="warning">Sigiloso</Badge>}</p></div>
        </section>
        <Feedback error={act.error} />

        <label className="mb-4 block sm:hidden"><span className="label">Seção</span>
          <select className="field" value={tab} onChange={(e) => url.set("aba", e.target.value)}>{TABS.map((t) => <option key={t} value={t}>{TAB_LABEL[t]}</option>)}</select>
        </label>
        <div role="tablist" aria-label="Seções do caso" className="mb-5 hidden gap-1 overflow-x-auto border-b border-line sm:flex">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => url.set("aba", t)} className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm ${tab === t ? "border-brand font-medium" : "border-transparent text-fg-muted hover:text-fg"}`}>{TAB_LABEL[t]}</button>)}
        </div>

        <div role="tabpanel">
          {tab === "geral" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <PortalUpdates k={k} />
              <section className="panel p-4 text-sm">
                <h2 className="mb-2 font-semibold">Resumo</h2>
                <ul className="space-y-1">
                  <li>{my.procs.length} processo(s) · {my.evs.length} evento(s)</li>
                  <li>{my.docs.length} documento(s), {my.docs.filter((d) => d.status === "solicitado").length} pendente(s)</li>
                  <li>{my.deadlines.filter((d) => d.status !== "cumprido").length} prazo(s) em aberto</li>
                  <li>{my.tasks.filter((t) => !t.done).length} tarefa(s) em aberto</li>
                </ul>
              </section>
            </div>
          )}

          {tab === "processos" && (
            <div className="space-y-4">
              <button className="btn btn-primary" onClick={() => setAddProc(true)}><Plus aria-hidden className="size-4" /> Vincular processo</button>
              {my.procs.length === 0 && <EmptyState title="Sem processos" text="Casos consultivos podem não ter processo. Vincule quando houver." />}
              {my.procs.map((p) => (
                <section key={p.id} className="panel p-4 text-sm">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h2 className="num font-semibold">{p.cnj ?? p.adminNumber}</h2>
                      <p className="text-fg-muted">{p.court} · {p.system} · {p.instance} · {p.venue}</p>
                      <p className="text-fg-muted">{p.className} — {p.subject}</p>
                    </div>
                    <Badge tone={p.syncStatus === "importado" ? "info" : "neutral"}>{p.syncStatus === "importado" ? "Importado de relatório" : p.syncStatus === "manual" ? "Registro manual" : "Conector planejado"}</Badge>
                    {PUBLIC_SOURCE[p.system] && <a className="btn btn-secondary min-h-9" href={PUBLIC_SOURCE[p.system]} target="_blank" rel="noopener noreferrer">Consultar fonte <ExternalLink aria-hidden className="size-3.5" /></a>}
                  </div>
                  <p className="mt-2 text-xs text-fg-muted">Sem monitoramento em tempo real. Última coleta: {p.lastSync ? formatInstant(p.lastSync) : "—"}</p>
                  <h3 className="mb-2 mt-4 font-medium">Andamentos</h3>
                  <ol className="space-y-2">
                    {my.evs.filter((e) => e.processId === p.id).map((e) => (
                      <li key={e.id} className="rounded-[var(--radius-control)] border border-line p-3">
                        <p className="num text-xs text-fg-muted">Evento {formatInstant(e.at)} · coletado {formatInstant(e.collectedAt)} · {e.source}{e.externalId ? ` · id ${e.externalId}` : ""}</p>
                        <p>{e.text}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {e.reviewed ? <Badge tone="success">Revisado</Badge> : <><Badge tone="warning">Não revisado</Badge><button className="btn btn-ghost min-h-8 text-xs" onClick={() => act.run((ctx) => updateRow("caseEvents", e.id, ctx, (x: CaseEvent) => ({ ...x, reviewed: true }), "Andamento revisado"))}>Marcar revisado</button></>}
                        </div>
                      </li>
                    ))}
                  </ol>
                  <button className="btn btn-ghost mt-2 min-h-9" onClick={() => setAddEvent(p.id)}><Plus aria-hidden className="size-4" /> Registrar andamento manual</button>
                </section>
              ))}
            </div>
          )}

          {tab === "documentos" && <SimpleList empty="Sem documentos" items={my.docs.map((d) => ({ id: d.id, title: d.name, meta: d.type, right: <Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>, href: `/app/documentos/${d.id}` }))} action={<Link href={`/app/documentos?cliente=${k.clientId}`} className="btn btn-secondary">Abrir documentos</Link>} />}
          {tab === "tarefas" && <SimpleList empty="Sem tarefas" items={my.tasks.map((t) => ({ id: t.id, title: t.title, meta: `${formatCivil(t.due)} · ${userName(t.assigneeId)}`, right: <Badge tone={t.done ? "success" : "neutral"}>{t.done ? "Concluída" : "Aberta"}</Badge>, href: `/app/tarefas?id=${t.id}` }))} />}
          {tab === "prazos" && <SimpleList empty="Sem prazos" items={my.deadlines.map((d) => ({ id: d.id, title: d.title, meta: `${d.days} dias ${d.counting} · vence ${formatCivil(d.confirmedEnd ?? d.proposedEnd)}`, right: <Badge tone={d.status === "proposto" ? "warning" : d.status === "confirmado" ? "info" : "success"}>{d.status === "proposto" ? "Aguarda confirmação" : d.status === "confirmado" ? "Confirmado" : "Cumprido"}</Badge>, href: `/app/prazos?id=${d.id}` }))} />}
          {tab === "agenda" && <SimpleList empty="Sem compromissos" items={my.events.map((e) => ({ id: e.id, title: e.title, meta: `${formatCivil(civilFromInstant(e.start))} ${formatTime(e.start)} · ${e.location}`, right: <Badge tone={EVENT_TYPE[e.type].tone}>{EVENT_TYPE[e.type].label}</Badge>, href: `/app/agenda?data=${civilFromInstant(e.start)}` }))} />}
          {tab === "analises" && <SimpleList empty="Sem análises" items={my.analyses.map((a) => ({ id: a.id, title: a.benefit, meta: a.regime, right: null, href: `/app/previdenciario/analises/${a.id}` }))} />}
          {tab === "calculos" && <SimpleList empty="Sem cálculos vinculados" items={my.calcs.map((c) => ({ id: c.id, title: c.title, meta: `${c.area} · ${c.model}`, right: <Badge tone={c.status === "revisado" ? "success" : "warning"}>{c.status === "revisado" ? "Revisado" : c.status === "aguardando_revisao" ? "Aguardando revisão" : "Rascunho"}</Badge>, href: `/app/calculos/${c.id}` }))} />}
          {tab === "minutas" && <SimpleList empty="Sem minutas" items={my.drafts.map((d) => ({ id: d.id, title: d.title, meta: d.kind, right: <Badge>{d.status}</Badge>, href: `/app/minutas/${d.id}` }))} action={<Link href={`/app/minutas?novo=1&caso=${k.id}`} className="btn btn-secondary">Nova minuta</Link>} />}
          {tab === "financeiro" && <SimpleList empty="Sem parcelas" items={my.insts.map((i) => ({ id: i.id, title: i.label, meta: `vence ${formatCivil(i.due)}`, right: <span className="num">{formatBRL(i.amount - i.paid)}</span>, href: `/app/financeiro?parcela=${i.id}` }))} />}
        </div>
      </div>

      <ProcessDialog open={addProc} caseId={k.id} onClose={() => setAddProc(false)} />
      {addEvent && <EventDialog processId={addEvent} caseId={k.id} onClose={() => setAddEvent(null)} />}
    </Guard>
  );
}

function SimpleList({ items, empty, action }: { items: { id: string; title: string; meta: string; right: React.ReactNode; href: string }[]; empty: string; action?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {action}
      {items.length === 0 ? <EmptyState title={empty} text="Nada registrado para este caso." /> : (
        <ul className="panel divide-y divide-line">
          {items.map((i) => <li key={i.id}><Link href={i.href} className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-surface-muted/50"><span className="min-w-0 flex-1"><span className="block font-medium">{i.title}</span><span className="text-fg-muted">{i.meta}</span></span>{i.right}</Link></li>)}
        </ul>
      )}
    </div>
  );
}

function ProcessDialog({ open, caseId, onClose }: { open: boolean; caseId: string; onClose: () => void }) {
  const act = useAction("processes");
  const [judicial, setJudicial] = useState(true);
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const errors: Record<string, string> = {};
    if (judicial && !isValidCnj(f.number)) errors.number = "Número CNJ inválido (confira o dígito verificador).";
    if (!judicial && !f.number.trim()) errors.number = "Informe o número administrativo.";
    if (!f.court.trim()) errors.court = "Informe o tribunal ou órgão.";
    setErr(errors);
    if (Object.keys(errors).length) return document.getElementById(`f-${Object.keys(errors)[0]}`)?.focus();
    const row: Omit<CourtProcess, "id" | "organizationId"> = { caseId, cnj: judicial ? formatCnj(f.number) : undefined, adminNumber: judicial ? undefined : f.number.trim(), court: f.court, system: f.system, instance: f.instance, venue: f.venue, className: f.className, subject: f.subject, syncStatus: "manual" };
    if (await act.run((ctx) => createRow("processes", row, ctx, "Processo vinculado"))) onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Vincular processo" wide>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div role="radiogroup" aria-label="Natureza" className="inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm">
          <button type="button" role="radio" aria-checked={judicial} onClick={() => setJudicial(true)} className={`rounded-md px-3 py-1.5 ${judicial ? "bg-brand text-on-brand" : "text-fg-muted"}`}>Judicial (CNJ)</button>
          <button type="button" role="radio" aria-checked={!judicial} onClick={() => setJudicial(false)} className={`rounded-md px-3 py-1.5 ${!judicial ? "bg-brand text-on-brand" : "text-fg-muted"}`}>Administrativo</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="number" label={judicial ? "Número CNJ" : "Número administrativo"} error={err.number} hint={judicial ? "NNNNNNN-DD.AAAA.J.TR.OOOO" : "Formato livre (ex.: protocolo INSS)"}>{(p) => <input {...p} name="number" className="field num" inputMode={judicial ? "numeric" : "text"} />}</Field>
          <Field name="court" label="Tribunal/órgão" error={err.court}>{(p) => <input {...p} name="court" className="field" defaultValue={judicial ? "TRF1" : "INSS"} />}</Field>
          <Field name="system" label="Sistema">{(p) => <select {...p} name="system" className="field">{["PJe", "eproc", "e-SAJ", "Meu INSS", "CRPS", "PJe-JT", "Outro"].map((s) => <option key={s}>{s}</option>)}</select>}</Field>
          <Field name="instance" label="Grau/instância">{(p) => <input {...p} name="instance" className="field" defaultValue="1º grau" />}</Field>
          <Field name="venue" label="Vara/comarca/APS">{(p) => <input {...p} name="venue" className="field" />}</Field>
          <Field name="className" label="Classe">{(p) => <input {...p} name="className" className="field" />}</Field>
          <Field name="subject" label="Assunto">{(p) => <input {...p} name="subject" className="field" />}</Field>
        </div>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={act.pending}>Vincular</button></div>
      </form>
    </Dialog>
  );
}

function EventDialog({ processId, caseId, onClose }: { processId: string; caseId: string; onClose: () => void }) {
  const act = useAction("caseEvents");
  const [text, setText] = useState("");
  const [date, setDate] = useState("2026-10-26");
  return (
    <Dialog open onClose={onClose} title="Registrar andamento manual">
      <div className="space-y-3">
        <label className="block"><span className="label">Data do evento</span><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="block"><span className="label">Descrição</span><textarea rows={3} className="field py-2" value={text} onChange={(e) => setText(e.target.value)} /></label>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!text.trim() || act.pending} onClick={async () => {
            const row = { caseId, processId, at: `${date}T12:00:00-03:00`, collectedAt: new Date().toISOString(), source: "Registro manual", text: text.trim(), reviewed: true };
            if (await act.run((ctx) => createRow("caseEvents", row, ctx, "Andamento manual"))) onClose();
          }}>Registrar</button>
        </div>
      </div>
    </Dialog>
  );
}

/** FLUXO G: equipe escreve em linguagem simples; só o que for publicado aparece no portal. */
function PortalUpdates({ k }: { k: Case }) {
  const { user } = useSession();
  const act = useAction("cases");
  const [text, setText] = useState("");
  const [next, setNext] = useState("");
  const pending = (k.portalUpdates ?? []).filter((u) => !u.publishedAt);
  const published = (k.portalUpdates ?? []).filter((u) => u.publishedAt).reverse();
  return (
    <section className="panel space-y-3 p-4 text-sm" data-tour="portal-atualizacao">
      <h2 className="font-semibold">Portal do cliente</h2>
      <div className="rounded-[var(--radius-control)] border border-line p-3"><p className="text-xs text-fg-muted">O cliente vê agora</p><p>{k.portalStatus}</p><p className="mt-1 text-fg-muted">Próximo passo: {k.portalNextStep}</p></div>
      {pending.map((u) => (
        <div key={u.id} className="rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg/40 p-3">
          <p className="text-xs text-warning">Rascunho interno — o cliente NÃO vê</p>
          <p>{u.text}</p><p className="text-fg-muted">Próximo passo: {u.nextStep}</p>
          {user && canApprove(user.role) ? <button className="btn btn-primary mt-2 min-h-9" onClick={() => act.run((ctx) => portalService.publish(k.id, u.id, ctx), "Publicado no portal do cliente.")}>Publicar no portal</button> : <p className="mt-1 text-xs text-fg-muted">Aguardando advogado(a) publicar.</p>}
        </div>
      ))}
      <details>
        <summary className="cursor-pointer font-medium">Escrever atualização para o cliente</summary>
        <div className="mt-2 space-y-2">
          <label className="block"><span className="label">O que aconteceu (linguagem simples, sem promessa de resultado)</span><textarea rows={2} className="field py-2" value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label className="block"><span className="label">Próximo passo para o cliente</span><input className="field" value={next} onChange={(e) => setNext(e.target.value)} /></label>
          <button className="btn btn-secondary" disabled={act.pending} onClick={async () => { if (await act.run((ctx) => portalService.draft(k.id, text, next, ctx), "Rascunho salvo. Ainda não está visível ao cliente.")) { setText(""); setNext(""); } }}>Salvar rascunho</button>
        </div>
      </details>
      <Feedback error={act.error} notice={act.notice} />
      {published.length > 0 && <ol className="space-y-1 border-l border-line pl-3 text-fg-muted">{published.map((u) => <li key={u.id}>{formatInstant(u.publishedAt!)} · {userName(u.publishedBy)} publicou: {u.text}</li>)}</ol>}
    </section>
  );
}
