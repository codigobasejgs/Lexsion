"use client";

import { useState } from "react";
import { CheckCircle2, FileUp } from "lucide-react";
import { usePortalData } from "@/modules/portal/data";
import { Feedback, useAction } from "@/modules/shared";
import { ALLOWED_MIME, docService, MAX_BYTES } from "@/services/mock/ops-repo";
import { formatInstant } from "@/lib/dates";

export default function PortalDocumentosPage() {
  const d = usePortalData();
  const act = useAction("documents", "files");
  const [sentName, setSentName] = useState<string | null>(null);
  const send = async (docId: string, f?: File) => {
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) return act.setError("Envie uma foto ou um PDF.");
    if (f.size > MAX_BYTES) return act.setError("O arquivo é maior que 15 MB.");
    const doc = d.docsNeeded.find((x) => x.id === docId);
    if (doc && (await act.run((ctx) => docService.upload({ docId, clientId: doc.clientId, caseId: doc.caseId, type: doc.type, file: f, origin: "portal" }, ctx)))) setSentName(f.name);
  };
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-2xl">Documentos</h1>
      {sentName && <p role="status" className="flex items-start gap-2 rounded-[var(--radius-control)] border border-success/30 bg-success-bg p-3 text-sm text-success"><CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" /> “{sentName}” recebido neste aparelho (demonstração). A equipe vai conferir. Nada foi enviado pela internet.</p>}
      <Feedback error={act.error} />
      <section className="panel p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-accent">Pedidos do escritório</h2>
        {d.docsNeeded.length ? (
          <ul className="mt-3 space-y-3">
            {d.docsNeeded.map((x) => (
              <li key={x.id} className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line p-3">
                <span className="font-medium">{x.name}</span>
                {x.requestNote && <span className="text-sm text-fg-muted">{x.requestNote}</span>}
                <label className="btn btn-primary min-h-12 cursor-pointer"><FileUp aria-hidden className="size-5" /> Enviar foto ou arquivo
                  <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" onChange={(e) => send(x.id, e.target.files?.[0])} />
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2">Nenhum pedido no momento.</p>}
      </section>
      <section className="panel p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-accent">Compartilhados com você</h2>
        {d.docsShared.length ? <ul className="mt-2 space-y-1">{d.docsShared.map((x) => <li key={x.id}>{x.name}{x.receivedAt ? <span className="text-sm text-fg-muted"> · {formatInstant(x.receivedAt)}</span> : null}</li>)}</ul> : <p className="mt-2">Nada compartilhado ainda.</p>}
      </section>
    </div>
  );
}
