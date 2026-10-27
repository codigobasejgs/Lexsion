"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui";
import { useCollection, useSession } from "@/components/providers";
import { Feedback, useAction } from "@/modules/shared";
import { countDeadline } from "@/domain/deadlines";
import { deadlineService } from "@/services/mock/ops-repo";
import { formatCivil } from "@/lib/dates";
import { canApprove } from "@/domain/permissions";
import type { Deadline } from "@/domain/types";

export function CountMemory({ start, days, counting }: { start: string; days: number; counting: "uteis" | "corridos" }) {
  const settings = useCollection("settings");
  const s = settings.data?.[0];
  const r = useMemo(() => {
    try {
      return countDeadline(start, days, counting, s?.holidays ?? []);
    } catch {
      return null;
    }
  }, [start, days, counting, s]);
  if (!r) return <p className="text-sm text-danger">Dados insuficientes para contar.</p>;
  return (
    <details className="rounded-[var(--radius-control)] border border-line p-3 text-sm">
      <summary className="cursor-pointer font-medium">Memória de contagem (calendário {s?.calendarVersion ?? "—"}) — término proposto {formatCivil(r.end)}</summary>
      <ol className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
        {r.memory.map((d) => (
          <li key={d.date} className={`num flex gap-3 ${d.counted ? "" : "text-fg-muted"}`}>
            <span className="w-24">{formatCivil(d.date)}</span><span className="w-8">{d.weekday}</span>
            <span>{d.counted ? `dia ${d.n}` : "—"}</span>{d.reason && <span className="text-xs">({d.reason})</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function NewDeadlineDialog({ open, onClose, caseId: fixedCase, publicationId, defaults }: { open: boolean; onClose: () => void; caseId?: string; publicationId?: string; defaults?: { title?: string; days?: number; start?: string } }) {
  const cases = useCollection("cases");
  const act = useAction("deadlines", "publications");
  const [caseId, setCaseId] = useState(fixedCase ?? "");
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [start, setStart] = useState(defaults?.start ?? "2026-10-26");
  const [days, setDays] = useState(defaults?.days ?? 15);
  const [counting, setCounting] = useState<"uteis" | "corridos">("uteis");
  const [court, setCourt] = useState("TRF1");
  return (
    <Dialog open={open} onClose={onClose} title="Novo prazo (proposto)" wide>
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> Contagem demonstrativa. O prazo só vale depois de conferido e confirmado por advogado(a).</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Caso</span>
            <select className="field" value={caseId} onChange={(e) => setCaseId(e.target.value)} disabled={!!fixedCase}><option value="">Escolha…</option>{cases.data?.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select>
          </label>
          <label className="block"><span className="label">Título</span><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block"><span className="label">Marco inicial (data da intimação/ciência)</span><input type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="block"><span className="label">Quantidade de dias</span><input type="number" min={1} max={365} className="field num" value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
          <label className="block"><span className="label">Contagem</span><select className="field" value={counting} onChange={(e) => setCounting(e.target.value as "uteis" | "corridos")}><option value="uteis">Dias úteis</option><option value="corridos">Dias corridos</option></select></label>
          <label className="block"><span className="label">Tribunal/localidade</span><input className="field" value={court} onChange={(e) => setCourt(e.target.value)} /></label>
        </div>
        {start && days > 0 && <CountMemory start={start} days={days} counting={counting} />}
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!caseId || !title.trim() || act.pending} onClick={async () => {
            if (await act.run((ctx) => deadlineService.propose({ caseId, title: title.trim(), eventType: "Intimação", start, days, counting, court, publicationId }, ctx))) onClose();
          }}>Registrar prazo proposto</button>
        </div>
      </div>
    </Dialog>
  );
}

export function ConfirmDeadlineDialog({ d, onClose }: { d: Deadline; onClose: () => void }) {
  const { user } = useSession();
  const act = useAction("deadlines", "events");
  const [end, setEnd] = useState(d.proposedEnd);
  const [why, setWhy] = useState("");
  const allowed = user && canApprove(user.role);
  return (
    <Dialog open onClose={onClose} title={`Confirmar prazo: ${d.title}`} wide>
      <div className="space-y-4 text-sm">
        <CountMemory start={d.start} days={d.days} counting={d.counting} />
        {!allowed && <p role="alert" className="text-warning">Somente advogado(a) ou administrador confirma prazos.</p>}
        <label className="block"><span className="label">Término confirmado</span><input type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        <label className="block"><span className="label">Justificativa {end === d.proposedEnd ? "(opcional)" : "(obrigatória: data difere da proposta)"}</span><textarea rows={2} className="field py-2" value={why} onChange={(e) => setWhy(e.target.value)} /></label>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={!allowed || act.pending} onClick={async () => { if (await act.run((ctx) => deadlineService.confirm(d.id, end, why, ctx))) onClose(); }}>Confirmar prazo</button>
        </div>
      </div>
    </Dialog>
  );
}
