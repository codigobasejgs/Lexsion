"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Download, FileText, Printer, Sparkles } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { useDirtyGuard } from "@/components/pwa";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { DRAFT_STATUS } from "@/modules/drafts/labels";
import { draftService, missingFields } from "@/services/mock/ops-repo";
import { buildDocx, docxFileName, DOCX_MIME } from "@/domain/docx";
import { tenantTheme } from "@/lib/tenant-tokens";
import { updateRow } from "@/services/mock/generic";
import { downloadText } from "@/domain/csv";
import { canApprove } from "@/domain/permissions";
import { formatInstant } from "@/lib/dates";
import type { LegalDraft } from "@/domain/types";
import { checkCitations } from "@/domain/citations";
import { SourcesPanel } from "@/modules/drafts/sources-panel";

const SECTIONS = ["Fatos (informados)", "Documentos (extraídos)", "Pontos controvertidos", "Fundamentos", "Hipóteses (a confirmar)", "Pedidos", "Referências"];

export default function MinutaPage({ params }: PageProps<"/app/minutas/[id]">) {
  const { id } = use(params);
  const drafts = useCollection("drafts");
  const d = drafts.data?.find((x) => x.id === id);
  if (drafts.isPending) return <LoadingBlock />;
  if (!d) return <EmptyState title="Minuta não encontrada" text="" action={<Link href="/app/minutas" className="btn btn-secondary">Voltar</Link>} />;
  return <Editor key={d.id} d={d} />;
}

