"use client";

import { useState } from "react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { DOC_TYPES, UploadDialog } from "@/modules/documents/upload";
import { docService } from "@/services/mock/ops-repo";
import { formatInstant } from "@/lib/dates";
import type { DocType, DocumentItem } from "@/domain/types";

// Checklist por tipo de caso: identifica faltantes sem afirmar inexistência de direito.
const CHECKLIST: Record<string, string[]> = {
  "Concessão BPC": ["RG", "CPF", "Comprovante de residência", "Folha resumo do CadÚnico"],
  "Planejamento RGPS": ["CNIS", "Carteira de trabalho", "PPP (se houver atividade especial)"],
  "Concessão rural": ["Documentos pessoais", "Prova de atividade rural (sindicato, notas, ITR)"],
};

export default function SolicitacoesPage() {
  const docs = useCollection("documents");
  const clients = useCollection("clients");
  const cases = useCollection("cases");
  const act = useAction("documents");
  const [clientId, setClientId] = useState("");
  const [caseId, setCaseId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<DocType>("Comprovante");
  const [receiving, setReceiving] = useState<DocumentItem | null>(null);
  const pending = (docs.data ?? []).filter((d) => d.status === "solicitado");
  const k = cases.data?.find((x) => x.id === caseId);
  const suggested = k ? CHECKLIST[k.service] ?? [] : [];

  return (
    <Guard area="documentos">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader breadcrumb={[{ href: "/app/documentos", label: "Documentos" }]} title="Solicitações de documentos" description="Pedidos ao cliente aparecem no portal dele. A falta de um documento é pendência de prova, não ausência de direito." />
        <section className="panel mb-6 space-y-3 p-4" data-tour="nova-solicitacao">
          <h2 className="font-semibold">Nova solicitação</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block"><span className="label">Cliente</span><select className="field" value={clientId} onChange={(e) => { setClientId(e.target.value); setCaseId(""); }}><option value="">Escolha…</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="block"><span className="label">Caso</span><select className="field" value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Sem caso</option>{cases.data?.filter((x) => x.clientId === clientId).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
            <label className="block"><span className="label">Documento</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="block"><span className="label">Tipo</span><select className="field" value={type} onChange={(e) => setType(e.target.value as DocType)}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          </div>
          {suggested.length > 0 && <p className="text-sm text-fg-muted">Checklist do serviço: {suggested.map((s) => <button key={s} className="mr-1 underline underline-offset-2" onClick={() => setName(s)}>{s}</button>)}</p>}
          <Feedback error={act.error} notice={act.notice} />
          <button className="btn btn-primary" disabled={!clientId || name.trim().length < 2 || act.pending} onClick={async () => { if (await act.run((ctx) => docService.request({ clientId, caseId: caseId || undefined, name: name.trim(), type }, ctx), "Solicitação criada e visível no portal do cliente.")) setName(""); }}>Solicitar documento</button>
        </section>
        <h2 className="mb-2 font-semibold">Pendentes ({pending.length})</h2>
        {docs.isPending ? <LoadingBlock /> : !pending.length ? <EmptyState title="Nada pendente" text="Todos os documentos solicitados foram recebidos." /> : (
          <ul className="panel divide-y divide-line">
            {pending.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1"><span className="block font-medium">{d.name}</span><span className="text-fg-muted">{clients.data?.find((c) => c.id === d.clientId)?.name}{d.requestedAt ? ` · pedido em ${formatInstant(d.requestedAt)}` : ""}</span></span>
                <Badge tone="warning">Solicitado</Badge>
                <button className="btn btn-secondary min-h-9" onClick={() => setReceiving(d)}>Registrar recebimento</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {receiving && <UploadDialog open onClose={() => setReceiving(null)} preset={{ docId: receiving.id, clientId: receiving.clientId, caseId: receiving.caseId, type: receiving.type }} />}
    </Guard>
  );
}
