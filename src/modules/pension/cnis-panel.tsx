"use client";

import { useState } from "react";
import { Activity, FileQuestion } from "lucide-react";
import { useCollection } from "@/components/providers";
import { Badge } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { docService } from "@/services/mock/ops-repo";
import { analyzeCnis, formatMonths, ISSUE_LABEL } from "@/domain/cnis";
import type { ContributionPeriod } from "@/domain/types";

// Diagnóstico explicável do CNIS (núcleo comum src/domain/cnis.ts). Pedir documento cria solicitação
// real no mock (aparece no portal do cliente) — nunca envia mensagem.
export function CnisDiagnosis({ periods, clientId, caseId }: { periods: ContributionPeriod[]; clientId: string; caseId: string }) {
  const docs = useCollection("documents");
  const act = useAction("documents");
  const [asked, setAsked] = useState<string[]>([]);
  const withoutProof = periods.filter((p) => !docs.data?.some((d) => d.id === p.evidence.documentId)).map((p) => p.id);
  const r = analyzeCnis(periods, { withoutProof });
  const requested = (text: string) => asked.includes(text) || !!docs.data?.some((d) => d.caseId === caseId && d.status === "solicitado" && d.requestNote === text);
  return (
    <section className="panel p-4" aria-labelledby="diag-title" data-testid="cnis-diagnostico">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 id="diag-title" className="flex flex-1 items-center gap-2 font-semibold"><Activity aria-hidden className="size-4 text-accent" /> Diagnóstico do CNIS</h2>
        <Badge tone={r.score >= 80 ? "success" : r.score >= 60 ? "warning" : "danger"}>Qualidade {r.score}/100</Badge>
      </div>
      <p className="text-sm">Tempo coberto (meses civis, concomitância conta uma vez): <strong className="num">{formatMonths(r.months)}</strong></p>
      <p className="mb-3 text-xs text-fg-muted">Diagnóstico por regras demonstrativas: começa em 100 e cada inconsistência desconta o peso indicado. Não é carência nem tempo para benefício (dependem da regra aplicável e de revisão profissional).</p>
      {r.issues.length === 0 ? <p className="text-sm text-success">Nenhuma inconsistência pelas regras demonstrativas.</p> : (
        <ul className="space-y-2">
          {r.issues.map((i) => (
            <li key={`${i.kind}-${i.periodIds.join("-")}`} className="rounded-[var(--radius-control)] border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="warning">{ISSUE_LABEL[i.kind]}</Badge><span className="num text-xs text-fg-muted">−{i.weight}</span></div>
              <p className="mt-1">{i.text}</p>
              <p className="mt-1 text-fg-muted">Ação: {i.action}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {requested(i.action + " — " + i.text) ? <Badge tone="info">Pedido ao cliente</Badge> : (
                  <button className="btn btn-ghost min-h-9" onClick={async () => { const note = i.action + " — " + i.text; const ok = await act.run((ctx) => docService.request({ clientId, caseId, name: `Prova: ${ISSUE_LABEL[i.kind]}`, type: "Outro", note }, ctx), "Solicitação criada: aparece no portal do cliente."); if (ok) setAsked((a) => [...a, note]); }}><FileQuestion aria-hidden className="size-4" /> Pedir documento ao cliente</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Feedback error={act.error} notice={act.notice} />
    </section>
  );
}