function Editor({ d }: { d: LegalDraft }) {
  const { user, org, tenant } = useSession();
  const act = useAction("drafts");
  const [body, setBody] = useState(d.body);
  // Sincroniza com o salvo (outra aba/restauração) sem remontar — remontar apagava o aviso de sucesso.
  const [base, setBase] = useState(d.body);
  if (d.body !== base) {
    if (body === base) setBody(d.body);
    setBase(d.body);
  }
  const [comment, setComment] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const dirty = body !== d.body;
  useDirtyGuard(`draft-${d.id}`, dirty);
  const missing = missingFields(body);
  const sources = useCollection("legalSources");
  const unverified = checkCitations(body, sources.data ?? []).blocking;

  const exportTxt = async () => {
    if (await act.run((ctx) => draftService.setStatus(d.id, "exportado", ctx))) downloadText(`${d.title}.txt`, `${body}\n\n— Documento gerado em ambiente demonstrativo —\n`, "text/plain;charset=utf-8");
  };
  const exportDocx = async () => {
    if (!(await act.run((ctx) => draftService.setStatus(d.id, "exportado", ctx), "DOCX gerado (rascunho demonstrativo)."))) return;
    // Marca do ESCRITÓRIO (não da LexSion) no cabeçalho; cor no tom legível sobre papel branco.
    const brandColor = tenant ? tenantTheme(tenant.settings).light.brand : undefined;
    const bytes = buildDocx({ title: d.title, body, header: tenant?.settings.brandName ?? org?.name, brandColor, footer: "Ambiente demonstrativo — rascunho sem valor de protocolo. Revisão profissional obrigatória." });
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: DOCX_MIME }));
    const a = Object.assign(document.createElement("a"), { href: url, download: docxFileName(d.title) });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const printPdf = async () => {
    if (!(await act.run((ctx) => draftService.setStatus(d.id, "exportado", ctx)))) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>body{font:12pt/1.6 Georgia,serif;margin:2.5cm;color:#000}pre{white-space:pre-wrap;font:inherit}footer{margin-top:2em;font:9pt sans-serif;color:#555}</style></head><body><pre>${esc(body)}</pre><footer>Ambiente demonstrativo — sem valor de protocolo.</footer><script>print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Guard area="minutas">
      <div className="mx-auto max-w-[1300px]">
        <PageHeader breadcrumb={[{ href: "/app/minutas", label: "Minutas" }]} title={d.title} description={`${d.kind} · atualizada ${formatInstant(d.updatedAt)}`} actions={<Badge tone={DRAFT_STATUS[d.status].tone}>{DRAFT_STATUS[d.status].label}</Badge>} />
        {d.status === "ajustes" && d.history.at(-1)?.text.includes("invalidada") && <p role="alert" className="mb-4 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning">O texto mudou depois da aprovação. A aprovação foi invalidada; revise e aprove novamente.</p>}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-3">
            <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Inserir seção">
              {SECTIONS.map((s) => <button key={s} className="btn btn-ghost min-h-8 border border-line text-xs" onClick={() => setBody((b) => `${b}\n\n${s.toUpperCase()}\n`)}>+ {s}</button>)}
            </div>
            <label className="block" data-tour="editor-minuta"><span className="sr-only">Texto da minuta</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={24} className="field min-h-[60dvh] py-3 font-serif text-[1.02rem] leading-relaxed" />
            </label>
            {missing.length > 0 && <p className="text-sm text-warning">Campos não preenchidos: {missing.join(", ")}</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={!dirty || act.pending} onClick={() => act.run((ctx) => draftService.save(d.id, body, ctx), "Minuta salva neste dispositivo.")}>Salvar</button>
              {dirty && <button className="btn btn-ghost" onClick={() => setBody(d.body)}>Descartar alterações</button>}
            </div>
            <Feedback error={act.error} notice={act.notice} />
          </section>
          <aside className="space-y-4">
            <section className="panel space-y-2 p-4 text-sm">
              <h2 className="font-semibold">Fluxo</h2>
              <div className="flex flex-wrap gap-2">
                {d.status === "rascunho" && <button className="btn btn-secondary min-h-9" onClick={() => act.run((ctx) => draftService.setStatus(d.id, "revisao", ctx))}>Enviar para revisão</button>}
                {(d.status === "revisao" || d.status === "ajustes") && <button className="btn btn-secondary min-h-9" onClick={() => act.run((ctx) => draftService.setStatus(d.id, "ajustes", ctx))}>Pedir ajustes</button>}
                {(d.status === "revisao" || d.status === "ajustes") && user && canApprove(user.role) && <button className="btn btn-primary min-h-9" disabled={dirty || missing.length > 0 || unverified.length > 0} onClick={() => act.run((ctx) => draftService.setStatus(d.id, "aprovado", ctx), "Aprovada.")}>Aprovar</button>}
              </div>
              {dirty && <p className="text-xs text-fg-muted">Salve antes de aprovar.</p>}
              {!dirty && missing.length > 0 && <p className="text-xs text-warning">Preencha os campos pendentes antes de aprovar.</p>}
              {!dirty && unverified.length > 0 && <p className="text-xs text-warning">Citação sem fonte verificada: {unverified.map((u) => u.citation).join(", ")}. Confira em “Fontes citadas”.</p>}
              <h3 className="pt-2 font-medium">Exportar</h3>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary min-h-9" data-tour="exportar-docx" disabled={dirty || (d.status !== "aprovado" && d.status !== "exportado")} onClick={exportDocx}><FileText aria-hidden className="size-4" /> Word (.docx)</button>
                <button className="btn btn-secondary min-h-9" disabled={dirty || (d.status !== "aprovado" && d.status !== "exportado")} onClick={exportTxt}><Download aria-hidden className="size-4" /> Texto (.txt)</button>
                <button className="btn btn-secondary min-h-9" disabled={dirty || (d.status !== "aprovado" && d.status !== "exportado")} onClick={printPdf}><Printer aria-hidden className="size-4" /> Imprimir / PDF</button>
              </div>
              <p className="text-xs text-fg-muted">Exportação só após aprovação. O arquivo sai marcado como rascunho demonstrativo; nada é protocolado.</p>
            </section>
            <SourcesPanel body={d.body} caseId={d.caseId} />
            <section className="panel space-y-2 p-4 text-sm">
              <div className="flex items-center gap-2"><h2 className="flex flex-1 items-center gap-1.5 font-semibold text-ai"><Sparkles aria-hidden className="size-4" /> Assistente</h2><SimulatedBadge /></div>
              <p className="text-fg-muted">Sugestões separam fatos, dados extraídos e hipóteses. Nunca inserem texto sozinhas.</p>
              {suggestion ? (
                <>
                  <p className="rounded border border-line bg-surface-muted p-2">{suggestion}</p>
                  <div className="flex gap-2"><button className="btn btn-secondary min-h-9" onClick={() => { setBody((b) => `${b}\n\n${suggestion}`); setSuggestion(null); }}>Inserir no fim</button><button className="btn btn-ghost min-h-9" onClick={() => setSuggestion(null)}>Descartar</button></div>
                </>
              ) : (
                <button className="btn btn-secondary min-h-9 w-full" onClick={() => setSuggestion("HIPÓTESES (A CONFIRMAR PELO ADVOGADO)\n— Verificar se os documentos comprovam o requisito alegado.\n— Confirmar datas com os documentos originais.\n(Resposta de demonstração; sem fontes jurídicas reais.)")}>Sugerir estrutura (demonstração)</button>
              )}
            </section>
            <section className="panel p-4 text-sm">
              <h2 className="mb-2 font-semibold">Comentários</h2>
              <ul className="space-y-2">{d.comments.map((c, i) => <li key={i} className="rounded border border-line p-2"><p className="text-xs text-fg-muted">{userName(c.actorId)} · {formatInstant(c.at)}</p><p>{c.text}</p></li>)}</ul>
              <div className="mt-2 flex gap-2"><input className="field min-h-9" aria-label="Novo comentário" value={comment} onChange={(e) => setComment(e.target.value)} /><button className="btn btn-secondary min-h-9" disabled={!comment.trim()} onClick={async () => { await act.run((ctx) => updateRow("drafts", d.id, ctx, (x: LegalDraft) => ({ ...x, comments: [...x.comments, { at: new Date().toISOString(), actorId: ctx.actorId, text: comment.trim() }] }))); setComment(""); }}>Comentar</button></div>
            </section>
            <section className="panel p-4 text-sm"><h2 className="mb-2 font-semibold">Histórico</h2><ol className="space-y-1 text-fg-muted">{[...d.history].reverse().map((h, i) => <li key={i}>{formatInstant(h.at)} · {userName(h.actorId)} — {h.text}</li>)}</ol></section>
          </aside>
        </div>
      </div>
    </Guard>
  );
}
