"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertOctagon, ArrowRight, Banknote, CalendarClock, Check, FileWarning, Gavel, ListTodo, MessagesSquare, TrendingUp } from "lucide-react";
import { useCollection, useInvalidate, useSession } from "@/components/providers";
import { Badge, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui";
import { InstallCard } from "@/components/pwa";
import { DEMO_TODAY } from "@/mocks/clock";
import { civilFromInstant, diffDays, formatCivil, formatCivilLong, formatTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { can } from "@/domain/permissions";
import { tasksService } from "@/services/mock/repo";
import { people as users } from "@/components/people";

type Kind = "juridico" | "tarefa" | "atendimento" | "comercial" | "financeiro";
interface Action {
  id: string;
  kind: Kind;
  title: string;
  reason: string;
  next: string;
  href: string;
  urgency: number; // menor = mais urgente
  ownerId?: string;
}

const KIND_META: Record<Kind, { label: string; icon: React.ElementType; tone: "danger" | "info" | "warning" | "brand" | "neutral" }> = {
  juridico: { label: "Prazo jurídico", icon: Gavel, tone: "danger" },
  tarefa: { label: "Tarefa", icon: ListTodo, tone: "neutral" },
  atendimento: { label: "Atendimento", icon: MessagesSquare, tone: "info" },
  comercial: { label: "Prioridade comercial", icon: TrendingUp, tone: "warning" },
  financeiro: { label: "Financeiro", icon: Banknote, tone: "brand" },
};

function relDay(d: string) {
  const n = diffDays(DEMO_TODAY, d);
  if (n < 0) return `venceu há ${-n} dia${n === -1 ? "" : "s"}`;
  if (n === 0) return "vence hoje";
  if (n === 1) return "vence amanhã";
  return `vence em ${n} dias (${formatCivil(d)})`;
}

export default function MeuDiaPage() {
  const { user, org, ctx, mode } = useSession();
  const params = useSearchParams();
  const router = useRouter();
  const invalidate = useInvalidate();
  const filter = (params.get("tipo") as Kind | null) ?? null;
  const mine = params.get("meus") === "1";
  const [busy, setBusy] = useState<string | null>(null);

  const tasks = useCollection("tasks");
  const deadlines = useCollection("deadlines");
  const events = useCollection("events");
  const convs = useCollection("conversations");
  const insts = useCollection("installments");
  const docs = useCollection("documents");
  const cases = useCollection("cases");
  const clients = useCollection("clients");
  const pubs = useCollection("publications");
  const proposals = useCollection("proposals");

  const role = user?.role ?? "estagiario";
  const loading = [tasks, deadlines, events, convs, insts, docs, cases].some((q) => q.isPending);
  const error = [tasks, deadlines, events, convs, insts, docs, cases].find((q) => q.isError);

  const caseTitle = (id?: string) => cases.data?.find((c) => c.id === id)?.title ?? "";
  const clientName = (id?: string) => clients.data?.find((c) => c.id === id)?.name ?? "";

  const actions = useMemo<Action[]>(() => {
    const out: Action[] = [];
    for (const d of deadlines.data ?? []) {
      if (d.status === "cumprido") continue;
      const end = d.confirmedEnd ?? d.proposedEnd;
      const n = diffDays(DEMO_TODAY, end);
      if (n > 10) continue;
      const k = cases.data?.find((c) => c.id === d.caseId);
      out.push({
        id: d.id, kind: "juridico", title: d.title, ownerId: k?.ownerId,
        reason: `${caseTitle(d.caseId)} · ${relDay(end)}${d.status === "proposto" ? " · prazo proposto, falta confirmação profissional" : ""}`,
        next: d.status === "proposto" ? "Conferir contagem e confirmar" : "Preparar e protocolar",
        href: `/app/casos/${d.caseId}?aba=prazos`, urgency: n - (d.status === "proposto" ? 0.5 : 0),
      });
    }
    if (can(role, "atendimento"))
      for (const c of convs.data ?? []) {
        if (c.status !== "aguardando_equipe" && !(c.status === "ia" && c.unread)) continue;
        out.push({
          id: c.id, kind: "atendimento", title: `${c.contactName} aguarda resposta`, ownerId: c.assigneeId,
          reason: c.aiActive ? "Assistente virtual ativa · pergunta precisa de pessoa da equipe" : "Atendimento humano em andamento",
          next: c.aiActive ? "Assumir atendimento" : "Responder", href: `/app/atendimento/${c.id}`, urgency: 0.2,
        });
      }
    for (const t of tasks.data ?? []) {
      if (t.done) continue;
      const n = diffDays(DEMO_TODAY, t.due);
      if (n > 3) continue;
      out.push({
        id: t.id, kind: "tarefa", title: t.title, ownerId: t.assigneeId,
        reason: `${relDay(t.due)}${t.priority === "alta" ? " · prioridade alta" : ""}${t.caseId ? ` · ${caseTitle(t.caseId)}` : ""}`,
        next: "Abrir cliente", href: t.clientId ? `/app/clientes/${t.clientId}?aba=tarefas` : "/app/inicio", urgency: n + (t.priority === "alta" ? 0 : 1),
      });
    }
    if (can(role, "documentos") || can(role, "clientes"))
      for (const d of docs.data ?? []) {
        if (d.status !== "solicitado" && d.status !== "precisa_revisar") continue;
        out.push({
          id: d.id, kind: "comercial", title: d.status === "solicitado" ? `Documento pendente: ${d.name}` : `Revisar: ${d.name}`,
          reason: `${clientName(d.clientId)} · ${d.status === "solicitado" ? "solicitado ao cliente" : "extração precisa de revisão"}`,
          next: d.status === "solicitado" ? "Lembrar o cliente" : "Revisar extração", href: d.type === "CNIS" ? "/app/previdenciario/analises/pa-joao" : `/app/clientes/${d.clientId}?aba=documentos`, urgency: 3,
        });
      }
    if (can(role, "prazos"))
      for (const p of pubs.data ?? []) {
        if (p.status !== "nova") continue;
        out.push({ id: p.id, kind: "juridico", title: `Publicação nova: ${p.source}`, reason: `${formatCivil(p.publishedOn)}${p.caseId ? ` · ${caseTitle(p.caseId)}` : " · sem caso vinculado"}`, next: "Triar publicação", href: "/app/publicacoes", urgency: 1 });
      }
    if (can(role, "propostas"))
      for (const p of proposals.data ?? []) {
        if (p.status !== "enviada") continue;
        out.push({ id: p.id, kind: "comercial", title: `Proposta aguardando retorno: ${p.title}`, reason: `Válida até ${formatCivil(p.validUntil)}`, next: "Acompanhar retorno", href: `/app/propostas/${p.id}`, urgency: 2.5 });
      }
    if (can(role, "financeiro"))
      for (const i of insts.data ?? []) {
        if (i.status === "paga" || i.status === "cancelada") continue;
        const n = diffDays(DEMO_TODAY, i.due);
        if (n > 7) continue;
        out.push({
          id: i.id, kind: "financeiro", title: `${i.label} — ${clientName(i.clientId)}`,
          reason: `Saldo ${formatBRL(i.amount - i.paid)} · ${relDay(i.due)}`,
          next: n < 0 ? "Registrar pagamento ou renegociar" : "Acompanhar recebimento", href: `/app/financeiro?parcela=${i.id}`, urgency: n + 2,
        });
      }
    return out.sort((a, b) => a.urgency - b.urgency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlines.data, convs.data, tasks.data, docs.data, insts.data, cases.data, clients.data, pubs.data, proposals.data, role]);

  const visible = actions.filter((a) => (!filter || a.kind === filter) && (!mine || a.ownerId === user?.id));
  const todayEvents = (events.data ?? []).filter((e) => civilFromInstant(e.start) === DEMO_TODAY).sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = (events.data ?? []).filter((e) => { const d = civilFromInstant(e.start); return d > DEMO_TODAY && diffDays(DEMO_TODAY, d) <= 10; }).sort((a, b) => a.start.localeCompare(b.start));

  const counts = (k: Kind) => actions.filter((a) => a.kind === k).length;
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`/app/inicio${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  const completeTask = async (id: string) => {
    if (!ctx) return;
    setBusy(id);
    await tasksService.toggle(id, ctx);
    await invalidate("tasks");
    setBusy(null);
  };

  const first = user?.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={`Olá, ${first}`}
        description={<>Hoje é {formatCivilLong(DEMO_TODAY)} {mode === "demo" && <span className="text-xs">(data de referência da demo)</span>} · {org?.name}</>}
      />

      {error && <ErrorBlock message="Não foi possível carregar seus dados locais. Seus registros continuam neste dispositivo." retry={() => error.refetch()} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="acoes-title" data-tour="meu-dia-lista" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="acoes-title" className="text-lg font-semibold">O que precisa da sua atenção</h2>
            <label className="flex min-h-10 items-center gap-2 text-sm text-fg-muted">
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={mine} onChange={(e) => setParam("meus", e.target.checked ? "1" : null)} />
              Só os meus
            </label>
          </div>

          <div data-tour="filtros-meu-dia" role="group" aria-label="Filtrar por tipo" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            <button onClick={() => setParam("tipo", null)} aria-pressed={!filter} className={`btn min-h-9 shrink-0 rounded-full px-3 ${!filter ? "btn-primary" : "btn-secondary"}`}>
              Tudo <span className="num">{actions.length}</span>
            </button>
            {(Object.keys(KIND_META) as Kind[]).filter((k) => counts(k) > 0).map((k) => {
              const M = KIND_META[k];
              return (
                <button key={k} onClick={() => setParam("tipo", filter === k ? null : k)} aria-pressed={filter === k} className={`btn min-h-9 shrink-0 rounded-full px-3 ${filter === k ? "btn-primary" : "btn-secondary"}`}>
                  <M.icon aria-hidden className="size-4" /> {M.label} <span className="num">{counts(k)}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <LoadingBlock rows={5} />
          ) : visible.length === 0 ? (
            <div className="panel flex flex-col items-center gap-2 p-8 text-center">
              <Check aria-hidden className="size-8 text-success" />
              <p className="font-medium">Nada pendente {filter ? "neste filtro" : "para hoje"}</p>
              <p className="text-sm text-fg-muted">Aproveite para revisar a agenda dos próximos dias.</p>
              <Link href="/app/agenda" className="btn btn-secondary mt-2">Abrir agenda</Link>
            </div>
          ) : (
            <ul className="panel divide-y divide-line">
              {visible.map((a) => {
                const M = KIND_META[a.kind];
                const owner = users.find((u) => u.id === a.ownerId);
                const isTask = (tasks.data ?? []).some((t) => t.id === a.id);
                return (
                  <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span aria-hidden className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border ${a.urgency < 1 && a.kind !== "atendimento" ? "border-danger/40 bg-danger-bg text-danger" : "border-line bg-surface-muted text-fg-muted"}`}>
                        {a.urgency < 1 && a.kind !== "atendimento" ? <AlertOctagon className="size-4" /> : <M.icon className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium [overflow-wrap:anywhere]">{a.title}</p>
                        <p className="text-sm text-fg-muted [overflow-wrap:anywhere]">{a.reason}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge tone={M.tone} iconAs={M.icon}>{M.label}</Badge>
                          {a.urgency < 0 && <Badge tone="danger" iconAs={AlertOctagon}>Atrasado</Badge>}
                          {owner && <span className="text-xs text-fg-muted">Responsável: {owner.name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2 sm:justify-end">
                      {isTask && (
                        <button className="btn btn-secondary" disabled={busy === a.id} onClick={() => completeTask(a.id)}>
                          <Check aria-hidden className="size-4" /> Concluir
                        </button>
                      )}
                      <Link href={a.href} className="btn btn-ghost border border-line">
                        {a.next} <ArrowRight aria-hidden className="size-4" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-labelledby="agenda-title" className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="agenda-title" className="font-semibold">Agenda de hoje</h2>
              <Link href="/app/agenda" className="text-sm text-accent hover:underline">Ver agenda</Link>
            </div>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-fg-muted">Nenhum compromisso hoje.</p>
            ) : (
              <ol className="space-y-3">
                {todayEvents.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="num w-12 shrink-0 pt-0.5 text-sm font-semibold text-accent">{formatTime(e.start)}</span>
                    <div className="min-w-0 border-l border-line pl-3">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-fg-muted">{e.location}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="panel p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><CalendarClock aria-hidden className="size-4 text-accent" /> Próximos 10 dias</h2>
            <ol className="space-y-3">
              {upcoming.map((e) => (
                <li key={e.id} className="text-sm">
                  <p className="num text-xs text-fg-muted">{formatCivil(civilFromInstant(e.start))} · {formatTime(e.start)}</p>
                  <p className="font-medium">{e.title}</p>
                  <Badge tone={e.type === "audiencia" || e.type === "pericia" ? "danger" : "neutral"}>{{ audiencia: "Audiência", pericia: "Perícia", reuniao: "Reunião", atendimento: "Atendimento" }[e.type]}</Badge>
                </li>
              ))}
              {upcoming.length === 0 && <li className="text-sm text-fg-muted">Sem compromissos.</li>}
            </ol>
          </section>
          {(docs.data ?? []).some((d) => d.status === "solicitado") && (
            <section className="panel flex items-start gap-3 p-4 text-sm">
              <FileWarning aria-hidden className="size-5 shrink-0 text-warning" />
              <p>Documentos solicitados ainda não chegaram. Pendência não significa ausência de direito — apenas falta de prova.</p>
            </section>
          )}
          <InstallCard />
        </aside>
      </div>
    </div>
  );
}
