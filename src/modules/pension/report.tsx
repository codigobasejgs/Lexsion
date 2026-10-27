"use client";

import { useRouter } from "next/navigation";
import { FilePlus2, FileText, Printer } from "lucide-react";
import { Feedback, useAction } from "@/modules/shared";
import { createRow } from "@/services/mock/generic";
import { docService } from "@/services/mock/ops-repo";

/** Etapas finais do cenário 2: solicitação complementar, minuta para revisão e relatório demonstrativo. */
export function PensionReport({ analysisId, clientId, caseId, clientName, stale, pending, scenarios }: { analysisId: string; clientId: string; caseId: string; clientName: string; stale: boolean; pending: string[]; scenarios: string[] }) {
  const router = useRouter();
  const act = useAction("documents", "drafts");
  const report = [
    `RELATÓRIO DEMONSTRATIVO — ${clientName}`,
    "Exemplo demonstrativo — cálculo jurídico não validado.",
    "",
    "FATOS E DOCUMENTOS",
    "— Histórico do CNIS (documento de teste) e CTPS conferidos parcialmente.",
    "",
    "PENDÊNCIAS",
    ...(pending.length ? pending.map((p) => `— ${p}`) : ["— Nenhuma"]),
    "",
    "CENÁRIOS",
    ...scenarios.map((s) => `— ${s}`),
    "",
    "LIMITAÇÕES",
    "— Resultados fixos de cenário de teste; não há motor previdenciário validado nesta fase.",
    "— Revisão profissional obrigatória antes de qualquer orientação ao cliente.",
  ].join("\n");

  return (
    <section className="panel mt-5 space-y-3 p-4 text-sm" aria-labelledby="rel-t">
      <h2 id="rel-t" className="font-semibold">Revisão e relatório</h2>
      {stale && <p className="text-warning">Resultados desatualizados: revise os cenários antes de gerar o relatório.</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary" onClick={() => act.run((ctx) => docService.request({ clientId, caseId, name: "Documento complementar: prova do período 07/1991–02/1994", type: "Comprovante", note: "Solicitado a partir da análise previdenciária" }, ctx), "Solicitação complementar criada (aparece no portal do cliente).")}><FilePlus2 aria-hidden className="size-4" /> Solicitar documento complementar</button>
        <button className="btn btn-secondary" disabled={stale} onClick={async () => {
          const r = await act.run((ctx) => createRow("drafts", { title: `Relatório previdenciário — ${clientName}`, kind: "relatório", caseId, body: report, status: "rascunho", references: [], comments: [], history: [{ at: new Date().toISOString(), actorId: ctx.actorId, text: `Gerado da análise ${analysisId}` }], updatedAt: new Date().toISOString() }, ctx, "Relatório gerado"));
          if (r) router.push(`/app/minutas/${r.id}`);
        }}><FileText aria-hidden className="size-4" /> Gerar minuta do relatório para revisão</button>
        <button className="btn btn-ghost" onClick={() => window.print()}><Printer aria-hidden className="size-4" /> Imprimir tela</button>
      </div>
      <Feedback error={act.error} notice={act.notice} />
    </section>
  );
}
