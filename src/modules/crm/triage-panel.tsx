"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { useSession } from "@/components/providers";
import { Feedback, useAction, userName } from "@/modules/shared";
import { crmService } from "@/services/mock/crm-repo";
import { TRIAGE_AREAS, triageChecklist, triageScript } from "@/domain/triage";
import { formatInstant } from "@/lib/dates";
import { users } from "@/mocks/fixtures";
import type { Lead } from "@/domain/types";

/** Triagem por área: perguntas vêm de dados; resultado é checklist + encaminhamento, nunca parecer jurídico. */
export function TriagePanel({ lead }: { lead: Lead }) {
  const { org } = useSession();
  const act = useAction("leads");
  const [area, setArea] = useState(lead.triage?.area ?? lead.area);
  const [answers, setAnswers] = useState<Record<string, string>>(lead.triage?.answers ?? {});
  const [routedTo, setRoutedTo] = useState(lead.triage?.routedTo ?? lead.ownerId ?? "");
  const script = triageScript(area);
  const checklist = triageChecklist(script, answers);
  const team = users.filter((u) => u.organizationId === org?.id && (u.role === "advogado" || u.role === "admin" || u.role === "controladoria"));
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  return (
    <section className="panel space-y-3 p-4 text-sm" aria-labelledby="tri-t" data-tour="triagem">
      <h2 id="tri-t" className="flex items-center gap-2 font-semibold"><ClipboardCheck aria-hidden className="size-4 text-accent" /> Triagem</h2>
      <p className="text-fg-muted">Coleta de fatos para a equipe. Não conclui se há direito — quem avalia é o(a) advogado(a).</p>
      {lead.triage && <p className="text-xs text-fg-muted">Última triagem: {formatInstant(lead.triage.at)} por {userName(lead.triage.actorId)}, encaminhada a {userName(lead.triage.routedTo)}.</p>}
      <label className="block"><span className="label">Área do Direito</span>
        <select className="field" value={area} onChange={(e) => { setArea(e.target.value); setAnswers({}); }}>{TRIAGE_AREAS.map((a) => <option key={a}>{a}</option>)}</select>
      </label>
      <ol className="space-y-3">
        {script.questions.map((q) => (
          <li key={q.id}>
            {q.kind === "sim_nao" ? (
              <fieldset><legend className="mb-1">{q.text}</legend>
                <div className="flex gap-4">{(["sim", "nao"] as const).map((v) => <label key={v} className="flex min-h-10 items-center gap-2"><input type="radio" name={`tri-${q.id}`} className="size-4 accent-[var(--brand)]" checked={answers[q.id] === v} onChange={() => set(q.id, v)} />{v === "sim" ? "Sim" : "Não"}</label>)}</div>
              </fieldset>
            ) : (
              <label className="block"><span className="mb-1 block">{q.text}</span><input className="field" type={q.kind === "data" ? "date" : "text"} value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} /></label>
            )}
          </li>
        ))}
      </ol>
      <div className="rounded-[var(--radius-control)] border border-line p-3">
        <p className="font-medium">Documentos a pedir</p>
        <ul className="mt-1 list-disc pl-5">{checklist.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
      <label className="block"><span className="label">Encaminhar para</span>
        <select className="field" value={routedTo} onChange={(e) => setRoutedTo(e.target.value)}><option value="">Escolha…</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      </label>
      <Feedback error={act.error} notice={act.notice} />
      <button className="btn btn-primary" disabled={act.pending} onClick={() => act.run((ctx) => crmService.triage(lead.id, area, answers, routedTo, ctx), "Triagem registrada e encaminhada para revisão profissional.")}>Registrar triagem e encaminhar</button>
    </section>
  );
}
