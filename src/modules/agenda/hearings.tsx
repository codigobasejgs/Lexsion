"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { EventDialog } from "./event-dialog";
import { updateRow } from "@/services/mock/generic";
import { civilFromInstant, formatCivil, formatTime } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import type { CalendarEvent } from "@/domain/types";

const ATT = { pendente: { label: "A realizar", tone: "neutral" }, compareceu: { label: "Compareceu", tone: "success" }, ausente: { label: "Ausente", tone: "danger" }, cancelado: { label: "Cancelado", tone: "neutral" } } as const;

/** Lista de audiências ou perícias: documentos necessários, comparecimento e resultado. */
export function HearingsPage({ type }: { type: "audiencia" | "pericia" }) {
  const events = useCollection("events");
  const cases = useCollection("cases");
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const [recording, setRecording] = useState<CalendarEvent | null>(null);
  const rows = (events.data ?? []).filter((e) => e.type === type).sort((a, b) => a.start.localeCompare(b.start));
  const title = type === "audiencia" ? "Audiências" : "Perícias";
  return (
    <Guard area="agenda">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader breadcrumb={[{ href: "/app/agenda", label: "Agenda" }]} title={title} description="Dados, documentos necessários, comparecimento e resultado. Reagendar registra histórico." actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus aria-hidden className="size-4" /> {type === "audiencia" ? "Nova audiência" : "Nova perícia"}</button>} />
        {events.isPending ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title={`Sem ${title.toLowerCase()}`} text="Cadastre a partir do caso ou aqui." /> : (
          <ul className="space-y-3">
            {rows.map((e) => {
              const k = cases.data?.find((c) => c.id === e.caseId);
              const past = civilFromInstant(e.start) < DEMO_TODAY;
              const att = e.attendance ?? "pendente";
              return (
                <li key={e.id} className="panel p-4 text-sm">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{e.title}</p>
                      <p className="num text-fg-muted">{formatCivil(civilFromInstant(e.start))} · {formatTime(e.start)}–{formatTime(e.end)} · {e.location}</p>
                      <p className="text-fg-muted">Responsável: {userName(e.ownerId)}{k && <> · <Link className="underline underline-offset-2" href={`/app/casos/${k.id}`}>{k.title}</Link></>}</p>
                    </div>
                    <Badge tone={ATT[att].tone}>{ATT[att].label}</Badge>
                  </div>
                  {!!e.requiredDocs?.length && <p className="mt-2"><span className="text-fg-muted">Levar:</span> {e.requiredDocs.join(", ")}</p>}
                  {!!e.participants?.length && <p><span className="text-fg-muted">Participantes:</span> {e.participants.join(", ")}</p>}
                  {e.result && <p className="mt-1"><span className="text-fg-muted">Resultado:</span> {e.result}</p>}
                  {!!e.history?.length && <details className="mt-2"><summary className="cursor-pointer text-fg-muted">Histórico ({e.history.length})</summary><ul className="mt-1 list-disc pl-5">{e.history.map((h, i) => <li key={i}>{h.text}</li>)}</ul></details>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn btn-secondary min-h-9" onClick={() => setEditing(e)}>Editar ou reagendar</button>
                    {(past || att !== "pendente") && <button className="btn btn-ghost min-h-9" onClick={() => setRecording(e)}>Registrar comparecimento e resultado</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {editing && <EventDialog ev={editing === "new" ? undefined : editing} defaultType={type} onClose={() => setEditing(null)} />}
      {recording && <ResultDialog e={recording} onClose={() => setRecording(null)} />}
    </Guard>
  );
}

function ResultDialog({ e, onClose }: { e: CalendarEvent; onClose: () => void }) {
  const act = useAction("events");
  const [att, setAtt] = useState<NonNullable<CalendarEvent["attendance"]>>(e.attendance ?? "compareceu");
  const [result, setResult] = useState(e.result ?? "");
  return (
    <Dialog open onClose={onClose} title="Comparecimento e resultado">
      <div className="space-y-3">
        <label className="block"><span className="label">Comparecimento</span><select className="field" value={att} onChange={(x) => setAtt(x.target.value as typeof att)}><option value="compareceu">Compareceu</option><option value="ausente">Ausente</option><option value="cancelado">Cancelado</option><option value="pendente">A realizar</option></select></label>
        <label className="block"><span className="label">Resultado</span><textarea rows={3} className="field py-2" value={result} onChange={(x) => setResult(x.target.value)} /></label>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={async () => { if (await act.run((ctx) => updateRow("events", e.id, ctx, (x: CalendarEvent) => ({ ...x, attendance: att, result: result.trim() || undefined, history: [...(x.history ?? []), { at: new Date().toISOString(), actorId: ctx.actorId, text: `Comparecimento: ${att}` }] }), "Resultado registrado"))) onClose(); }}>Salvar</button>
        </div>
      </div>
    </Dialog>
  );
}
