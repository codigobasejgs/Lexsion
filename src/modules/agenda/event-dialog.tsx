"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui";
import { useCollection, useSession } from "@/components/providers";
import { Feedback, useAction } from "@/modules/shared";
import { eventService, overlaps } from "@/services/mock/ops-repo";
import { civilFromInstant, formatTime } from "@/lib/dates";
import { users } from "@/mocks/fixtures";
import type { CalendarEvent } from "@/domain/types";

const toIso = (date: string, time: string) => `${date}T${time}:00-03:00`;
const hhmm = (iso: string) => formatTime(iso);

/** Criar/editar compromisso. Alerta conflito de horário do mesmo responsável; reagendar exige motivo. */
export function EventDialog({ ev, defaultType, onClose }: { ev?: CalendarEvent; defaultType?: CalendarEvent["type"]; onClose: () => void }) {
  const { org, user } = useSession();
  const events = useCollection("events");
  const cases = useCollection("cases");
  const act = useAction("events");
  const team = users.filter((u) => u.organizationId === org?.id && u.role !== "cliente");
  const [f, setF] = useState({
    title: ev?.title ?? "", type: ev?.type ?? defaultType ?? "atendimento", date: ev ? civilFromInstant(ev.start) : "2026-10-27",
    start: ev ? hhmm(ev.start) : "10:00", end: ev ? hhmm(ev.end) : "11:00", location: ev?.location ?? "", caseId: ev?.caseId ?? "",
    ownerId: ev?.ownerId ?? user?.id ?? "", visibleToClient: ev?.visibleToClient ?? true, requiredDocs: (ev?.requiredDocs ?? []).join("\n"), notes: ev?.notes ?? "",
  });
  const [reason, setReason] = useState("");
  const s = toIso(f.date, f.start);
  const e = toIso(f.date, f.end);
  const conflicts = (events.data ?? []).filter((x) => x.id !== ev?.id && overlaps({ start: new Date(s).toISOString(), end: new Date(e).toISOString(), ownerId: f.ownerId }, { start: new Date(x.start).toISOString(), end: new Date(x.end).toISOString(), ownerId: x.ownerId }));
  const rescheduling = ev && (new Date(ev.start).getTime() !== new Date(s).getTime() || new Date(ev.end).getTime() !== new Date(e).getTime());
  const set = (k: keyof typeof f) => (x: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: x.target.type === "checkbox" ? (x.target as HTMLInputElement).checked : x.target.value });

  return (
    <Dialog open onClose={onClose} title={ev ? "Editar compromisso" : "Novo compromisso"} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="label">Título</span><input className="field" value={f.title} onChange={set("title")} /></label>
          <label className="block"><span className="label">Tipo</span><select className="field" value={f.type} onChange={set("type")}><option value="atendimento">Atendimento</option><option value="audiencia">Audiência</option><option value="pericia">Perícia</option><option value="reuniao">Reunião</option></select></label>
          <label className="block"><span className="label">Responsável</span><select className="field" value={f.ownerId} onChange={set("ownerId")}>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label className="block"><span className="label">Data</span><input type="date" className="field" value={f.date} onChange={set("date")} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="label">Início</span><input type="time" className="field" value={f.start} onChange={set("start")} /></label>
            <label className="block"><span className="label">Fim</span><input type="time" className="field" value={f.end} onChange={set("end")} /></label>
          </div>
          <label className="block"><span className="label">Local ou link</span><input className="field" value={f.location} onChange={set("location")} /></label>
          <label className="block"><span className="label">Caso</span><select className="field" value={f.caseId} onChange={set("caseId")}><option value="">Sem caso</option>{cases.data?.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select></label>
          {(f.type === "audiencia" || f.type === "pericia") && <label className="block sm:col-span-2"><span className="label">Documentos necessários (um por linha)</span><textarea rows={3} className="field py-2" value={f.requiredDocs} onChange={set("requiredDocs")} /></label>}
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.visibleToClient} onChange={set("visibleToClient")} /> Visível para o cliente no portal</label>
        </div>
        {conflicts.length > 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> Conflito de horário com: {conflicts.map((c) => `${c.title} (${hhmm(c.start)}–${hhmm(c.end)})`).join("; ")}. Você pode salvar mesmo assim.
          </p>
        )}
        {rescheduling && <label className="block"><span className="label">Motivo do reagendamento (obrigatório)</span><input className="field" value={reason} onChange={(x) => setReason(x.target.value)} /><span className="mt-1 block text-xs text-fg-muted">Lembretes do horário antigo serão cancelados.</span></label>}
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={f.title.trim().length < 3 || act.pending} onClick={async () => {
            const k = cases.data?.find((c) => c.id === f.caseId);
            const payload = { ...(ev ?? {}), id: ev?.id, title: f.title.trim(), type: f.type as CalendarEvent["type"], start: s, end: e, location: f.location, caseId: f.caseId || undefined, clientId: k?.clientId, ownerId: f.ownerId, visibleToClient: f.visibleToClient, requiredDocs: f.requiredDocs.split("\n").map((x) => x.trim()).filter(Boolean), notes: f.notes, attendance: ev?.attendance ?? (f.type === "audiencia" || f.type === "pericia" ? ("pendente" as const) : undefined) };
            if (await act.run((ctx) => eventService.save(payload, reason, ctx))) onClose();
          }}>Salvar</button>
        </div>
      </div>
    </Dialog>
  );
}
