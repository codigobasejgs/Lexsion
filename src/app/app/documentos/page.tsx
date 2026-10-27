"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, Lock, Plus, Upload } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Chips, SearchBox, useUrlState } from "@/modules/shared";
import { DOC_STATUS } from "@/modules/cases/labels";
import { UploadDialog } from "@/modules/documents/upload";
import { formatInstant } from "@/lib/dates";

export default function DocumentosPage() {
  const url = useUrlState();
  const docs = useCollection("documents");
  const clients = useCollection("clients");
  const q = url.get("q") ?? "";
  const status = url.get("status") ?? "todos";
  const client = url.get("cliente") ?? "";
  const [uploading, setUploading] = useState(false);
  const rows = useMemo(() => (docs.data ?? []).filter((d) => (status === "todos" || d.status === status) && (!client || d.clientId === client) && d.name.toLowerCase().includes(q.toLowerCase())), [docs.data, status, client, q]);
  // Pastas por cliente
  const byClient = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const d of rows) m.set(d.clientId, [...(m.get(d.clientId) ?? []), d]);
    return [...m.entries()];
  }, [rows]);
  const count = (s: string) => (docs.data ?? []).filter((d) => d.status === s).length;

  return (
    <Guard area="documentos">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Documentos" description="Original preservado; versões e revisões registradas. Extração automática só nos documentos de teste preparados."
          actions={<><Link href="/app/documentos/solicitacoes" className="btn btn-secondary"><Plus aria-hidden className="size-4" /> Solicitações</Link><button className="btn btn-primary" onClick={() => setUploading(true)} data-tour="enviar-documento"><Upload aria-hidden className="size-4" /> Enviar documento</button></>} />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchBox label="Buscar documento" placeholder="Nome do arquivo" value={q} onChange={(v) => url.set("q", v || null)} />
          <select className="field min-h-10 w-auto text-sm" aria-label="Cliente" value={client} onChange={(e) => url.set("cliente", e.target.value || null)}><option value="">Todos os clientes</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
        <Chips label="Situação" value={status} onChange={(k) => url.set("status", k === "todos" ? null : k)} options={[{ key: "todos", label: "Todos" }, ...Object.entries(DOC_STATUS).map(([k, v]) => ({ key: k, label: v.label, count: count(k) }))]} />
        <div className="mt-4">
          {docs.isPending ? <LoadingBlock /> : rows.length === 0 ? <EmptyState title="Nenhum documento" text="Ajuste os filtros ou envie um documento." action={<button className="btn btn-secondary" onClick={() => setUploading(true)}>Enviar documento</button>} /> : (
            <div className="space-y-5">
              {byClient.map(([cid, list]) => (
                <section key={cid} aria-labelledby={`f-${cid}`}>
                  <h2 id={`f-${cid}`} className="mb-2 text-sm font-semibold text-accent">Pasta: {clients.data?.find((c) => c.id === cid)?.name}</h2>
                  <ul className="panel divide-y divide-line">
                    {list.map((d) => (
                      <li key={d.id}>
                        <Link href={`/app/documentos/${d.id}`} className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-surface-muted/50">
                          <FileText aria-hidden className="size-5 text-fg-muted" />
                          <span className="min-w-0 flex-1"><span className="block font-medium [overflow-wrap:anywhere]">{d.name}</span><span className="text-xs text-fg-muted">{d.type}{d.receivedAt ? ` · recebido ${formatInstant(d.receivedAt)}` : " · aguardando envio"}{d.hasFixtureExtraction ? " · extração de teste" : ""}</span></span>
                          {(d.type === "Laudo" || d.type === "Exame") && <Lock aria-label="Dado de saúde — acesso restrito" className="size-4 text-warning" />}
                          <Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
      <UploadDialog open={uploading} onClose={() => setUploading(false)} preset={client ? { clientId: client } : undefined} />
    </Guard>
  );
}
