"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { AlertTriangle, Check, FileDown, FileSearch, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { UploadDialog } from "@/modules/documents/upload";
import { PlanningPanel } from "@/modules/pension/planning-panel";
import { nowIso, updateRow } from "@/services/mock/generic";
import { allowed } from "@/domain/permissions";
import { derive, effectiveEnd, mergeCnis, mergeCtps, mergePpp, type Bond, type IntelData, type ReviewStatus, type SourceDoc } from "@/domain/pension/analysis";
import { CNIS_INDICATORS } from "@/domain/pension/cnis-parser";
import { CLASSIFICATION_LABEL, RULES_VERSION, type AccidentInput, type BondKindAtAccident, type SpecialKind } from "@/domain/pension/rules";
import { civilFromInstant, formatCivil, parseCivilBR } from "@/lib/dates";
import type { Assessment, DocType } from "@/domain/types";

const fmt = (d: string | null | undefined) => (d ? formatCivil(d) : "—");
const STATUS: Record<ReviewStatus, { label: string; tone: "warning" | "success" | "info" | "neutral" }> = {
  pendente: { label: "Aguardando revisão", tone: "warning" }, confirmado: { label: "Confirmado", tone: "success" }, corrigido: { label: "Corrigido", tone: "info" }, descartado: { label: "Descartado", tone: "neutral" },
};
const REQ = { atendido: { label: "Atendido", tone: "success" }, pendente: { label: "Pendente", tone: "warning" }, nao_verificavel: { label: "Não verificável", tone: "neutral" } } as const;
const SECTIONS = [["documentos", "Documentos"], ["vinculos", "Vínculos"], ["linha", "Linha do tempo"], ["pendencias", "Pendências"], ["especial", "Atividade especial"], ["acidente", "Auxílio-acidente"], ["beneficios", "Possibilidades"], ["planejamento", "Planejamento e RMI"], ["relatorio", "Relatório"]] as const;
type Sec = (typeof SECTIONS)[number][0];

export default function IntelPage({ params }: PageProps<"/app/inteligencia/[id]">) {
  const { id } = use(params);
  const rows = useCollection("assessments");
  const a = rows.data?.find((x) => x.id === id && x.kind === "intel");
  if (rows.isPending) return <LoadingBlock />;
  if (!a) return <EmptyState title="Análise não encontrada" text="Pode pertencer a outro escritório." action={<Link href="/app/inteligencia" className="btn btn-secondary">Voltar</Link>} />;
  // Chave só pelo id: salvar não remonta a tela (o aviso de sucesso e a seção aberta continuam).
  return <Guard area="previdenciario"><View key={a.id} a={a} /></Guard>;
}

