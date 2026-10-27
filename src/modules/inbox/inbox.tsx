"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, CheckCheck, Clock, FileText, Hand, Info, Lock, Megaphone, PanelRightClose, PanelRightOpen, Search, Send, Sparkles, StickyNote, UserRound, X } from "lucide-react";
import { useCollection, useInvalidate, useSession } from "@/components/providers";
import { Avatar, Badge, EmptyState, ErrorBlock, LoadingBlock, SimulatedBadge } from "@/components/ui";
import { useDirtyGuard } from "@/components/pwa";
import { inboxService } from "@/services/mock/repo";
import { canSeeFees } from "@/domain/permissions";
import { formatBRL } from "@/lib/money";
import { formatInstant, formatTime } from "@/lib/dates";
import type { Conversation, Message } from "@/domain/types";
import { users } from "@/mocks/fixtures";

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "minhas", label: "Minhas" },
  { key: "nao_atribuidas", label: "Não atribuídas" },
  { key: "ia", label: "Com IA" },
  { key: "aguardando_equipe", label: "Aguardando equipe" },
  { key: "aguardando_cliente", label: "Aguardando cliente" },
  { key: "nao_lidas", label: "Não lidas" },
  { key: "encerrada", label: "Encerradas" },
] as const;

const MSG_STATUS: Record<NonNullable<Message["status"]>, string> = {
  rascunho: "Rascunho", fila: "Na fila (simulada)", enviada: "Enviada", entregue: "Entregue", lida: "Lida", falhou: "Falhou", cancelada: "Cancelada",
};

const QUICK_REPLIES = [
  "Recebemos seus documentos. A equipe vai analisar e retorna em breve.",
  "Pode enviar uma foto nítida do documento, de preferência com boa luz?",
  "Vou verificar com a advogada responsável e te respondo ainda hoje.",
];

