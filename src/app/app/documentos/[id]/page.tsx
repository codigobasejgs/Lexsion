"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { CheckCircle2, Download, Lock, Trash2, Upload } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { DOC_STATUS } from "@/modules/cases/labels";
import { UploadDialog } from "@/modules/documents/upload";
import { docService } from "@/services/mock/ops-repo";
import { readAll } from "@/services/mock/db";
import { formatInstant } from "@/lib/dates";
import type { ExtractedField, StoredFile } from "@/domain/types";
import { useRouter } from "next/navigation";

const CONF = { alta: "success", media: "warning", baixa: "danger" } as const;

export default function DocumentoPage({ params }: PageProps<"/app/documentos/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useSession();
  const docs = useCollection("documents");
  const clients = useCollection("clients");
  const act = useAction("documents", "files");
  const [uploading, setUploading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const d = docs.data?.find((x) => x.id === id);
  const lastFileId = d?.versions?.at(-1)?.fileId;
  const [file, setFile] = useState<StoredFile | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | null = null;
    if (!lastFileId) return;
    readAll("files").then((fs) => {
      const f = fs.find((x) => x.id === lastFileId) ?? null;
      setFile(f);
      // Só PDF/imagem são exibidos; HTML nunca é renderizado.
      if (f && (f.mime === "application/pdf" || f.mime.startsWith("image/"))) {
        revoke = URL.createObjectURL(f.blob);
        setUrl(revoke);
      }
    });
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [lastFileId]);

  if (docs.isPending) return <LoadingBlock rows={5} />;
  if (!d) return <EmptyState title="Documento não encontrado" text="Pode ter sido removido ou pertencer a outro escritório." action={<Link className="btn btn-secondary" href="/app/documentos">Voltar</Link>} />;
  const health = d.type === "Laudo" || d.type === "Exame";
  const restricted = health && user?.role !== "admin" && user?.role !== "advogado";
  const client = clients.data?.find((c) => c.id === d.clientId);

  return (
    <Guard area="documentos">
      <div className="mx-auto max-w-[1400px]">
        <PageHeader breadcrumb={[{ href: "/app/documentos", label: "Documentos" }]} title={d.name} description={<>{d.type} · {client && <Link className="underline underline-offset-2" href={`/app/clientes/${client.id}`}>{client.name}</Link>}</>}
          actions={<>
            <Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>
            <button className="btn btn-secondary" onClick={() => setUploading(true)}><Upload aria-hidden className="size-4" /> {d.receivedAt ? "Nova versão" : "Registrar recebimento"}</button>
          </>} />
        {health && <p className="mb-4 flex items-center gap-2 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning"><Lock aria-hidden className="size-4" /> Dado de saúde: acesso restrito. A IA resume para o advogado, sem diagnóstico médico.</p>}
        <Feedback error={act.error} notice={act.notice} />

        {restricted ? <EmptyState title="Acesso restrito" text="Seu perfil não visualiza documentos de saúde." /> : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-label="Documento" className="panel flex min-h-[420px] flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm">
                <span className="flex-1 text-fg-muted">{file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : d.hasFixtureExtraction ? "Documento de teste (fixture) — prévia textual" : "Sem arquivo local"}</span>
                {url && file && <a className="btn btn-ghost min-h-8 text-xs" href={url} download={file.name}><Download aria-hidden className="size-3.5" /> Baixar</a>}
              </div>
              {url && file?.mime === "application/pdf" ? <iframe title={`Prévia de ${d.name}`} src={url} sandbox="" className="h-[70dvh] w-full bg-white" /> :
                // eslint-disable-next-line @next/next/no-img-element -- blob local; next/image não otimiza blob:
                url ? <img src={url} alt={`Prévia de ${d.name}`} className="max-h-[70dvh] w-full object-contain bg-white" /> :
                d.extraction ? (
                  <div className="flex-1 bg-[#fbf8f2] p-6 font-mono text-[0.8rem] leading-relaxed text-[#211a10]">
                    <p className="mb-3 text-xs uppercase tracking-wider text-[#655744]">Prévia textual do fixture (sem arquivo real)</p>
                    {d.extraction.map((f) => <p key={f.id}>p.{f.page} — {f.excerpt}</p>)}
                  </div>
                ) : <EmptyState title={d.receivedAt ? "Arquivo não disponível neste dispositivo" : "Aguardando envio"} text={d.receivedAt ? "Documento de demonstração sem arquivo anexado." : "Quando o cliente enviar, a prévia aparece aqui."} />}
            </section>

            <div className="space-y-4">
              <section className="panel p-4" aria-labelledby="ext-t">
                <h2 id="ext-t" className="mb-1 font-semibold">Dados extraídos</h2>
                {!d.hasFixtureExtraction ? (
                  <p className="text-sm text-fg-muted">{d.receivedAt ? "Recebido localmente; análise automática depende da próxima fase. Nenhum dado foi extraído deste arquivo." : "Nada a extrair: documento ainda não recebido."}</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-fg-muted">Extração demonstrativa preparada para este documento de teste. Confiança é indicativa. Correções ficam registradas sem apagar o valor original.</p>
                    <ul className="space-y-2">{d.extraction?.map((f) => <FieldRow key={f.id} docId={d.id} f={f} />)}</ul>
                  </>
                )}
              </section>
              <section className="panel space-y-3 p-4 text-sm">
                <h2 className="font-semibold">Revisão</h2>
                <div className="flex flex-wrap gap-2">
                  {d.receivedAt && d.status !== "validado" && <button className="btn btn-primary" onClick={() => act.run((ctx) => docService.setStatus(d.id, "validado", ctx), "Documento validado.")}><CheckCircle2 aria-hidden className="size-4" /> Validar</button>}
                  {d.receivedAt && d.status !== "rejeitado" && <button className="btn btn-secondary" onClick={() => setRejecting(true)}>Rejeitar</button>}
                  {d.receivedAt && d.status === "recebido" && <button className="btn btn-ghost" onClick={() => act.run((ctx) => docService.setStatus(d.id, "precisa_revisar", ctx))}>Marcar “precisa revisar”</button>}
                  <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={d.sharedWithClient} onChange={(e) => act.run((ctx) => docService.share(d.id, e.target.checked, ctx))} /> Visível no portal do cliente</label>
                </div>
                {d.rejectReason && <p className="text-danger">Motivo da rejeição: {d.rejectReason}</p>}
                <button className="btn btn-ghost text-danger" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden className="size-4" /> Excluir</button>
              </section>
              <section className="panel p-4 text-sm">
                <h2 className="mb-2 font-semibold">Versões e histórico</h2>
                <ul className="space-y-1">{(d.versions ?? []).map((v, i) => <li key={v.id}>v{i + 1} · {formatInstant(v.at)} · {userName(v.actorId)} · {v.note}{v.mime ? ` · ${v.mime}` : ""}</li>)}</ul>
                <ol className="mt-3 space-y-1 border-l border-line pl-4 text-fg-muted">{(d.history ?? []).map((h, i) => <li key={i}>{formatInstant(h.at)} — {h.text}</li>)}</ol>
              </section>
            </div>
          </div>
        )}
      </div>

      <UploadDialog open={uploading} onClose={() => setUploading(false)} preset={{ docId: d.id, clientId: d.clientId, caseId: d.caseId, type: d.type }} />
      <Dialog open={rejecting} onClose={() => setRejecting(false)} title="Rejeitar documento">
        <label className="block"><span className="label">Motivo</span><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <div className="mt-4 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setRejecting(false)}>Cancelar</button><button className="btn btn-danger" onClick={async () => { if (await act.run((ctx) => docService.setStatus(d.id, "rejeitado", ctx, reason))) setRejecting(false); }}>Rejeitar</button></div>
      </Dialog>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Excluir documento?">
        <p>“{d.name}” e seus arquivos locais serão removidos desta demonstração. Documentos validados não podem ser excluídos.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn btn-ghost" autoFocus onClick={() => setConfirmDelete(false)}>Cancelar</button><button className="btn btn-danger" onClick={async () => { if (await act.run((ctx) => docService.remove(d.id, ctx))) router.push("/app/documentos"); else setConfirmDelete(false); }}>Excluir</button></div>
      </Dialog>
    </Guard>
  );
}

function FieldRow({ docId, f }: { docId: string; f: ExtractedField }) {
  const act = useAction("documents");
  const [v, setV] = useState(f.correction ?? "");
  return (
    <li className="rounded-[var(--radius-control)] border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{f.field}</span>
        <Badge tone={CONF[f.confidence]}>Confiança {f.confidence}</Badge>
        {f.reviewerId && <Badge tone="success">Revisado por {userName(f.reviewerId)}</Badge>}
      </div>
      <p className="num mt-1">Extraído: <strong>{f.value}</strong> <span className="text-fg-muted">· p.{f.page} · “{f.excerpt}”</span></p>
      <div className="mt-2 flex gap-2">
        <input className="field min-h-9 text-sm" aria-label={`Correção para ${f.field}`} placeholder="Correção (opcional)" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn btn-secondary min-h-9 shrink-0" onClick={() => act.run((ctx) => docService.reviewField(docId, f.id, v, ctx))}>{v.trim() ? "Salvar correção" : "Confirmar valor"}</button>
      </div>
      {act.error && <p className="mt-1 text-danger">{act.error}</p>}
    </li>
  );
}
