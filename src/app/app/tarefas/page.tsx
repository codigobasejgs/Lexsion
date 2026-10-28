"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Columns3, List, Plus, Repeat } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, SearchBox, useAction, useUrlState, userName } from "@/modules/shared";
import { createRow, updateRow } from "@/services/mock/generic";
import { addDays, diffDays, formatCivil, formatInstant } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import { people as users } from "@/components/people";
import type { Task } from "@/domain/types";
import { RECURRENCE_LABEL, type Recurrence } from "@/domain/recurrence";
import { tasksService } from "@/services/mock/repo";

type Col = "a_fazer" | "andamento" | "concluida";
const colOf = (t: Task): Col => (t.done ? "concluida" : t.inProgress ? "andamento" : "a_fazer");
const COLS: { key: Col; label: string }[] = [{ key: "a_fazer", label: "A fazer" }, { key: "andamento", label: "Em andamento" }, { key: "concluida", label: "Concluída" }];

export default function TarefasPage() {
  const url = useUrlState();
  const { user, org } = useSession();
  const tasks = useCollection("tasks");
  const cases = useCollection("cases");
  const act = useAction("tasks");
  const view = url.get("ver") ?? "lista";
  const q = url.get("q") ?? "";
  const who = url.get("resp") ?? "";
  const openId = url.get("id");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => (tasks.data ?? []).filter((t) => (!who || t.assigneeId === who) && t.title.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.due.localeCompare(b.due)), [tasks.data, who, q]);
  const team = users.filter((u) => u.organizationId === org?.id && u.role !== "cliente");
  const open = tasks.data?.find((t) => t.id === openId);

  const move = (t: Task, c: Col) => act.run((ctx) => tasksService.setStatus(t.id, c, ctx), t.recurrence && c === "concluida" && !t.done ? "Concluída. A próxima ocorrência foi criada." : undefined);
  const blocked = (t: Task) => (t.dependsOn ?? []).some((d) => !tasks.data?.find((x) => x.id === d)?.done);

  return (
    <Guard area="tarefas">
      <div className="mx-auto max-w-[1400px]">
        <PageHeader title="Tarefas" description="Lista, quadro e calendário mostram as mesmas tarefas." actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus aria-hidden className="size-4" /> Nova tarefa</button>} />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchBox label="Buscar tarefa" placeholder="Título" value={q} onChange={(v) => url.set("q", v || null)} />
          <label className="flex items-center gap-2 text-sm"><span className="text-fg-muted">Responsável</span>
            <select className="field min-h-10 w-auto text-sm" value={who} onChange={(e) => url.set("resp", e.target.value || null)}><option value="">Todos</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </label>
          <button className="btn btn-ghost min-h-10" onClick={() => url.set("resp", user?.id ?? null)}>Só as minhas</button>
          <div role="radiogroup" aria-label="Visualização" className="ml-auto inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm">
            {([["lista", List, "Lista"], ["quadro", Columns3, "Quadro"], ["calendario", CalendarDays, "Calendário"]] as const).map(([k, I, l]) => (
              <button key={k} role="radio" aria-checked={view === k} onClick={() => url.set("ver", k === "lista" ? null : k)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === k ? "bg-brand text-on-brand" : "text-fg-muted"}`}><I aria-hidden className="size-4" /> {l}</button>
            ))}
          </div>
        </div>
        <Feedback error={act.error} />
        {tasks.isPending ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="Nenhuma tarefa" text="Crie uma tarefa ou ajuste os filtros." /> : view === "quadro" ? (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0" tabIndex={0} aria-label="Quadro de tarefas">
            {COLS.map((c) => (
              <section key={c.key} aria-label={c.label} className="w-[85vw] shrink-0 snap-start rounded-[var(--radius-panel)] border border-line bg-surface sm:w-auto">
                <h2 className="border-b border-line px-3 py-2.5 text-sm font-semibold">{c.label} <span className="num text-fg-muted">{rows.filter((t) => colOf(t) === c.key).length}</span></h2>
                <ul className="space-y-2 p-2">
                  {rows.filter((t) => colOf(t) === c.key).map((t) => (
                    <li key={t.id} className="rounded-[var(--radius-control)] border border-line bg-surface-raised p-3 text-sm">
                      <button className="text-left font-medium hover:underline" onClick={() => url.set("id", t.id)}>{t.title}</button>
                      <p className="num text-xs text-fg-muted">{formatCivil(t.due)} · {userName(t.assigneeId)}</p>
                      <label className="mt-2 flex items-center gap-2 text-xs"><span className="text-fg-muted">Mover para</span>
                        <select className="field min-h-8 w-auto py-0 text-xs" value={colOf(t)} onChange={(e) => move(t, e.target.value as Col)}>{COLS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : view === "calendario" ? (
          <WeekCalendar rows={rows} onOpen={(id) => url.set("id", id)} />
        ) : (
          <ul className="panel divide-y divide-line">
            {rows.map((t) => {
              const n = diffDays(DEMO_TODAY, t.due);
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <input type="checkbox" aria-label={`Concluir ${t.title}`} checked={t.done} disabled={!t.done && blocked(t)} onChange={() => move(t, t.done ? "a_fazer" : "concluida")} className="size-5 accent-[var(--brand)]" />
                  {t.recurrence && <Repeat aria-label={RECURRENCE_LABEL[t.recurrence.every]} className="size-4 shrink-0 text-accent" />}
                  <button onClick={() => url.set("id", t.id)} className={`min-w-0 flex-1 text-left ${t.done ? "text-fg-muted line-through" : "font-medium"} hover:underline`}>{t.title}</button>
                  {!t.done && blocked(t) && <Badge tone="warning">Aguarda dependência</Badge>}
                  {t.caseId && <Link href={`/app/casos/${t.caseId}`} className="hidden text-fg-muted underline underline-offset-2 lg:inline">{cases.data?.find((k) => k.id === t.caseId)?.title}</Link>}
                  <span className={`num ${!t.done && n < 0 ? "text-danger" : "text-fg-muted"}`}>{formatCivil(t.due)}</span>
                  <span className="text-fg-muted">{userName(t.assigneeId)}</span>
                  <Badge tone={t.priority === "alta" ? "danger" : t.priority === "normal" ? "neutral" : "info"} icon={false}>{t.priority}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {open && <TaskDetail t={open} blocked={blocked(open)} onClose={() => url.set("id", null)} />}
      <NewTaskDialog open={creating} onClose={() => setCreating(false)} />
    </Guard>
  );
}

function WeekCalendar({ rows, onOpen }: { rows: Task[]; onOpen: (id: string) => void }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(DEMO_TODAY, i - 3));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => (
        <section key={d} className={`min-h-28 rounded-[var(--radius-control)] border p-2 text-xs ${d === DEMO_TODAY ? "border-brand" : "border-line"}`} aria-label={formatCivil(d)}>
          <p className="num mb-1 font-semibold">{formatCivil(d).slice(0, 5)}{d === DEMO_TODAY && " · hoje"}</p>
          <ul className="space-y-1">{rows.filter((t) => t.due === d).map((t) => <li key={t.id}><button onClick={() => onOpen(t.id)} className={`w-full rounded bg-surface-muted px-1.5 py-1 text-left ${t.done ? "line-through opacity-60" : ""}`}>{t.title}</button></li>)}</ul>
        </section>
      ))}
    </div>
  );
}

function TaskDetail({ t, blocked, onClose }: { t: Task; blocked: boolean; onClose: () => void }) {
  const act = useAction("tasks");
  const [comment, setComment] = useState("");
  const [item, setItem] = useState("");
  return (
    <Dialog open onClose={onClose} title={t.title} wide>
      <div className="space-y-4 text-sm">
        <p className="text-fg-muted">Prazo {formatCivil(t.due)} · {userName(t.assigneeId)} · prioridade {t.priority}</p>
        {t.recurrence && (
          <div className="flex flex-wrap items-center gap-2 rounded border border-line p-2" data-testid="recorrencia">
            <Repeat aria-hidden className="size-4 text-accent" />
            <span>{RECURRENCE_LABEL[t.recurrence.every]}{t.recurrence.until ? ` até ${formatCivil(t.recurrence.until)}` : ""}{t.recurrence.paused ? " · pausada" : ""}</span>
            <button className="btn btn-ghost min-h-9" onClick={() => act.run((ctx) => updateRow("tasks", t.id, ctx, (x: Task) => ({ ...x, recurrence: x.recurrence && { ...x.recurrence, paused: !x.recurrence.paused } }), t.recurrence?.paused ? "Recorrência retomada" : "Recorrência pausada"))}>{t.recurrence.paused ? "Retomar repetição" : "Pausar repetição"}</button>
            <button className="btn btn-ghost min-h-9" onClick={() => act.run((ctx) => updateRow("tasks", t.id, ctx, (x: Task) => ({ ...x, recurrence: undefined }), "Recorrência encerrada"))}>Parar de repetir</button>
          </div>
        )}
        {blocked && <p className="text-warning">Depende de outra tarefa ainda não concluída.</p>}
        <section>
          <h3 className="mb-2 font-medium">Checklist</h3>
          <ul className="space-y-1">
            {(t.checklist ?? []).map((c) => (
              <li key={c.id}><label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={c.done} onChange={() => act.run((ctx) => updateRow("tasks", t.id, ctx, (x: Task) => ({ ...x, checklist: x.checklist?.map((y) => (y.id === c.id ? { ...y, done: !y.done } : y)) })))} /><span className={c.done ? "line-through text-fg-muted" : ""}>{c.text}</span></label></li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2"><input className="field min-h-9" aria-label="Novo item" placeholder="Novo item" value={item} onChange={(e) => setItem(e.target.value)} /><button className="btn btn-secondary min-h-9" disabled={!item.trim()} onClick={async () => { await act.run((ctx) => updateRow("tasks", t.id, ctx, (x: Task) => ({ ...x, checklist: [...(x.checklist ?? []), { id: crypto.randomUUID().slice(0, 6), text: item.trim(), done: false }] }))); setItem(""); }}>Adicionar</button></div>
        </section>
        <section>
          <h3 className="mb-2 font-medium">Comentários internos</h3>
          <ul className="space-y-2">{(t.comments ?? []).map((c, i) => <li key={i} className="rounded border border-line p-2"><p className="text-xs text-fg-muted">{userName(c.actorId)} · {formatInstant(c.at)}</p><p>{c.text}</p></li>)}</ul>
          <div className="mt-2 flex gap-2"><input className="field min-h-9" aria-label="Comentário" value={comment} onChange={(e) => setComment(e.target.value)} /><button className="btn btn-secondary min-h-9" disabled={!comment.trim()} onClick={async () => { await act.run((ctx) => updateRow("tasks", t.id, ctx, (x: Task) => ({ ...x, comments: [...(x.comments ?? []), { at: new Date().toISOString(), actorId: ctx.actorId, text: comment.trim() }] }))); setComment(""); }}>Comentar</button></div>
        </section>
        <Feedback error={act.error} />
      </div>
    </Dialog>
  );
}

function NewTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { org, user } = useSession();
  const cases = useCollection("cases");
  const act = useAction("tasks");
  const team = users.filter((u) => u.organizationId === org?.id && u.role !== "cliente");
  const [f, setF] = useState({ title: "", caseId: "", assigneeId: user?.id ?? "", due: DEMO_TODAY, priority: "normal" as Task["priority"], every: "" as "" | Recurrence["every"], until: "" });
  return (
    <Dialog open={open} onClose={onClose} title="Nova tarefa">
      <div className="space-y-3">
        <label className="block"><span className="label">Título</span><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="block"><span className="label">Caso (opcional)</span><select className="field" value={f.caseId} onChange={(e) => setF({ ...f, caseId: e.target.value })}><option value="">Sem caso</option>{cases.data?.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Responsável</span><select className="field" value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="block"><span className="label">Prazo</span><input type="date" className="field" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        </div>
        <label className="block"><span className="label">Prioridade</span><select className="field" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Task["priority"] })}><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option></select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">Repetir</span><select className="field" value={f.every} onChange={(e) => setF({ ...f, every: e.target.value as typeof f.every })}><option value="">Não repetir</option>{(Object.keys(RECURRENCE_LABEL) as Recurrence["every"][]).map((k) => <option key={k} value={k}>{RECURRENCE_LABEL[k]}</option>)}</select></label>
          {f.every && <label className="block"><span className="label">Até (opcional)</span><input type="date" className="field" value={f.until} min={f.due} onChange={(e) => setF({ ...f, until: e.target.value })} /></label>}
        </div>
        {f.every && <p className="text-xs text-fg-muted">Ao concluir, a próxima ocorrência é criada automaticamente. Dia 31 em mês curto vira o último dia do mês.</p>}
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={f.title.trim().length < 3 || act.pending || (!!f.until && f.until < f.due)} onClick={async () => {
            const k = cases.data?.find((c) => c.id === f.caseId);
            const recurrence = f.every ? { every: f.every, until: f.until || undefined } : undefined;
            if (await act.run((ctx) => createRow("tasks", { title: f.title.trim(), caseId: f.caseId || undefined, clientId: k?.clientId, assigneeId: f.assigneeId, due: f.due, priority: f.priority, done: false, recurrence, anchorDay: recurrence ? Number(f.due.slice(8, 10)) : undefined }, ctx, recurrence ? `Tarefa recorrente criada (${RECURRENCE_LABEL[recurrence.every]})` : "Tarefa criada"))) { onClose(); setF({ ...f, title: "", every: "", until: "" }); }
          }}>Criar tarefa</button>
        </div>
      </div>
    </Dialog>
  );
}