export function Inbox({ conversationId }: { conversationId?: string }) {
  const { user, ctx } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = params.get("filtro") ?? "todas";
  const [query, setQuery] = useState("");
  const [showContext, setShowContext] = useState(true); // ≥ lg
  const [mobileContext, setMobileContext] = useState(false); // < lg
  const convs = useCollection("conversations");
  const msgs = useCollection("messages");
  const cases = useCollection("cases");
  const contracts = useCollection("contracts");
  const invalidate = useInvalidate();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (convs.data ?? [])
      .filter((c) => {
        if (q && !`${c.contactName} ${c.phone} ${c.tags.join(" ")}`.toLowerCase().includes(q)) return false;
        switch (filter) {
          case "minhas": return c.assigneeId === user?.id;
          case "nao_atribuidas": return !c.assigneeId;
          case "ia": return c.aiActive;
          case "nao_lidas": return c.unread > 0;
          case "aguardando_equipe": case "aguardando_cliente": case "encerrada": return c.status === filter;
          default: return c.status !== "encerrada";
        }
      })
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }, [convs.data, filter, query, user?.id]);

  const current = convs.data?.find((c) => c.id === conversationId);

  // Marcar lida ao abrir.
  useEffect(() => {
    if (current && current.unread > 0 && ctx) inboxService.markRead(current.id, ctx).then(() => invalidate("conversations"));
  }, [current, ctx, invalidate]);

  const setFilter = (k: string) => {
    const p = new URLSearchParams(params);
    if (k === "todas") p.delete("filtro");
    else p.set("filtro", k);
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };
  const qs = params.size ? `?${params}` : "";

  if (convs.isError) return <ErrorBlock message="Não foi possível carregar as conversas locais." retry={() => convs.refetch()} />;

  return (
    // Altura total menos header/faixa; no celular, descontar barra inferior.
    <div className="-mx-4 -mt-5 flex h-[calc(100dvh-56px-26px-64px-env(safe-area-inset-bottom))] min-h-[420px] border-line sm:-mx-6 sm:h-[calc(100dvh-64px-26px)] lg:-mx-8">
      {/* Lista: no celular só aparece sem conversa aberta */}
      <section aria-label="Conversas" className={`${current ? "hidden md:flex" : "flex"} w-full min-w-0 flex-col border-r border-line bg-surface md:w-[300px] lg:w-[340px] md:shrink-0`}>
        <div className="space-y-3 border-b border-line p-3">
          <h1 className="text-lg font-semibold">Conversas</h1>
          <label className="relative block">
            <span className="sr-only">Buscar conversa</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
            <input className="field min-h-10 pl-9 text-sm" placeholder="Nome, telefone ou etiqueta" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div role="group" aria-label="Filtros" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${filter === f.key ? "border-brand bg-selection text-fg" : "border-line text-fg-muted hover:text-fg"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {convs.isPending ? (
            <div className="p-3"><LoadingBlock rows={4} /></div>
          ) : list.length === 0 ? (
            <div className="p-4"><EmptyState title="Nenhuma conversa neste filtro" text="Troque o filtro ou limpe a busca." /></div>
          ) : (
            <ul>
              {list.map((c) => {
                const last = (msgs.data ?? []).filter((m) => m.conversationId === c.id && m.author !== "nota").at(-1);
                const active = c.id === conversationId;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/app/atendimento/${c.id}${qs}`}
                      aria-current={active ? "true" : undefined}
                      className={`flex gap-3 border-b border-line/60 px-3 py-3 ${active ? "bg-selection shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-muted"}`}
                    >
                      <Avatar name={c.contactName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className={`truncate text-sm ${c.unread ? "font-semibold text-fg" : "font-medium"}`}>{c.contactName}</p>
                          <span className="num ml-auto shrink-0 text-xs text-fg-muted">{formatTime(c.lastMessageAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-sm text-fg-muted">{last?.author === "ia" ? "Assistente: " : last?.author === "equipe" ? "Você: " : ""}{last?.text}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {c.aiActive ? <Badge tone="ai">IA ativa</Badge> : <Badge tone="info" icon={false}><UserRound aria-hidden className="size-3.5" /> Humano</Badge>}
                          {c.status === "aguardando_equipe" && <Badge tone="warning">Aguardando equipe</Badge>}
                          {c.unread > 0 && <span className="num ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-on-brand" aria-label={`${c.unread} não lidas`}>{c.unread}</span>}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Conversa */}
      {current && ctx ? (
        <ConversationView
          key={current.id}
          conv={current}
          messages={(msgs.data ?? []).filter((m) => m.conversationId === current.id)}
          backHref={`/app/atendimento${qs}`}
          showContext={showContext}
          toggleContext={() => setShowContext((s) => !s)}
          openMobileContext={() => setMobileContext(true)}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center md:flex">
          <EmptyState title="Selecione uma conversa" text="Escolha uma conversa à esquerda para ver mensagens, contexto e próximos passos." />
        </div>
      )}

      {current && (showContext || mobileContext) && (
        <ContextPanel
          key={`ctx-${current.id}`}
          conv={current}
          visibility={`${mobileContext ? "flex" : "hidden"} ${showContext ? "lg:flex" : "lg:hidden"}`}
          caseTitle={cases.data?.find((k) => k.id === current.caseId)?.title}
          fees={canSeeFees(user!.role) ? contracts.data?.find((k) => k.caseId === current.caseId)?.total : undefined}
          onClose={() => { setMobileContext(false); setShowContext(false); }}
        />
      )}
    </div>
  );
}

function ConversationView({ conv, messages, backHref, showContext, toggleContext, openMobileContext }: { conv: Conversation; messages: Message[]; backHref: string; showContext: boolean; toggleContext: () => void; openMobileContext: () => void }) {
  const { ctx } = useSession();
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"equipe" | "nota">(conv.aiActive ? "nota" : "equipe");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const draftKey = `siwiltec.draft.${conv.id}`;
  useDirtyGuard(`chat-${conv.id}`, draft.trim().length > 0);

  // Rascunho preservado ao voltar/trocar de conversa (sessionStorage = este dispositivo).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura rascunho local ao abrir
      setDraft(sessionStorage.getItem(draftKey) ?? "");
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    try {
      if (draft) sessionStorage.setItem(draftKey, draft);
      else sessionStorage.removeItem(draftKey);
    } catch {}
  }, [draft, draftKey]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    await fn();
    await invalidate("conversations", "messages", "audit");
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctx || sending) return;
    setSending(true);
    setError(null);
    const r = await inboxService.send(conv.id, draft, mode, { ...ctx, idempotencyKey: crypto.randomUUID() });
    setSending(false);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setDraft("");
    await invalidate("conversations", "messages");
  };

  const assignee = users.find((u) => u.id === conv.assigneeId);
  const ints = useCollection("integrations");
  const disconnected = ints.data?.find((i) => i.provider === "evolution")?.status === "desconectado";

  return (
    <section aria-label={`Conversa com ${conv.contactName}`} className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
        <Link href={backHref} className="btn btn-ghost min-h-10 px-2 md:hidden" aria-label="Voltar para a lista de conversas">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <Avatar name={conv.contactName} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{conv.contactName}</h2>
          <p className="truncate text-xs text-fg-muted">WhatsApp · {conv.phone}{assignee ? ` · Responsável: ${assignee.name}` : " · Sem responsável"}</p>
        </div>
        <button onClick={openMobileContext} className="btn btn-ghost min-h-10 px-2 lg:hidden" aria-label="Ver contexto do contato">
          <Info aria-hidden className="size-5" />
        </button>
        <button onClick={toggleContext} className="btn btn-ghost hidden min-h-10 px-2 lg:inline-flex" aria-label={showContext ? "Ocultar painel de contexto" : "Mostrar painel de contexto"} aria-pressed={showContext}>
          {showContext ? <PanelRightClose aria-hidden className="size-5" /> : <PanelRightOpen aria-hidden className="size-5" />}
        </button>
      </header>

      {disconnected && (
        <p role="alert" className="border-b border-danger/40 bg-danger-bg px-4 py-2 text-sm text-danger">
          WhatsApp desconectado (simulação). Suas respostas ficam na fila e serão enviadas uma única vez quando a conexão voltar. <Link className="underline" href="/app/integracoes/evolution">Ver conexão</Link>
        </p>
      )}
      {/* Estado IA × humano sempre visível (A05) */}
      <div className={`flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm sm:px-4 ${conv.aiActive ? "border-ai/30 bg-ai-bg text-ai" : "border-info/30 bg-info-bg text-info"}`} data-tour="estado-ia">
        {conv.aiActive ? <Bot aria-hidden className="size-4" /> : <Hand aria-hidden className="size-4" />}
        <span className="min-w-0 flex-1 font-medium leading-tight">
          {conv.status === "encerrada" ? "Conversa encerrada" : conv.aiActive ? <>Assistente virtual ativa <span className="font-normal opacity-80">(simulação)</span></> : "Humano no atendimento — assistente pausada"}
        </span>
        {conv.status !== "encerrada" && (conv.aiActive ? (
          <button className="btn btn-primary min-h-9" data-tour="assumir" onClick={() => act(async () => { await inboxService.takeOver(conv.id, ctx!); setMode("equipe"); })}>
            <Hand aria-hidden className="size-4" /> Assumir atendimento
          </button>
        ) : (
          <button className="btn btn-secondary min-h-9" onClick={() => act(async () => { await inboxService.resumeAi(conv.id, ctx!); setMode("nota"); })}>
            <Bot aria-hidden className="size-4" /> Retomar assistente virtual
          </button>
        ))}
        <button className="btn btn-ghost min-h-9 px-2" onClick={() => act(() => inboxService.setStatus(conv.id, conv.status === "encerrada" ? "aguardando_equipe" : "encerrada", ctx!))}>
          {conv.status === "encerrada" ? "Reabrir" : "Encerrar"}
        </button>
      </div>

      <div tabIndex={0} role="log" aria-label="Mensagens" className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6" aria-live="polite" aria-relevant="additions">
        {conv.campaign && (
          <p className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-fg-muted">
            <Megaphone aria-hidden className="size-3.5" /> Chegou pela campanha “{conv.campaign}”
          </p>
        )}
        {messages.map((m) => <Bubble key={m.id} m={m} />)}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-line bg-surface p-3 sm:px-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Tipo de mensagem" className="inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm">
            <button type="button" role="radio" aria-checked={mode === "equipe"} onClick={() => setMode("equipe")} className={`rounded-md px-3 py-1.5 ${mode === "equipe" ? "bg-brand text-on-brand" : "text-fg-muted"}`}>Responder ao cliente</button>
            <button type="button" role="radio" aria-checked={mode === "nota"} onClick={() => setMode("nota")} className={`flex items-center gap-1 rounded-md px-3 py-1.5 ${mode === "nota" ? "bg-warning-bg text-warning" : "text-fg-muted"}`}><Lock aria-hidden className="size-3.5" /> Nota interna</button>
          </div>
          {mode === "equipe" && (
            <details className="relative">
              <summary className="btn btn-ghost min-h-9 cursor-pointer list-none text-sm">Respostas rápidas</summary>
              <ul className="absolute bottom-11 left-0 z-20 w-80 rounded-[var(--radius-panel)] border border-line bg-surface-raised p-1 shadow-xl">
                {QUICK_REPLIES.map((q) => (
                  <li key={q}><button type="button" onClick={(e) => { setDraft(q); (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; }} className="w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-muted">{q}</button></li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {mode === "equipe" && conv.aiActive && (
          <p className="mb-2 flex items-center gap-1.5 text-sm text-warning"><Info aria-hidden className="size-4" /> Assuma o atendimento para responder: a assistente virtual está ativa.</p>
        )}
        {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="sr-only">{mode === "nota" ? "Nota interna (visível só para a equipe)" : "Mensagem ao cliente"}</span>
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e); }}
              placeholder={mode === "nota" ? "Visível só para a equipe…" : "Escreva sua resposta…"}
              enterKeyHint="send"
              className={`field min-h-11 resize-none py-2 ${mode === "nota" ? "border-warning/50 bg-warning-bg/40" : ""}`}
            />
          </label>
          <button className="btn btn-primary min-h-11 shrink-0" aria-label={mode === "nota" ? "Salvar nota" : "Enviar"} disabled={sending || !draft.trim() || (mode === "equipe" && conv.aiActive)}>
            <Send aria-hidden className="size-4" /> <span aria-hidden className="hidden sm:inline">{mode === "nota" ? "Salvar nota" : "Enviar"}</span>
          </button>
        </div>
        {draft && <p className="mt-1 text-xs text-fg-muted">Rascunho salvo neste dispositivo.</p>}
      </form>
    </section>
  );
}

function Bubble({ m }: { m: Message }) {
  if (m.author === "nota") {
    const who = users.find((u) => u.id === m.authorId);
    return (
      <div className="mx-auto max-w-xl rounded-[var(--radius-panel)] border border-dashed border-warning/50 bg-warning-bg px-4 py-2 text-sm text-fg [background-image:repeating-linear-gradient(135deg,transparent_0_8px,rgb(242_201_76/0.05)_8px_16px)]">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-warning"><StickyNote aria-hidden className="size-3.5" /> Nota interna · visível só para a equipe · {who?.name}</p>
        <p className="[overflow-wrap:anywhere]">{m.text}</p>
      </div>
    );
  }
  const mine = m.author !== "contato";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2 sm:max-w-[70%] ${mine ? (m.author === "ia" ? "rounded-br-md border border-ai/30 bg-ai-bg" : "rounded-br-md bg-selection") : "rounded-bl-md border border-line bg-surface"}`}>
        {m.author === "ia" && <p className="mb-1 text-xs font-medium text-ai"><Bot aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />Assistente virtual{m.simulated && <span className="font-normal text-fg-muted"> · resposta de demonstração</span>}</p>}
        {m.author === "equipe" && <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent"><UserRound aria-hidden className="size-3.5" /> {users.find((u) => u.id === m.authorId)?.name ?? "Equipe"}</p>}
        <p className="whitespace-pre-wrap text-[0.95rem] [overflow-wrap:anywhere]">{m.text}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[0.7rem] text-fg-muted">
          <span className="num" title={formatInstant(m.at)}>{formatTime(m.at)}</span>
          {m.status && (<>{m.status === "lida" ? <CheckCheck aria-hidden className="size-3.5 text-info" /> : m.status === "fila" ? <Clock aria-hidden className="size-3.5" /> : null}<span>{MSG_STATUS[m.status]}</span></>)}
        </p>
      </div>
    </div>
  );
}

function ContextPanel({ conv, caseTitle, fees, onClose, visibility }: { conv: Conversation; caseTitle?: string; fees?: number; onClose: () => void; visibility: string }) {
  const { ctx } = useSession();
  const invalidate = useInvalidate();
  const [summary, setSummary] = useState(conv.summary);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const dirty = summary !== conv.summary;
  useDirtyGuard(`summary-${conv.id}`, dirty);

  return (
    // ≥ lg: coluna que reduz a área central. < lg: painel lateral sob demanda (botão Info), fecha com X.
    <aside aria-label="Contexto do contato" className={`${visibility} fixed inset-y-0 right-0 z-40 w-[min(360px,100vw)] flex-col border-l border-line bg-surface pt-[env(safe-area-inset-top)] shadow-2xl lg:static lg:z-auto lg:w-[320px] lg:shrink-0 lg:pt-0 lg:shadow-none xl:w-[360px]`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-semibold">Contexto</h2>
        <button className="btn btn-ghost min-h-9 px-2" onClick={onClose} aria-label="Fechar painel de contexto"><X aria-hidden className="size-4" /></button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <section>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-medium">Resumo</h3>
            <Badge tone="ai">Gerado por IA · editável</Badge>
          </div>
          <label className="sr-only" htmlFor="sum">Resumo da conversa</label>
          <textarea id="sum" rows={5} className="field py-2 text-sm" value={summary} onChange={(e) => setSummary(e.target.value)} />
          {dirty && (
            <div className="mt-2 flex gap-2">
              <button className="btn btn-primary min-h-9" onClick={async () => { await inboxService.updateSummary(conv.id, summary, ctx!); await invalidate("conversations"); }}>Salvar resumo</button>
              <button className="btn btn-ghost min-h-9" onClick={() => setSummary(conv.summary)}>Descartar</button>
            </div>
          )}
        </section>
        <section>
          <h3 className="mb-2 font-medium">Documentos faltantes</h3>
          {conv.missingDocs.length ? (
            <ul className="space-y-1.5">{conv.missingDocs.map((d) => <li key={d} className="flex items-center gap-2"><FileText aria-hidden className="size-4 text-warning" />{d}</li>)}</ul>
          ) : <p className="text-fg-muted">Nenhum pendente.</p>}
        </section>
        <section>
          <h3 className="mb-1 font-medium">Caso</h3>
          {caseTitle ? <Link href={`/app/clientes/${conv.clientId}?aba=casos`} className="text-accent underline underline-offset-2">{caseTitle}</Link> : <p className="text-fg-muted">Ainda não vinculado a um caso.</p>}
          {!conv.clientId && conv.leadId && <Link href={`/app/crm/leads/${conv.leadId}`} className="btn btn-secondary mt-2 min-h-9 w-full">Ver lead e converter em cliente</Link>}
          {conv.clientId && !caseTitle && <Link href={`/app/clientes/${conv.clientId}`} className="btn btn-secondary mt-2 min-h-9 w-full">Abrir cliente para criar caso</Link>}
          {fees !== undefined && <p className="num mt-1 text-fg-muted">Honorários contratados: {formatBRL(fees)}</p>}
        </section>
        <section>
          <h3 className="mb-2 font-medium">Etiquetas</h3>
          <div className="flex flex-wrap gap-1.5">{conv.tags.map((t) => <Badge key={t} icon={false}>{t}</Badge>)}</div>
        </section>
        <section className="rounded-[var(--radius-panel)] border border-ai/30 bg-ai-bg/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-medium text-ai"><Sparkles aria-hidden className="size-4" /> Sugestão de resposta</h3>
            <SimulatedBadge />
          </div>
          {suggestion ? (
            <>
              <p className="rounded border border-line bg-surface p-2">{suggestion}</p>
              <p className="mt-1 text-xs text-fg-muted">Revise antes de usar. A sugestão não promete resultado nem afirma direito.</p>
              <button className="btn btn-secondary mt-2 min-h-9 w-full" onClick={async () => { await navigator.clipboard?.writeText(suggestion).catch(() => {}); }}>Copiar sugestão</button>
            </>
          ) : (
            <button className="btn btn-secondary min-h-9 w-full" onClick={() => setSuggestion(conv.missingDocs.length ? `Olá! Para seguirmos, ainda precisamos de: ${conv.missingDocs.join(" e ")}. Pode enviar por aqui mesmo, uma foto nítida já ajuda.` : "Olá! Recebemos sua mensagem. A advogada responsável vai analisar e retorna em breve.")}>
              Gerar sugestão (demonstração)
            </button>
          )}
        </section>
      </div>
    </aside>
  );
}