function View({ a }: { a: Assessment }) {
  const { user, org, mode } = useSession();
  const clients = useCollection("clients");
  const docs = useCollection("documents");
  const act = useAction("assessments", "documents");
  const [sec, setSec] = useState<Sec>("documentos");
  const d = a.data as unknown as IntelData;
  const r = useMemo(() => derive(d), [d]);
  const client = clients.data?.find((c) => c.id === a.clientId);
  const canReview = allowed(user?.role, "aprovar_peca");
  const reviewed = a.status === "revisado" && a.reviewedVersion === a.inputsVersion;
  const save = (next: IntelData, text: string, notice?: string) => act.run((ctx) => updateRow("assessments", a.id, ctx, (x: Assessment) => ({ ...x, data: next as unknown as Record<string, unknown>, inputsVersion: x.inputsVersion + 1, status: "rascunho", history: [...x.history, { at: nowIso(), actorId: ctx.actorId, text }] }), text), notice);

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader breadcrumb={[{ href: "/app/inteligencia", label: "Inteligência Jurídica" }]} title={a.title}
        description={<>{client ? <Link className="text-accent underline underline-offset-2" href={`/app/clientes/${client.id}`}>{client.name}</Link> : "Cliente"} · versão {a.inputsVersion} · regras {RULES_VERSION}</>}
        actions={reviewed ? <Badge tone="success">Revisada por {userName(a.reviewerId)}</Badge> : <Badge tone="warning">Aguardando revisão</Badge>} />
      <p role="note" className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-dashed border-accent/60 p-3 text-sm text-accent"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> Apoio técnico. Só vínculos revisados entram na contagem. Regras com fonte e vigência, aguardando validação jurídica. Não substitui a análise do advogado(a).</p>
      <Summary r={r} />
      <label className="mb-3 block sm:hidden"><span className="label">Seção</span><select className="field" value={sec} onChange={(e) => setSec(e.target.value as Sec)}>{SECTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <div role="tablist" aria-label="Seções da análise" data-tour="intel-secoes" className="mb-4 hidden gap-1 overflow-x-auto border-b border-line sm:flex">
        {SECTIONS.map(([k, l]) => <button key={k} role="tab" aria-selected={sec === k} onClick={() => setSec(k)} className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm ${sec === k ? "border-brand font-medium" : "border-transparent text-fg-muted hover:text-fg"}`}>{l}{k === "pendencias" && r.pendencias.length ? ` (${r.pendencias.length})` : ""}</button>)}
      </div>
      <div role="tabpanel" className="space-y-4">
        {sec === "documentos" && <Documents a={a} d={d} docs={(docs.data ?? []).filter((x) => x.clientId === a.clientId)} real={mode === "real"} orgId={org?.id ?? ""} onRead={save} />}
        {sec === "vinculos" && <Bonds d={d} r={r} onSave={save} actorId={user?.id ?? ""} />}
        {sec === "linha" && <Timeline r={r} />}
        {sec === "pendencias" && <Pending r={r} d={d} />}
        {sec === "especial" && <Special d={d} r={r} onSave={save} />}
        {sec === "acidente" && <Accident d={d} r={r} onSave={save} />}
        {sec === "beneficios" && <Benefits d={d} r={r} onSave={save} />}
        {sec === "planejamento" && <PlanningPanel d={d} onSave={save} />}
        {sec === "relatorio" && <Report a={a} d={d} r={r} office={org?.name ?? "Escritório"} client={client?.name ?? "Cliente"} who={user?.name ?? ""} canReview={canReview} reviewed={reviewed} act={act} />}
      </div>
      <div className="mt-4"><Feedback error={act.error} notice={act.notice} /></div>
      {a.history.length > 0 && <details className="panel mt-4 p-4 text-sm"><summary className="cursor-pointer font-medium">Histórico ({a.history.length})</summary><ol className="mt-2 space-y-1 text-fg-muted">{a.history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString("pt-BR")} · {userName(h.actorId)} · {h.text}</li>)}</ol></details>}
    </div>
  );
}

function Summary({ r }: { r: ReturnType<typeof derive> }) {
  const items: [string, string][] = [["Tempo comum", r.commonText], ["Com conversão", r.conversion ? r.totalWithConversion : "—"], ["Carência", r.carencyMonths == null ? "—" : `${r.carencyMonths} mês(es)`], ["Pendências", String(r.pendencias.length)]];
  return <dl className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{items.map(([k, v]) => <div key={k} className="panel p-3"><dt className="text-xs text-fg-muted">{k}</dt><dd className="num font-semibold">{v}</dd></div>)}</dl>;
}

type Act = ReturnType<typeof useAction>;
type SaveFn = (next: IntelData, text: string, notice?: string) => Promise<unknown>;

function Documents({ a, d, docs, real, orgId, onRead }: { a: Assessment; d: IntelData; docs: { id: string; name: string; type: DocType; versions?: { fileId?: string; mime?: string }[] }[]; real: boolean; orgId: string; onRead: SaveFn }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ doc: string; text: string; ocrPages?: number } | null>(null);
  const [upload, setUpload] = useState<DocType | null>(null);
  const relevant = docs.filter((x) => ["CNIS", "CTPS", "PPP"].includes(x.type));
  const read = async (doc: (typeof relevant)[number], ocr = false) => {
    setBusy(doc.id); setMsg(null);
    try {
      const res = await fetch("/api/inteligencia/extrair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: orgId, documentId: doc.id, kind: doc.type, ocr }) });
      const j = await res.json().catch(() => null);
      if (!j?.ok) { setMsg({ doc: doc.id, text: j?.error?.message ?? "Não foi possível ler agora. Tente de novo.", ocrPages: j?.error?.code === "needs_ocr" ? j.error.pages : undefined }); return; }
      const src: SourceDoc = { kind: doc.type as SourceDoc["kind"], documentId: doc.id, fileId: j.data.fileId, fileName: j.data.fileName || doc.name, pages: j.data.pages, readAt: j.data.readAt, rulesVersion: j.data.rulesVersion, ...(j.data.ocr ? { ocrPages: j.data.ocr.pages, ocrModel: j.data.ocr.model } : {}) };
      const next = doc.type === "CNIS" ? mergeCnis(d, j.data.reading, src) : doc.type === "CTPS" ? mergeCtps(d, j.data.reading, src) : mergePpp(d, j.data.reading, src);
      const n = doc.type === "CNIS" ? j.data.reading.bonds.length : doc.type === "CTPS" ? j.data.reading.contracts.length : j.data.reading.periods.length;
      const unread = j.data.reading.unread.length;
      await onRead(next, `Leitura de ${doc.type}: ${doc.name}`, `${doc.type} lido: ${n} registro(s)${unread ? `, ${unread} trecho(s) não lido(s) com segurança` : ""}. Revise em Vínculos${doc.type === "PPP" ? " e Atividade especial" : ""}.${j.data.ocr ? ` ${j.data.ocr.pages.length} página(s) lida(s) por IA${j.data.ocr.cached ? " (reaproveitada, sem custo)" : ""}: confira com atenção.` : ""}`);
    } finally { setBusy(null); }
  };
  return (
    <section className="panel p-4 text-sm">
      <h2 className="mb-1 font-semibold">Documentos do cliente</h2>
      <p className="mb-3 text-fg-muted">Leitura de PDF com texto (o extrato baixado do Meu INSS, a CTPS Digital e o PPP digital), feita no servidor da LexSion, sem IA e sem envio a terceiros. Páginas escaneadas e fotos só são lidas por IA (Google Gemini, conta paga, sem uso para treino) quando você confirmar, dentro dos limites do escritório.</p>
      {!real && <p className="mb-3 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-2 text-info">Na demonstração os arquivos ficam só no navegador: a leitura automática funciona na operação real.</p>}
      {!relevant.length ? <p className="text-fg-muted">Nenhum CNIS, CTPS ou PPP enviado para este cliente.</p> : (
        <ul className="divide-y divide-line">{relevant.map((doc) => {
          const src = d.sources.find((s) => s.documentId === doc.id);
          const hasFile = (doc.versions ?? []).some((v) => v.fileId);
          return (
            <li key={doc.id} className="flex flex-wrap items-center gap-2 py-2">
              <Badge icon={false}>{doc.type}</Badge>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{doc.name}{src && <span className="block text-xs text-fg-muted">Lido em {new Date(src.readAt).toLocaleString("pt-BR")} · {src.pages} pág.{src.ocrPages?.length ? ` · ${src.ocrPages.length} por IA` : ""}</span>}</span>
              <button className="btn btn-secondary min-h-9" disabled={!real || !hasFile || busy !== null} onClick={() => read(doc)}><FileSearch aria-hidden className="size-4" /> {busy === doc.id ? "Lendo…" : src ? "Ler de novo" : "Ler documento"}</button>
              {msg?.doc === doc.id && <div role="alert" className="w-full space-y-2 text-warning"><p>{msg.text}</p>{msg.ocrPages ? <div className="rounded-[var(--radius-control)] border border-line p-3 text-fg"><p>Ler {msg.ocrPages} página(s) com IA? O arquivo é enviado ao Google Gemini (conta paga: o conteúdo não é usado para treinar modelos), conta no limite de páginas do escritório e o resultado precisa de revisão.</p><button className="btn btn-primary mt-2 min-h-9" disabled={busy !== null} onClick={() => read(doc, true)}>Ler com IA</button></div> : null}</div>}
            </li>
          );
        })}</ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">{(["CNIS", "CTPS", "PPP"] as DocType[]).map((t) => <button key={t} className="btn btn-ghost min-h-9" onClick={() => setUpload(t)}><Upload aria-hidden className="size-4" /> Enviar {t}</button>)}</div>
      {upload && <UploadDialog open onClose={() => setUpload(null)} preset={{ clientId: a.clientId, caseId: a.caseId || undefined, type: upload }} />}
    </section>
  );
}

function Bonds({ d, r, onSave, actorId }: { d: IntelData; r: ReturnType<typeof derive>; onSave: SaveFn; actorId: string }) {
  const [edit, setEdit] = useState<string | null>(null);
  const [form, setForm] = useState({ origin: "", start: "", end: "" });
  const [err, setErr] = useState<string | null>(null);
  const setBond = (id: string, patch: Partial<Bond>, text: string) => onSave({ ...d, bonds: d.bonds.map((b) => (b.id === id ? { ...b, ...patch, reviewerId: actorId, reviewedAt: nowIso() } : b)) }, text);
  const confirmAll = () => onSave({ ...d, bonds: d.bonds.map((b) => (b.status === "pendente" && b.confidence === "alta" ? { ...b, status: "confirmado", reviewerId: actorId, reviewedAt: nowIso() } : b)) }, "Vínculos de alta confiança confirmados em lote");
  const submit = (b: Bond | null) => {
    const start = parseCivilBR(form.start), end = form.end.trim() ? parseCivilBR(form.end) : null;
    if (!form.origin.trim() || !start || (form.end.trim() && !end)) return setErr("Informe origem e datas válidas (dd/mm/aaaa).");
    if (end && end < start) return setErr("Fim antes do início.");
    setErr(null); setEdit(null);
    if (b) return setBond(b.id, { origin: form.origin.trim(), start, end, status: "corrigido", original: b.original ?? { start: b.start, end: b.end } }, `Vínculo corrigido: ${form.origin.trim()}`);
    const nb: Bond = { id: `manual-${crypto.randomUUID().slice(0, 8)}`, source: "manual", origin: form.origin.trim(), originId: null, kind: "outro", start, end, indicators: [], evidence: null, confidence: "baixa", status: "confirmado", reviewerId: actorId, reviewedAt: nowIso() };
    return onSave({ ...d, bonds: [...d.bonds, nb] }, `Vínculo manual incluído: ${nb.origin}`);
  };
  const open = (b: Bond | null) => { setEdit(b?.id ?? "novo"); setForm({ origin: b?.origin ?? "", start: b?.start ? formatCivil(b.start) : "", end: b?.end ? formatCivil(b.end) : "" }); setErr(null); };
  const editor = (b: Bond | null) => (
    <div className="mt-2 grid gap-2 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-4">
      <label className="block sm:col-span-2"><span className="label">Origem/empregador</span><input className="field" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} /></label>
      <label className="block"><span className="label">Início</span><input className="field num" placeholder="dd/mm/aaaa" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
      <label className="block"><span className="label">Fim (vazio se em aberto)</span><input className="field num" placeholder="dd/mm/aaaa" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
      {err && <p role="alert" className="text-danger sm:col-span-4">{err}</p>}
      <div className="flex gap-2 sm:col-span-4"><button className="btn btn-primary min-h-9" onClick={() => submit(b)}>{b ? "Salvar correção" : "Incluir vínculo"}</button><button className="btn btn-ghost min-h-9" onClick={() => setEdit(null)}>Cancelar</button></div>
    </div>
  );
  const pend = d.bonds.filter((b) => b.status === "pendente");
  return (
    <section className="panel p-4 text-sm" data-tour="intel-vinculos">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 font-semibold">Vínculos e contribuições</h2>
        {pend.some((b) => b.confidence === "alta") && <button className="btn btn-secondary min-h-9" onClick={confirmAll}><Check aria-hidden className="size-4" /> Confirmar os de alta confiança</button>}
        <button className="btn btn-ghost min-h-9" onClick={() => open(null)}><Plus aria-hidden className="size-4" /> Incluir vínculo manual</button>
      </div>
      {edit === "novo" && editor(null)}
      {!d.bonds.length ? <p className="text-fg-muted">Nenhum vínculo. Leia o CNIS em Documentos ou inclua manualmente.</p> : (
        <ul className="space-y-2">{d.bonds.map((b) => {
          const contribs = d.contributions.filter((c) => c.bondId === b.id);
          return (
            <li key={b.id} className="rounded-[var(--radius-control)] border border-line p-3" data-testid={`vinculo-${b.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{b.origin}{b.originId && <span className="num ml-1 text-xs text-fg-muted">{b.originId}</span>}</span>
                <Badge tone={STATUS[b.status].tone}>{STATUS[b.status].label}</Badge>
                <Badge icon={false}>{b.source}</Badge>
              </div>
              <p className="num mt-1">{fmt(b.start)} a {b.end ? fmt(b.end) : b.lastRemuneration ? `sem data de fim (últ. remuneração ${b.lastRemuneration})` : "sem data de fim"}{b.original && <span className="ml-2 text-xs text-fg-muted">lido: {fmt(b.original.start)} a {fmt(b.original.end)}</span>}</p>
              {b.indicators.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{b.indicators.map((i) => <Badge key={i} tone="warning" icon={false}>{i}{CNIS_INDICATORS[i] ? `: ${CNIS_INDICATORS[i]}` : ""}</Badge>)}</div>}
              {b.evidence ? <p className="mt-1 text-xs text-fg-muted">Fonte: {b.evidence.fileName ?? "documento"}, pág. {b.evidence.page}{d.sources.some((x) => x.documentId === b.evidence!.documentId && x.ocrPages?.includes(b.evidence!.page)) ? " (lida por IA — conferir no documento)" : ""} · confiança {b.confidence} · “{b.evidence.excerpt}”</p> : <p className="mt-1 text-xs text-fg-muted">Incluído manualmente{b.reviewerId ? ` por ${userName(b.reviewerId)}` : ""}.</p>}
              {contribs.length > 0 && <details className="mt-1 text-xs"><summary className="cursor-pointer text-fg-muted">{contribs.length} competência(s) lidas</summary><ul className="num mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-4">{contribs.map((c) => <li key={c.month + c.evidence.page}>{c.month.slice(5)}/{c.month.slice(0, 4)}: {c.amount == null ? "—" : c.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}{c.indicators.length ? ` ${c.indicators.join(" ")}` : ""}</li>)}</ul></details>}
              <div className="mt-2 flex flex-wrap gap-2">
                {b.status !== "confirmado" && b.status !== "corrigido" && <button className="btn btn-secondary min-h-9" onClick={() => setBond(b.id, { status: "confirmado" }, `Vínculo confirmado: ${b.origin}`)}><Check aria-hidden className="size-4" /> Confirmar</button>}
                <button className="btn btn-ghost min-h-9" onClick={() => open(b)}><Pencil aria-hidden className="size-4" /> Corrigir</button>
                {b.status !== "descartado" ? <button className="btn btn-ghost min-h-9" onClick={() => setBond(b.id, { status: "descartado" }, `Vínculo descartado: ${b.origin}`)}><X aria-hidden className="size-4" /> Descartar</button>
                  : <button className="btn btn-ghost min-h-9" onClick={() => setBond(b.id, { status: "pendente" }, `Vínculo reaberto: ${b.origin}`)}>Reabrir</button>}
                {b.source === "manual" && <button className="btn btn-ghost min-h-9" aria-label={`Remover ${b.origin}`} onClick={() => onSave({ ...d, bonds: d.bonds.filter((x) => x.id !== b.id) }, `Vínculo manual removido: ${b.origin}`)}><Trash2 aria-hidden className="size-4" /></button>}
              </div>
              {edit === b.id && editor(b)}
            </li>
          );
        })}</ul>
      )}
      {r.comparison.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 font-semibold">Comparação CNIS × CTPS</h3>
          <ul className="space-y-1">{r.comparison.map((c, i) => <li key={i} className="flex flex-wrap items-start gap-2"><Badge tone={c.kind === "confere" ? "success" : "warning"}>{{ confere: "Confere", datas_divergentes: "Datas divergentes", so_cnis: "Só no CNIS", so_ctps: "Só na CTPS" }[c.kind]}</Badge><span className="min-w-0 flex-1">{c.detail}{c.ctps?.evidence && <span className="text-xs text-fg-muted"> (CTPS pág. {c.ctps.evidence.page})</span>}</span></li>)}</ul>
        </div>
      )}
    </section>
  );
}

