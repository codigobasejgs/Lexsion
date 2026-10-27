"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, CalendarDays, Eye, EyeOff, FileText, History, Lock, Mail, MapPin, MessagesSquare, Phone, Wallet } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Avatar, Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { CaseForm } from "@/modules/cases/case-form";
import { formatBRL } from "@/lib/money";
import { civilFromInstant, formatCivil, formatInstant, formatTime } from "@/lib/dates";
import { maskDoc } from "@/lib/formatting";
import { can } from "@/domain/permissions";
import { users } from "@/mocks/fixtures";

const TABS = [
  { key: "resumo", label: "Resumo", icon: Eye },
  { key: "casos", label: "Casos", icon: Briefcase },
  { key: "atendimentos", label: "Atendimentos", icon: MessagesSquare },
  { key: "documentos", label: "Documentos", icon: FileText },
  { key: "financeiro", label: "Financeiro", icon: Wallet },
  { key: "agenda", label: "Agenda", icon: CalendarDays },
  { key: "tarefas", label: "Tarefas", icon: Briefcase },
  { key: "historico", label: "Histórico", icon: History },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const PHASE: Record<string, string> = { triagem: "Triagem", documentacao: "Documentação", analise: "Análise", administrativo: "Administrativo", judicial: "Judicial", cumprimento: "Cumprimento", encerrado: "Encerrado" };
const DOC_STATUS: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  solicitado: { label: "Solicitado", tone: "warning" }, recebido: { label: "Recebido", tone: "info" }, em_leitura: { label: "Em leitura", tone: "info" },
  precisa_revisar: { label: "Precisa revisar", tone: "warning" }, validado: { label: "Validado", tone: "success" }, rejeitado: { label: "Rejeitado", tone: "danger" },
};
const INST_STATUS = { aberta: { label: "Em aberto", tone: "neutral" }, parcial: { label: "Parcial", tone: "warning" }, paga: { label: "Paga", tone: "success" }, cancelada: { label: "Cancelada", tone: "danger" } } as const;

