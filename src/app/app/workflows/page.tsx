"use client";

import Link from "next/link";
import { useState } from "react";
import { GitBranch } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { tasksService } from "@/services/mock/repo";
import { scheduleWorkflow, WORKFLOW_TEMPLATES } from "@/domain/workflows";
import { DEMO_TODAY } from "@/mocks/clock";
import { formatCivil } from "@/lib/dates";

const ROLE_LABEL = { advogado: "Advogado(a)", atendimento: "Atendimento", controladoria: "Controladoria", financeiro: "Financeiro", estagiario: "Estagiário(a)" } as const;

// Workflows por tipo de caso: aplica um modelo ao caso e gera tarefas encadeadas (a próxima só libera quando a anterior conclui).
export default function WorkflowsPage() {
  const cases = useCollection("cases");
  const users = useCollection("users");
  const settings = useCollection("settings");
  const act = useAction("tasks");
  const [sel, setSel] = useState(WORKFLOW_TEMPLATES[0].id);
  const [caseId, setCaseId] = useState("");
  const t = WORKFLOW_TEMPLATES.find((x) => x.id === sel)!;
  const plan = scheduleWorkflow(t, DEMO_TODAY, settings.data?.[0]?.holidays ?? []);
  const byRole = (role: string) => users.data?.find((u) => u.role === role)?.id;
  const assignees = Object.fromEntries(Object.keys(ROLE_LABEL).map((r) => [r, byRole(r)]).filter(([, v]) => v)) as Record<string, string>;
  return (
    <Guard area="tarefas">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Workflows" description="Modelos de etapas por tipo de caso. Aplicar ao caso cria tarefas encadeadas, com prazo em dias úteis (feriados do escritório)." />
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <nav aria-label="Modelos de workflow" className="panel p-2">
            <ul className="space-y-1">{WORKFLOW_TEMPLATES.map((w) => (
              <li key={w.id}><button aria-current={w.id === sel ? "true" : undefined} onClick={() => setSel(w.id)} className={`w-full rounded-[var(--radius-control)] p-3 text-left text-sm ${w.id === sel ? "bg-selection font-medium" : "hover:bg-surface-muted"}`}>
                <span className="block">{w.name}</span><span className="text-xs text-fg-muted">{w.area} · {w.steps.length} etapas</span>
              </button></li>
            ))}</ul>
          </nav>
          <section className="panel space-y-4 p-4 text-sm" aria-labelledby="wf-t" data-tour="workflow-modelo">
            <h2 id="wf-t" className="flex items-center gap-2 font-semibold"><GitBranch aria-hidden className="size-4 text-accent" /> {t.name}</h2>
            <ol className="space-y-2">{plan.map(({ step, due }, i) => (
              <li key={step.title} className="rounded-[var(--radius-control)] border border-line p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="num font-semibold">{i + 1}.</span><span className="min-w-0 flex-1 font-medium">{step.title}</span><Badge icon={false}>{ROLE_LABEL[step.role]}</Badge></div>
                <p className="mt-1 text-fg-muted">{step.days} dia(s) útil(eis){i ? " após a etapa anterior" : ""} · vence <span className="num">{formatCivil(due)}</span> se aplicado hoje</p>
                {step.checklist && <ul className="mt-1 list-disc pl-5 text-xs text-fg-muted">{step.checklist.map((c) => <li key={c}>{c}</li>)}</ul>}
              </li>
            ))}</ol>
            <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
              <label className="block min-w-56 flex-1"><span className="label">Aplicar ao caso</span>
                <select className="field" value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Escolha o caso</option>{cases.data?.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select>
              </label>
              <button className="btn btn-primary" disabled={!caseId || act.pending} onClick={() => act.run((ctx) => tasksService.applyWorkflow(t.id, caseId, assignees, ctx), (r) => (r.created ? `${r.created} tarefa(s) criada(s) no caso, encadeadas.` : "Este workflow já foi aplicado a este caso: nada duplicado."))}>Aplicar workflow</button>
              {caseId && <Link className="btn btn-ghost" href={`/app/casos/${caseId}?aba=tarefas`}>Ver tarefas do caso</Link>}
            </div>
            <Feedback error={act.error} notice={act.notice} />
            <p className="text-xs text-fg-muted">Contagem em dias úteis demonstrativa: suspensões e calendário do tribunal exigem conferência. Responsável sugerido pela função; ajuste em Tarefas.</p>
          </section>
        </div>
      </div>
    </Guard>
  );
}
