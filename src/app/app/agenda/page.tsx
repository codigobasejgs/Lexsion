"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { useUrlState, userName } from "@/modules/shared";
import { EventDialog } from "@/modules/agenda/event-dialog";
import { EVENT_TYPE } from "@/modules/cases/labels";
import { overlaps } from "@/services/mock/ops-repo";
import { addDays, civilFromInstant, formatCivil, formatCivilLong, formatTime, type CivilDate } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import type { CalendarEvent } from "@/domain/types";

type View = "lista" | "dia" | "semana" | "mes";

function weekStart(d: CivilDate) {
  const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
  return addDays(d, -((wd + 6) % 7)); // segunda
}

export default function AgendaPage() {
  const url = useUrlState();
  const view = (url.get("ver") as View) ?? "lista";
  const date = url.get("data") ?? DEMO_TODAY;
  const typeFilter = url.get("tipo") ?? "";
  const events = useCollection("events");
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const data = useMemo(() => (events.data ?? []).filter((e) => !typeFilter || e.type === typeFilter).sort((a, b) => a.start.localeCompare(b.start)), [events.data, typeFilter]);
  const conflictIds = useMemo(() => new Set(data.filter((a) => data.some((b) => a.id !== b.id && overlaps(a, b))).map((e) => e.id)), [data]);
  const onDay = (d: CivilDate) => data.filter((e) => civilFromInstant(e.start) === d);

  const exportIcs = () => {
    const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
    const body = data.map((e) => ["BEGIN:VEVENT", `UID:${e.id}@siwiltec.demo`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${esc(`[DEMO] ${e.title}`)}`, `LOCATION:${esc(e.location)}`, "END:VEVENT"].join("\r\n")).join("\r\n");
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//SIWILTEC//Demo//PT-BR\r\n${body}\r\nEND:VCALENDAR\r\n`;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" })), download: "agenda-siwiltec-demo.ics" });
    a.click();
  };

  const step = view === "mes" ? 30 : view === "semana" ? 7 : 1;
  const EventChip = ({ e, compact }: { e: CalendarEvent; compact?: boolean }) => (
    <button onClick={() => setEditing(e)} className={`w-full rounded-[var(--radius-control)] border px-2 py-1 text-left text-xs ${conflictIds.has(e.id) ? "border-warning/60 bg-warning-bg" : e.type === "audiencia" || e.type === "pericia" ? "border-danger/40 bg-danger-bg" : "border-line bg-surface-muted"}`}>
      <span className="num font-semibold">{formatTime(e.start)}</span> {compact ? e.title.slice(0, 22) : e.title}{conflictIds.has(e.id) && " · conflito"}
    </button>
  );

  return (
    <Guard area="agenda">
      <div className="mx-auto max-w-[1300px]">
        <PageHeader title="Agenda" description="Audiências, perícias, atendimentos, reuniões e vencimentos de prazos confirmados."
          actions={<>
            <Link href="/app/audiencias" className="btn btn-secondary">Audiências</Link>
            <Link href="/app/pericias" className="btn btn-secondary">Perícias</Link>
            <button className="btn btn-secondary" onClick={exportIcs} disabled={!data.length}><Download aria-hidden className="size-4" /> Exportar .ics</button>
            <button className="btn btn-primary" data-tour="novo-compromisso" onClick={() => setEditing("new")}><Plus aria-hidden className="size-4" /> Novo compromisso</button>
          </>} />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Visualização" className="inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm">
            {(["lista", "dia", "semana", "mes"] as View[]).map((v) => <button key={v} role="radio" aria-checked={view === v} onClick={() => url.set("ver", v === "lista" ? null : v)} className={`rounded-md px-3 py-1.5 ${view === v ? "bg-brand text-on-brand" : "text-fg-muted"}`}>{{ lista: "Lista", dia: "Dia", semana: "Semana", mes: "Mês" }[v]}</button>)}
          </div>
          {view !== "lista" && (
            <div className="flex items-center gap-1">
              <button className="btn btn-ghost min-h-10 px-2" aria-label="Período anterior" onClick={() => url.set("data", addDays(date, -step))}><ChevronLeft aria-hidden className="size-4" /></button>
              <button className="btn btn-ghost min-h-10" onClick={() => url.set("data", null)}>Hoje</button>
              <button className="btn btn-ghost min-h-10 px-2" aria-label="Próximo período" onClick={() => url.set("data", addDays(date, step))}><ChevronRight aria-hidden className="size-4" /></button>
            </div>
          )}
          <select className="field ml-auto min-h-10 w-auto text-sm" aria-label="Tipo" value={typeFilter} onChange={(e) => url.set("tipo", e.target.value || null)}>
            <option value="">Todos os tipos</option>{Object.entries(EVENT_TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {events.isPending ? <LoadingBlock /> : view === "lista" ? (
          <ListView data={data.filter((e) => civilFromInstant(e.start) >= DEMO_TODAY)} conflictIds={conflictIds} onOpen={setEditing} />
        ) : view === "dia" ? (
          <section className="panel p-4"><h2 className="mb-3 font-semibold capitalize">{formatCivilLong(date)}</h2>{onDay(date).length ? <div className="space-y-2">{onDay(date).map((e) => <EventChip key={e.id} e={e} />)}</div> : <p className="text-sm text-fg-muted">Nenhum compromisso.</p>}</section>
        ) : view === "semana" ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i)).map((d) => (
              <section key={d} aria-label={formatCivil(d)} className={`min-h-32 rounded-[var(--radius-panel)] border p-2 ${d === DEMO_TODAY ? "border-brand" : "border-line"}`}>
                <h2 className="num mb-2 text-xs font-semibold">{formatCivilLong(d).split(",")[0]} {formatCivil(d).slice(0, 5)}</h2>
                <div className="space-y-1">{onDay(d).map((e) => <EventChip key={e.id} e={e} compact />)}</div>
              </section>
            ))}
          </div>
        ) : (
          <MonthView date={date} onDay={onDay} chip={(e) => <EventChip key={e.id} e={e} compact />} />
        )}
      </div>
      {editing && <EventDialog ev={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Guard>
  );
}

function ListView({ data, conflictIds, onOpen }: { data: CalendarEvent[]; conflictIds: Set<string>; onOpen: (e: CalendarEvent) => void }) {
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of data) groups.set(civilFromInstant(e.start), [...(groups.get(civilFromInstant(e.start)) ?? []), e]);
  if (!groups.size) return <EmptyState title="Agenda livre" text="Nenhum compromisso a partir de hoje." />;
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([day, list]) => (
        <section key={day} aria-labelledby={`d-${day}`}>
          <h2 id={`d-${day}`} className="sticky top-14 z-10 mb-2 bg-canvas/95 py-1 text-sm font-semibold capitalize text-accent sm:top-16">{day === DEMO_TODAY ? "Hoje · " : ""}{formatCivilLong(day)}</h2>
          <ul className="panel divide-y divide-line">
            {list.map((e) => (
              <li key={e.id}><button onClick={() => onOpen(e)} className="flex w-full flex-wrap items-start gap-3 p-4 text-left hover:bg-surface-muted/50">
                <span className="num w-24 shrink-0 font-semibold">{formatTime(e.start)}–{formatTime(e.end)}</span>
                <span className="min-w-0 flex-1"><span className="block font-medium">{e.title}</span><span className="text-sm text-fg-muted">{e.location} · {userName(e.ownerId)}</span></span>
                {conflictIds.has(e.id) && <Badge tone="warning">Conflito de horário</Badge>}
                <Badge tone={EVENT_TYPE[e.type].tone}>{EVENT_TYPE[e.type].label}</Badge>
              </button></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MonthView({ date, onDay, chip }: { date: CivilDate; onDay: (d: CivilDate) => CalendarEvent[]; chip: (e: CalendarEvent) => React.ReactNode }) {
  const first = `${date.slice(0, 7)}-01`;
  const start = weekStart(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div>
      <h2 className="mb-2 font-semibold capitalize">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${first}T12:00:00Z`))}</h2>
      <div className="grid grid-cols-7 gap-1 text-xs" role="grid" aria-label="Mês">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => <div key={d} role="columnheader" className="px-1 py-1 text-center font-semibold text-fg-muted">{d}</div>)}
        {days.map((d) => (
          <div key={d} role="gridcell" aria-label={formatCivil(d)} className={`min-h-20 overflow-hidden rounded border p-1 ${d.slice(0, 7) !== date.slice(0, 7) ? "opacity-40" : ""} ${d === DEMO_TODAY ? "border-brand" : "border-line"}`}>
            <p className="num mb-1">{Number(d.slice(8))}</p>
            <div className="space-y-0.5">{onDay(d).slice(0, 3).map(chip)}{onDay(d).length > 3 && <p className="text-fg-muted">+{onDay(d).length - 3}</p>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