export default function Cliente360({ params }: PageProps<"/app/clientes/[id]">) {
  const { id } = use(params);
  const { user } = useSession();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (sp.get("aba") as TabKey) ?? "resumo";
  const [reveal, setReveal] = useState(false);
  const [openingCase, setOpeningCase] = useState(false);
  const leads = useCollection("leads");

  const clients = useCollection("clients");
  const cases = useCollection("cases");
  const convs = useCollection("conversations");
  const docs = useCollection("documents");
  const insts = useCollection("installments");
  const events = useCollection("events");
  const tasks = useCollection("tasks");
  const audit = useCollection("audit");
  const msgs = useCollection("messages");

  const client = clients.data?.find((c) => c.id === id);
  const role = user?.role ?? "estagiario";
  const visibleTabs = TABS.filter((t) => (t.key === "financeiro" ? can(role, "financeiro") : t.key === "atendimentos" ? can(role, "atendimento") : true));

  const mine = useMemo(() => ({
    cases: (cases.data ?? []).filter((k) => k.clientId === id),
    convs: (convs.data ?? []).filter((c) => c.clientId === id),
    docs: (docs.data ?? []).filter((d) => d.clientId === id),
    insts: (insts.data ?? []).filter((i) => i.clientId === id).sort((a, b) => a.due.localeCompare(b.due)),
    events: (events.data ?? []).filter((e) => e.clientId === id).sort((a, b) => a.start.localeCompare(b.start)),
    tasks: (tasks.data ?? []).filter((t) => t.clientId === id),
  }), [cases.data, convs.data, docs.data, insts.data, events.data, tasks.data, id]);

  // Linha do tempo unificada (eventos de várias entidades).
  const timeline = useMemo(() => {
    const out: { at: string; kind: string; text: string }[] = [];
    for (const c of mine.convs) for (const m of (msgs.data ?? []).filter((x) => x.conversationId === c.id && x.author !== "nota")) out.push({ at: m.at, kind: "Mensagem", text: `${m.author === "contato" ? "Cliente" : m.author === "ia" ? "Assistente virtual" : "Equipe"}: ${m.text}` });
    for (const d of mine.docs) if (d.receivedAt) out.push({ at: d.receivedAt, kind: "Documento", text: `Recebido: ${d.name}` });
    for (const e of mine.events) out.push({ at: e.start, kind: "Agenda", text: e.title });
    for (const a of audit.data ?? []) if (mine.convs.some((c) => c.id === a.entityId) || mine.insts.some((i) => i.id === a.entityId)) out.push({ at: a.at, kind: "Registro", text: a.detail });
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [mine, msgs.data, audit.data]);

  const setTab = (k: TabKey) => {
    const p = new URLSearchParams(sp);
    p.set("aba", k);
    router.replace(`${pathname}?${p}`, { scroll: false });
  };

  if (clients.isPending) return <LoadingBlock rows={6} />;
  if (!client)
    return <EmptyState title="Cliente não encontrado" text="Ele pode pertencer a outro escritório ou ter sido removido desta demonstração." action={<Link href="/app/clientes" className="btn btn-secondary">Voltar a Clientes</Link>} />;

  const owner = users.find((u) => u.id === client.ownerId);
  const openBalance = mine.insts.reduce((s, i) => s + (i.status === "cancelada" ? 0 : i.amount - i.paid), 0);
  const nextEvent = mine.events.find((e) => civilFromInstant(e.start) >= "2026-10-26");

  return (
    <Guard area="clientes">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          breadcrumb={[{ href: "/app/clientes", label: "Clientes" }]}
          title={client.name}
          actions={role !== "financeiro" && role !== "atendimento" ? <button className="btn btn-primary" onClick={() => setOpeningCase(true)} data-tour="abrir-caso"><Briefcase aria-hidden className="size-4" /> Abrir caso</button> : undefined}
        />
        {sp.get("criado") === "1" && <p role="status" className="mb-4 rounded-[var(--radius-control)] border border-success/30 bg-success-bg p-3 text-sm text-success">Cliente cadastrado. Próximo passo: abrir o primeiro caso.</p>}

        {/* Identificação */}
        <section className="panel mb-5 grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:p-5 lg:grid-cols-[auto_1fr_auto]">
          <Avatar name={client.name} size={56} />
          <div className="min-w-0 space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={client.status === "ativo" ? "success" : "neutral"}>{client.status === "ativo" ? "Ativo" : "Arquivado"}</Badge>
              <Badge icon={false}>{client.kind === "PF" ? "Pessoa física" : "Pessoa jurídica"}</Badge>
              {client.profession && <span className="text-fg-muted">{client.profession}</span>}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fg-muted">
              <span className="flex items-center gap-1.5"><Phone aria-hidden className="size-4" /> {client.phone}</span>
              {client.email && <span className="flex items-center gap-1.5"><Mail aria-hidden className="size-4" /> {client.email}</span>}
              <span className="flex items-center gap-1.5"><MapPin aria-hidden className="size-4" /> {client.city}/{client.uf}</span>
            </p>
            <p className="flex flex-wrap items-center gap-2 text-fg-muted">
              <span className="num">{client.kind === "PF" ? "CPF" : "CNPJ"} (sintético): {reveal ? client.document : maskDoc(client.document)}</span>
              {can(role, "clientes") && role !== "estagiario" && (
                <button className="btn btn-ghost min-h-8 px-2 text-xs" onClick={() => setReveal((r) => !r)} aria-pressed={reveal}>
                  {reveal ? <EyeOff aria-hidden className="size-3.5" /> : <Eye aria-hidden className="size-3.5" />} {reveal ? "Ocultar" : "Mostrar"}
                </button>
              )}
            </p>
            <p className="text-fg-muted">
              Responsável: <span className="text-fg">{owner?.name}</span> · Origem: {client.origin}
              {client.leadId && leads.data?.some((l) => l.id === client.leadId) && <> · <Link className="text-accent underline underline-offset-2" href={`/app/crm/leads/${client.leadId}`}>ver lead de origem</Link></>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm sm:col-span-2 lg:col-span-1 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div><p className="text-fg-muted">Casos</p><p className="num text-lg font-semibold">{mine.cases.length}</p></div>
            {can(role, "financeiro") && <div><p className="text-fg-muted">Saldo em aberto</p><p className="num text-lg font-semibold">{formatBRL(openBalance)}</p></div>}
            <div><p className="text-fg-muted">Próximo compromisso</p><p className="text-sm font-medium">{nextEvent ? `${formatCivil(civilFromInstant(nextEvent.start))} ${formatTime(nextEvent.start)}` : "—"}</p></div>
          </div>
        </section>

        {/* Navegação secundária: abas no desktop, seletor no celular */}
        <label className="mb-4 block sm:hidden">
          <span className="label">Seção</span>
          <select className="field" value={tab} onChange={(e) => setTab(e.target.value as TabKey)}>
            {visibleTabs.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <div data-tour="abas-cliente" role="tablist" aria-label="Seções do cliente" className="mb-5 hidden gap-1 overflow-x-auto border-b border-line sm:flex">
          {visibleTabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm ${tab === t.key ? "border-brand font-medium text-fg" : "border-transparent text-fg-muted hover:text-fg"}`}>
              <t.icon aria-hidden className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === "resumo" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="panel p-4">
                <h2 className="mb-3 font-semibold">Casos ativos</h2>
                {mine.cases.length ? mine.cases.map((k) => <CaseRow key={k.id} k={k} />) : <p className="text-sm text-fg-muted">Nenhum caso.</p>}
              </section>
              <section className="panel p-4">
                <h2 className="mb-3 font-semibold">Linha do tempo recente</h2>
                <Timeline items={timeline.slice(0, 6)} />
                {timeline.length > 6 && <button className="btn btn-ghost mt-2 min-h-9" onClick={() => setTab("historico")}>Ver histórico completo</button>}
              </section>
            </div>
          )}
          {tab === "casos" && (mine.cases.length ? <div className="panel p-4">{mine.cases.map((k) => <CaseRow key={k.id} k={k} />)}</div> : <EmptyState title="Nenhum caso" text="Este cliente ainda não tem casos." />)}
          {tab === "atendimentos" && (
            mine.convs.length ? (
              <ul className="space-y-2">{mine.convs.map((c) => (
                <li key={c.id}><Link href={`/app/atendimento/${c.id}`} className="panel flex flex-wrap items-center gap-3 p-3 hover:border-line-strong">
                  <MessagesSquare aria-hidden className="size-5 text-accent" />
                  <span className="min-w-0 flex-1"><span className="block font-medium">WhatsApp · {c.phone}</span><span className="block text-sm text-fg-muted">{c.summary}</span></span>
                  <span className="num text-xs text-fg-muted">{formatInstant(c.lastMessageAt)}</span>
                </Link></li>
              ))}</ul>
            ) : <EmptyState title="Nenhum atendimento" text="Conversas deste cliente aparecerão aqui." />
          )}
          {tab === "documentos" && (
            mine.docs.length ? (
              <ul className="panel divide-y divide-line">{mine.docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
                  <FileText aria-hidden className="size-5 text-fg-muted" />
                  <span className="min-w-0 flex-1"><span className="block font-medium [overflow-wrap:anywhere]">{d.name}</span><span className="block text-xs text-fg-muted">{d.type}{d.receivedAt ? ` · recebido ${formatInstant(d.receivedAt)}` : ""}{d.type === "Laudo" ? " · dado de saúde, acesso restrito" : ""}</span></span>
                  {d.type === "Laudo" && <Lock aria-label="Acesso restrito" className="size-4 text-warning" />}
                  <Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>
                  {d.type === "CNIS" && <Link href="/app/previdenciario/analises/pa-joao" className="btn btn-secondary min-h-9">Revisar extração</Link>}
                </li>
              ))}</ul>
            ) : <EmptyState title="Nenhum documento" text="Documentos recebidos ou solicitados aparecerão aqui." />
          )}
          {tab === "financeiro" && (
            mine.insts.length ? (
              <div className="panel divide-y divide-line">
                {mine.insts.map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1 font-medium">{i.label}</span>
                    <span className="num text-fg-muted">Vence {formatCivil(i.due)}</span>
                    <span className="num w-28 text-right">{formatBRL(i.amount)}</span>
                    <span className="num w-28 text-right text-fg-muted">Saldo {formatBRL(i.amount - i.paid)}</span>
                    <Badge tone={INST_STATUS[i.status].tone}>{INST_STATUS[i.status].label}</Badge>
                  </div>
                ))}
                <div className="p-3"><Link href={`/app/financeiro?cliente=${id}`} className="btn btn-secondary min-h-9">Abrir no Financeiro</Link></div>
              </div>
            ) : <EmptyState title="Sem lançamentos" text="Parcelas e recebimentos deste cliente aparecerão aqui." />
          )}
          {tab === "agenda" && (
            mine.events.length ? (
              <ul className="panel divide-y divide-line">{mine.events.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-3 p-3 text-sm"><span className="num w-36 shrink-0 text-accent">{formatCivil(civilFromInstant(e.start))} {formatTime(e.start)}</span><span className="min-w-0 flex-1"><span className="block font-medium">{e.title}</span><span className="text-fg-muted">{e.location}</span></span></li>
              ))}</ul>
            ) : <EmptyState title="Sem compromissos" text="Audiências, perícias e reuniões aparecerão aqui." />
          )}
          {tab === "tarefas" && (
            mine.tasks.length ? (
              <ul className="panel divide-y divide-line">{mine.tasks.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className={`min-w-0 flex-1 ${t.done ? "text-fg-muted line-through" : "font-medium"}`}>{t.title}</span>
                  <span className="num text-fg-muted">{formatCivil(t.due)}</span>
                  <span className="text-fg-muted">{users.find((u) => u.id === t.assigneeId)?.name}</span>
                  <Badge tone={t.done ? "success" : t.priority === "alta" ? "danger" : "neutral"}>{t.done ? "Concluída" : t.priority === "alta" ? "Alta" : "Normal"}</Badge>
                </li>
              ))}</ul>
            ) : <EmptyState title="Sem tarefas" text="Tarefas ligadas a este cliente aparecerão aqui." />
          )}
          {tab === "historico" && <section className="panel p-4"><Timeline items={timeline} /></section>}
        </div>
      </div>
      <Dialog open={openingCase} onClose={() => setOpeningCase(false)} title={`Abrir caso para ${client.name}`} wide>
        <CaseForm clientId={client.id} onCancel={() => setOpeningCase(false)} onDone={() => { setOpeningCase(false); setTab("casos"); }} />
      </Dialog>
    </Guard>
  );
}

function CaseRow({ k }: { k: { id: string; title: string; area: string; phase: string; processNumber?: string; confidential: boolean; priority: string } }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <Link className="font-medium hover:underline" href={`/app/casos/${k.id}`}>{k.title}</Link>
        <p className="num text-sm text-fg-muted">{k.area}{k.processNumber ? ` · ${k.processNumber}` : ""}</p>
      </div>
      {k.confidential && <Badge tone="warning">Sigiloso</Badge>}
      <Badge tone={k.phase === "judicial" ? "info" : "neutral"}>{PHASE[k.phase]}</Badge>
      {k.area === "Previdenciário" && k.id === "k-joao-apos" && <Link href="/app/previdenciario/analises/pa-joao" className="btn btn-secondary min-h-9">Análise previdenciária</Link>}
    </div>
  );
}

function Timeline({ items }: { items: { at: string; kind: string; text: string }[] }) {
  if (!items.length) return <p className="text-sm text-fg-muted">Sem eventos.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((it, i) => (
        <li key={i} className="relative text-sm">
          <span aria-hidden className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-canvas bg-brand" />
          <p className="num text-xs text-fg-muted">{formatInstant(it.at)} · {it.kind}</p>
          <p className="[overflow-wrap:anywhere]">{it.text}</p>
        </li>
      ))}
    </ol>
  );
}