function Timeline({ r }: { r: ReturnType<typeof derive> }) {
  if (!r.counted.length) return <EmptyState title="Linha do tempo vazia" text="Confirme ou inclua vínculos para montar a linha do tempo." />;
  const t = (s: string) => Date.parse(`${s}T00:00:00Z`);
  const min = Math.min(...r.counted.map((x) => t(x.b.start!))), max = Math.max(...r.counted.map((x) => t(x.end)));
  const span = Math.max(1, max - min);
  const sorted = [...r.counted].sort((x, y) => x.b.start!.localeCompare(y.b.start!));
  return (
    <section className="panel p-4 text-sm">
      <h2 className="mb-1 font-semibold">Linha do tempo</h2>
      <p className="mb-3 text-fg-muted">{fmt(new Date(min).toISOString().slice(0, 10))} a {fmt(new Date(max).toISOString().slice(0, 10))}. Faixas sobrepostas contam uma vez; vínculos especiais em destaque.</p>
      <ul className="space-y-2">{sorted.map(({ b, end }) => (
        <li key={b.id}>
          <p className="flex flex-wrap justify-between gap-2"><span className="font-medium">{b.origin}</span><span className="num text-fg-muted">{fmt(b.start)} a {fmt(end)}{!b.end ? " *" : ""}</span></p>
          <div className="relative mt-1 h-3 rounded-full bg-surface-2" aria-hidden><div className={`absolute h-3 rounded-full ${b.special ? "bg-warning" : "bg-brand"}`} style={{ left: `${((t(b.start!) - min) / span) * 100}%`, width: `${Math.max(0.8, ((t(end) - t(b.start!)) / span) * 100)}%` }} /></div>
        </li>
      ))}</ul>
      {r.issues.filter((i) => i.kind === "lacuna" || i.kind === "concomitancia").length > 0 && <ul className="mt-3 list-disc pl-5 text-fg-muted">{r.issues.filter((i) => i.kind === "lacuna" || i.kind === "concomitancia").map((i, k) => <li key={k}>{i.text}</li>)}</ul>}
      {sorted.some((x) => !x.b.end) && <p className="mt-2 text-xs text-fg-muted">* sem data de fim: contado até o último dia do mês da última remuneração.</p>}
    </section>
  );
}

