"use client";

import { useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { Dialog } from "@/components/ui";
import { useCollection } from "@/components/providers";
import { Feedback, useAction } from "@/modules/shared";
import { ALLOWED_MIME, docService, MAX_BYTES } from "@/services/mock/ops-repo";
import type { DocType, DocumentItem } from "@/domain/types";

export const DOC_TYPES: DocType[] = ["CNIS", "CTPS", "PPP", "Carta de concessão", "HISCRE", "Laudo", "Exame", "Documento pessoal", "Comprovante", "Contrato", "Peça", "Outro"];

/** Upload local com validação antes de gravar; câmera no celular. */
export function UploadDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { docId?: string; clientId?: string; caseId?: string; type?: DocType } }) {
  const clients = useCollection("clients");
  const cases = useCollection("cases");
  const act = useAction("documents", "files");
  const [clientId, setClientId] = useState(preset?.clientId ?? "");
  const [caseId, setCaseId] = useState(preset?.caseId ?? "");
  const [type, setType] = useState<DocType>(preset?.type ?? "Documento pessoal");
  const [file, setFile] = useState<File | null>(null);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<DocumentItem | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    setDone(null);
    setLocalErr(null);
    if (!f) return;
    if (!ALLOWED_MIME.includes(f.type)) return setLocalErr("Tipo de arquivo não aceito. Envie PDF ou imagem (JPG, PNG, WEBP, HEIC).");
    if (f.size > MAX_BYTES) return setLocalErr("Arquivo maior que 15 MB.");
    setFile(f);
  };

  const send = async () => {
    if (!file) return;
    // Progresso honesto: gravação local é rápida; mostramos etapas reais (ler → gravar).
    setProgress(30);
    const r = await act.run((ctx) => docService.upload({ docId: preset?.docId, clientId, caseId: caseId || undefined, type, file }, ctx));
    setProgress(r ? 100 : 0);
    if (r) setDone(r);
  };

  return (
    <Dialog open={open} onClose={onClose} title={preset?.docId ? "Enviar documento solicitado" : "Enviar documento"} wide>
      {done ? (
        <div className="space-y-3 text-sm" role="status">
          <p className="font-medium text-success">Recebido localmente: {file?.name}</p>
          <p className="text-fg-muted">Recebido localmente; análise automática depende da próxima fase. Nenhuma informação foi extraída deste arquivo.</p>
          <div className="flex justify-end gap-2"><a className="btn btn-secondary" href={`/app/documentos/${done.id}`}>Abrir documento</a><button className="btn btn-primary" onClick={onClose}>Concluir</button></div>
        </div>
      ) : (
        <div className="space-y-4">
          {!preset?.docId && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block"><span className="label">Cliente</span><select className="field" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Escolha…</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="block"><span className="label">Caso (opcional)</span><select className="field" value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Sem caso</option>{cases.data?.filter((k) => k.clientId === clientId).map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select></label>
              <label className="block"><span className="label">Tipo</span><select className="field" value={type} onChange={(e) => setType(e.target.value as DocType)}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            </div>
          )}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
            className="flex flex-col items-center gap-3 rounded-[var(--radius-panel)] border-2 border-dashed border-line p-6 text-center text-sm"
          >
            <Upload aria-hidden className="size-8 text-fg-muted" />
            <p>Arraste um PDF ou imagem aqui, ou escolha:</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>Escolher arquivo</button>
              <label className="btn btn-secondary cursor-pointer"><Camera aria-hidden className="size-4" /> Fotografar documento<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /></label>
            </div>
            <input ref={input} type="file" accept={ALLOWED_MIME.join(",")} className="sr-only" aria-label="Arquivo" onChange={(e) => pick(e.target.files?.[0])} />
            <p className="text-xs text-fg-muted">PDF, JPG, PNG, WEBP ou HEIC até 15 MB. HTML e executáveis são recusados.</p>
            {file && <p className="font-medium">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
          </div>
          {progress > 0 && progress < 100 && <progress className="w-full" value={progress} max={100} aria-label="Progresso do envio" />}
          {localErr && <p role="alert" className="text-sm text-danger">{localErr}</p>}
          <Feedback error={act.error} />
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={!file || (!preset?.docId && !clientId) || act.pending} onClick={send}>Enviar</button></div>
        </div>
      )}
    </Dialog>
  );
}