function Pending({ r, d }: { r: ReturnType<typeof derive>; d: IntelData }) {
  return (
    <section className="panel p-4 text-sm">
      <h2 className="mb-2 font-semibold">Pendências e próximos passos</h2>
      {!r.pendencias.length ? <p className="text-fg-muted">Nenhuma pendência apontada pelas regras desta versão.</p> : <ol className="list-decimal space-y-2 pl-5">{r.pendencias.map((p, i) => <li key={i}><span>{p.text}</span><span className="block text-fg-muted">→ {p.action}</span></li>)}</ol>}
      {d.unread.length > 0 && <p className="mt-3 text-xs text-fg-muted">{d.unread.length} trecho(s) não foram reconhecidos com segurança e não viraram dado: confira no documento.</p>}
    </section>
  );
}

function Special({ d, r, onSave }: { d: IntelData; r: ReturnType<typeof derive>; onSave: SaveFn }) {
  const setKind = (id: string, k: SpecialKind | null) => onSave({ ...d, bonds: d.bonds.map((b) => (b.id === id ? { ...b, special: k } : b)) }, k ? `Período marcado como especial (${k} anos)` : "Marcação de especial removida");
  const setPpp = (id: string, patch: Partial<IntelData["ppp"][number]>) => onSave({ ...d, ppp: d.ppp.map((p) => (p.id === id ? { ...p, ...patch } : p)) }, "PPP: dado complementado na revisão");
  return (
    <>
      <section className="panel p-4 text-sm">
        <h2 className="mb-1 font-semibold">Tempo especial e conversão</h2>
        <p className="mb-3 text-fg-muted">Conversão em tempo comum só para o período trabalhado até 13/11/2019 (EC 103/2019, art. 25, §2º). O fator depende da atividade (15, 20 ou 25 anos) e do sexo; não há fator único. {!d.sex && <strong className="text-warning">Informe o sexo em Possibilidades para calcular.</strong>}</p>
        {!r.counted.length ? <p className="text-fg-muted">Confirme vínculos primeiro.</p> : <ul className="divide-y divide-line">{r.counted.map(({ b, end }) => (
          <li key={b.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1">{b.origin} <span className="num text-fg-muted">{fmt(b.start)} a {fmt(end)}</span></span>
            <label className="flex items-center gap-2"><span className="sr-only">Atividade especial de {b.origin}</span><select className="field min-h-9 w-auto" value={b.special ?? ""} onChange={(e) => setKind(b.id, e.target.value ? (Number(e.target.value) as SpecialKind) : null)}><option value="">Comum</option><option value="25">Especial 25 anos</option><option value="20">Especial 20 anos</option><option value="15">Especial 15 anos</option></select></label>
          </li>
        ))}</ul>}
        {r.conversion && <div className="mt-3 rounded-[var(--radius-control)] border border-line p-3"><p className="font-medium">Memória de cálculo (+{r.conversion.addedDays} dia(s))</p><ul className="mt-1 list-disc space-y-1 pl-5 text-fg-muted">{r.conversion.lines.map((l) => <li key={l.id}>{l.memo}</li>)}</ul><p className="mt-1 text-xs">Fontes: {r.conversion.sources.map((s) => <a key={s.url} className="mr-2 text-accent underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>)}</p></div>}
      </section>
      <section className="panel p-4 text-sm">
        <h2 className="mb-1 font-semibold">Checklist técnico do PPP</h2>
        <p className="mb-3 text-fg-muted">Cada período lido do PPP é conferido pela regra da época (documentação exigida, limite de ruído, categoria profissional até 28/04/1995, agentes químicos e cancerígenos, EPI, responsável técnico).</p>
        {!r.ppp.length ? <p className="text-fg-muted">Nenhum PPP lido. Envie e leia o PPP em Documentos.</p> : <ul className="space-y-3">{r.ppp.map(({ p, a }) => (
          <li key={p.id} className="rounded-[var(--radius-control)] border border-line p-3" data-testid={`ppp-${p.id}`}>
            <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 font-medium">{p.employer || "Empresa"} <span className="num text-fg-muted">{fmt(p.start)} a {fmt(p.end)}</span></span><Badge tone={a.overall === "consistente" || a.overall === "possivel_enquadramento" ? "info" : "warning"}>{CLASSIFICATION_LABEL[a.overall]}</Badge></div>
            <p className="mt-1 text-xs text-fg-muted">{p.role || "função não lida"} · {p.agents.map((x) => `${x.name || x.kind}${x.intensity != null ? ` ${x.intensity} ${x.unit}` : ""}`).join("; ")}{p.evidence ? ` · pág. ${p.evidence.page}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={p.signed} onChange={(e) => setPpp(p.id, { signed: e.target.checked })} /> PPP assinado pelo representante</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={p.technicalResponsible} onChange={(e) => setPpp(p.id, { technicalResponsible: e.target.checked })} /> Responsável técnico no período</label>
            </div>
            <ul className="mt-2 space-y-1">{a.findings.map((f, i) => <li key={i} className="flex flex-wrap items-start gap-2"><Badge tone={f.classification === "consistente" ? "success" : f.classification === "possivel_enquadramento" ? "info" : "warning"} icon={false}>{CLASSIFICATION_LABEL[f.classification]}</Badge><span className="min-w-0 flex-1">{f.text}{f.source && <a className="ml-1 text-xs text-accent underline" href={f.source.url} target="_blank" rel="noreferrer">fonte</a>}</span></li>)}</ul>
          </li>
        ))}</ul>}
      </section>
    </>
  );
}

const KINDS: [BondKindAtAccident, string][] = [["empregado", "Empregado"], ["domestico", "Empregado doméstico"], ["avulso", "Trabalhador avulso"], ["segurado_especial", "Segurado especial"], ["contribuinte_individual", "Contribuinte individual"], ["facultativo", "Facultativo"], ["sem_vinculo", "Sem vínculo"], ["desconhecido", "Não sei"]];
function Accident({ d, r, onSave }: { d: IntelData; r: ReturnType<typeof derive>; onSave: SaveFn }) {
  const blank: AccidentInput = { accidentDate: null, kindAtAccident: "desconhecido", insuredAtAccident: null, sequelaDescribed: false, sequelaPermanent: "nao_sabe", reducedCapacityHabitual: "nao_sabe", habitualActivity: "", medicalDocs: 0, previousBenefit: false };
  const [f, setF] = useState<AccidentInput>(d.accident ?? blank);
  const [date, setDate] = useState(f.accidentDate ? formatCivil(f.accidentDate) : "");
  const dirty = JSON.stringify({ ...f, accidentDate: parseCivilBR(date) }) !== JSON.stringify(d.accident ?? blank);
  const tri = (k: "sequelaPermanent" | "reducedCapacityHabitual", label: string) => <label className="block"><span className="label">{label}</span><select className="field" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="sim">Sim</option><option value="nao">Não</option><option value="nao_sabe">Não sei / sem prova</option></select></label>;
  // Qualidade de segurado na data: sugerida pelos vínculos revisados, editável.
  const accDate = parseCivilBR(date);
  const suggested = accDate ? r.counted.some(({ b, end }) => b.start! <= accDate && end >= accDate) || (r.grace ? r.grace.until >= accDate && r.counted.some(({ b }) => b.start! <= accDate) : false) : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel space-y-3 p-4 text-sm">
        <h2 className="font-semibold">Roteiro do auxílio-acidente</h2>
        <p className="text-fg-muted">Separado dos benefícios por incapacidade: aqui importa sequela consolidada que reduz a capacidade para o trabalho habitual. Não exige carência.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="label">Data do acidente</span><input className="field num" placeholder="dd/mm/aaaa" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="block"><span className="label">Categoria na data</span><select className="field" value={f.kindAtAccident} onChange={(e) => setF({ ...f, kindAtAccident: e.target.value as BondKindAtAccident })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="block"><span className="label">Qualidade de segurado na data</span><select className="field" value={f.insuredAtAccident == null ? "" : f.insuredAtAccident ? "s" : "n"} onChange={(e) => setF({ ...f, insuredAtAccident: e.target.value === "" ? null : e.target.value === "s" })}><option value="">A verificar</option><option value="s">Sim</option><option value="n">Não</option></select>{suggested != null && <span className="mt-1 block text-xs text-fg-muted">Pelos vínculos revisados: {suggested ? "provável que sim" : "não comprovada"}.</span>}</label>
          <label className="block"><span className="label">Atividade habitual na época</span><input className="field" value={f.habitualActivity} onChange={(e) => setF({ ...f, habitualActivity: e.target.value })} /></label>
          {tri("sequelaPermanent", "Sequela consolidada (permanente)?")}
          {tri("reducedCapacityHabitual", "Reduz a capacidade para o trabalho habitual?")}
          <label className="block"><span className="label">Documentos médicos anexados</span><input className="field num" type="number" min={0} max={99} value={f.medicalDocs} onChange={(e) => setF({ ...f, medicalDocs: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} /></label>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.sequelaDescribed} onChange={(e) => setF({ ...f, sequelaDescribed: e.target.checked })} /> Sequela descrita em laudo</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.previousBenefit} onChange={(e) => setF({ ...f, previousBenefit: e.target.checked })} /> Recebeu auxílio por incapacidade temporária antes</label>
        <button className="btn btn-primary" disabled={!dirty || (!!date && !accDate)} onClick={() => onSave({ ...d, accident: { ...f, accidentDate: accDate } }, "Roteiro de auxílio-acidente atualizado")}>Salvar roteiro</button>
        {date && !accDate && <p role="alert" className="text-danger">Data inválida (dd/mm/aaaa).</p>}
      </section>
      <section className="panel space-y-3 p-4 text-sm" aria-live="polite">
        <h2 className="font-semibold">O que sustenta, enfraquece e falta</h2>
        {!r.accident ? <p className="text-fg-muted">Salve o roteiro para ver a análise.</p> : (
          <>
            {[["Sustenta", r.accident.sustain, "success"], ["Enfraquece", r.accident.weaken, "danger"], ["Falta", r.accident.missing, "warning"]].map(([t, list, tone]) => (list as string[]).length > 0 && <div key={t as string}><Badge tone={tone as "success"}>{t as string}</Badge><ul className="mt-1 list-disc pl-5">{(list as string[]).map((x) => <li key={x}>{x}</li>)}</ul></div>)}
            <p className="text-xs text-fg-muted">{r.accident.noCarencia} Fontes: {r.accident.sources.map((s) => <a key={s.url} className="mr-2 text-accent underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>)}</p>
          </>
        )}
      </section>
    </div>
  );
}

function Benefits({ d, r, onSave }: { d: IntelData; r: ReturnType<typeof derive>; onSave: SaveFn }) {
  const [birth, setBirth] = useState(d.birthDate ? formatCivil(d.birthDate) : "");
  const [base, setBase] = useState(formatCivil(d.baseDate));
  const [sex, setSex] = useState(d.sex ?? "");
  const pb = birth ? parseCivilBR(birth) : null, pbase = parseCivilBR(base);
  const dirty = (pb ?? null) !== d.birthDate || pbase !== d.baseDate || (sex || null) !== d.sex;
  return (
    <>
      <section className="panel p-4 text-sm">
        <h2 className="mb-2 font-semibold">Dados do segurado</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="block"><span className="label">Sexo</span><select className="field" value={sex} onChange={(e) => setSex(e.target.value)}><option value="">Não informado</option><option value="F">Feminino</option><option value="M">Masculino</option></select></label>
          <label className="block"><span className="label">Nascimento</span><input className="field num" placeholder="dd/mm/aaaa" value={birth} onChange={(e) => setBirth(e.target.value)} /></label>
          <label className="block"><span className="label">Data de referência (DER pretendida)</span><input className="field num" placeholder="dd/mm/aaaa" value={base} onChange={(e) => setBase(e.target.value)} /></label>
          <div className="flex items-end"><button className="btn btn-primary w-full" disabled={!dirty || !pbase || (!!birth && !pb)} onClick={() => onSave({ ...d, sex: (sex || null) as IntelData["sex"], birthDate: pb, baseDate: pbase! }, "Dados do segurado atualizados")}>Salvar dados</button></div>
        </div>
        {d.person.name && <p className="mt-2 text-xs text-fg-muted">Lido do CNIS: {d.person.name}{d.person.nit ? ` · NIT ${d.person.nit}` : ""}{d.person.evidence[0] ? ` (pág. ${d.person.evidence[0].page})` : ""}</p>}
      </section>
      {r.benefits.map((b) => (
        <section key={b.id} className="panel p-4 text-sm">
          <h2 className="mb-2 font-semibold">{b.name}</h2>
          <ul className="space-y-1">{b.requirements.map((q) => <li key={q.text} className="flex flex-wrap items-start gap-2"><Badge tone={REQ[q.state].tone}>{REQ[q.state].label}</Badge><span className="min-w-0 flex-1"><span className="font-medium">{q.text}.</span> {q.detail}</span></li>)}</ul>
          <p className="mt-2 text-xs text-fg-muted">{b.note} Fontes: {b.sources.map((s) => <a key={s.url} className="mr-2 text-accent underline" href={s.url} target="_blank" rel="noreferrer">{s.label}</a>)}</p>
        </section>
      ))}
      <p className="text-xs text-fg-muted">Cálculo de renda (RMI), regras de transição completas e valores de atrasados chegam na fase 2, com índices oficiais versionados.</p>
    </>
  );
}

function Report({ a, d, r, office, client, who, canReview, reviewed, act }: { a: Assessment; d: IntelData; r: ReturnType<typeof derive>; office: string; client: string; who: string; canReview: boolean; reviewed: boolean; act: Act }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const [{ intelReportPdf }, { runPlanning }] = await Promise.all([import("@/domain/pension/report-pdf"), import("@/domain/pension/planning")]);
      const planning = d.planning ? runPlanning(d, d.planning, civilFromInstant(new Date().toISOString())) : null;
      const bytes = await intelReportPdf({ office, client, title: a.title, d, r, reviewed: reviewed ? `${userName(a.reviewerId)} (versão ${a.reviewedVersion})` : null, generatedBy: who, planning });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url; link.download = `relatorio-previdenciario-${client.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-v${a.inputsVersion}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally { setBusy(false); }
  };
  return (
    <section className="panel space-y-3 p-4 text-sm">
      <h2 className="font-semibold">Relatório técnico</h2>
      <p className="text-fg-muted">PDF com documentos analisados, vínculos revisados com página de origem, tempo e carência, conversão com memória de cálculo, comparação CNIS × CTPS, possibilidades por requisito, PPP, auxílio-acidente, pendências e fontes. Gerado neste aparelho.</p>
      {!reviewed && <p className="rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-2 text-warning">Sem revisão profissional desta versão: o PDF sai marcado “ainda não revisada”.</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy} onClick={download}><FileDown aria-hidden className="size-4" /> {busy ? "Gerando…" : "Baixar relatório em PDF"}</button>
        {canReview ? !reviewed && <button className="btn btn-secondary" disabled={act.pending} onClick={() => act.run((ctx) => updateRow("assessments", a.id, ctx, (x: Assessment) => ({ ...x, status: "revisado", reviewedVersion: x.inputsVersion, reviewerId: ctx.actorId, history: [...x.history, { at: nowIso(), actorId: ctx.actorId, text: `Revisada (v${x.inputsVersion}, regras ${RULES_VERSION})` }] }), "Análise revisada"), "Análise marcada como revisada.")}>Marcar como revisada</button>
          : <span className="self-center text-fg-muted">Só advogado(a) ou titular revisa.</span>}
      </div>
      <p className="text-xs text-fg-muted">Fim usado na contagem para vínculos sem data: {r.counted.filter((x) => !x.b.end).map((x) => `${x.b.origin} → ${fmt(effectiveEnd(x.b))}`).join("; ") || "nenhum"}.</p>
    </section>
  );
}
