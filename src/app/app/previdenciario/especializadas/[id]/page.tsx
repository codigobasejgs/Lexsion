"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FilePlus2, FileText, Plus, Trash2 } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { createRow, nowIso, updateRow } from "@/services/mock/generic";
import { docService } from "@/services/mock/ops-repo";
import { allowed } from "@/domain/permissions";
import { bpcPerCapita } from "@/domain/cnis";
import { formatBRL, parseBRL } from "@/lib/money";
import { formatCivil } from "@/lib/dates";
import type { Assessment } from "@/domain/types";

type Member = { name: string; income: number; excluded?: boolean };
type PppPeriod = { id: string; empregador: string; inicio: string; fim: string; agente: string; intensidade: string; epiEficaz: string; documento: string; ltcat: boolean };

// Análises especializadas (paridade TI/CJ/INT): BPC/LOAS e PPP. Nada decide elegibilidade: tudo vira
// pendência, quesito ou minuta para revisão de advogado(a).
export default function EspecializadaPage({ params }: PageProps<"/app/previdenciario/especializadas/[id]">) {
  const { id } = use(params);
  const rows = useCollection("assessments");
  const a = rows.data?.find((x) => x.id === id);
  if (rows.isPending) return <LoadingBlock />;
  if (!a) return <EmptyState title="Análise não encontrada" text="Pode pertencer a outro escritório." action={<Link href="/app/previdenciario" className="btn btn-secondary">Voltar</Link>} />;
  return <Guard area="previdenciario"><View key={`${a.id}-${a.inputsVersion}`} a={a} /></Guard>;
}

function View({ a }: { a: Assessment }) {
  const { user } = useSession();
  const router = useRouter();
  const cases = useCollection("cases");
  const clients = useCollection("clients");
  const act = useAction("assessments", "documents", "drafts");
  const k = cases.data?.find((x) => x.id === a.caseId);
  const client = clients.data?.find((x) => x.id === a.clientId);
  const stale = a.reviewedVersion !== null && a.reviewedVersion !== a.inputsVersion;
  const canReview = allowed(user?.role, "aprovar_peca");
  const save = (data: Record<string, unknown>, text: string) => act.run((ctx) => updateRow("assessments", a.id, ctx, (x: Assessment) => ({ ...x, data, inputsVersion: x.inputsVersion + 1, status: "rascunho", history: [...x.history, { at: nowIso(), actorId: ctx.actorId, text }] }), text));
  const draft = async (title: string, body: string) => {
    const r = await act.run((ctx) => createRow("drafts", { title, kind: a.kind === "bpc" ? "requerimento" : "quesitos", caseId: a.caseId, body, status: "rascunho", references: [], comments: [], history: [{ at: nowIso(), actorId: ctx.actorId, text: `Gerado da análise ${a.id} (v${a.inputsVersion})` }], updatedAt: nowIso() }, ctx, "Minuta gerada da análise"));
    if (r) router.push(`/app/minutas/${r.id}`);
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader breadcrumb={[{ href: "/app/previdenciario", label: "Previdenciário" }]} title={a.title} description={<>{client?.name} · {k ? <Link className="text-accent underline underline-offset-2" href={`/app/casos/${k.id}`}>{k.title}</Link> : "sem caso"} · versão das entradas {a.inputsVersion}</>} actions={<SimulatedBadge label="Análise ilustrativa" />} />
      <p role="note" className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-dashed border-accent/60 p-3 text-sm text-accent"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> Não decide elegibilidade. Critérios, valores de referência e enquadramentos dependem da norma vigente e de revisão profissional.</p>
      {a.kind === "bpc" ? <Bpc a={a} onSave={save} onDraft={draft} /> : <Ppp a={a} onSave={save} onDraft={draft} />}
      <section className="panel mt-5 flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="flex-1">Revisão: {a.status === "revisado" && !stale ? <Badge tone="success">Revisado por {userName(a.reviewerId)} (v{a.reviewedVersion})</Badge> : stale ? <Badge tone="danger">Revisão desatualizada: entradas mudaram</Badge> : <Badge tone="warning">Aguardando revisão</Badge>}</span>
        {canReview ? (a.status !== "revisado" || stale) && <button className="btn btn-secondary" onClick={() => act.run((ctx) => updateRow("assessments", a.id, ctx, (x: Assessment) => ({ ...x, status: "revisado", reviewedVersion: x.inputsVersion, reviewerId: ctx.actorId, history: [...x.history, { at: nowIso(), actorId: ctx.actorId, text: `Revisado (v${x.inputsVersion})` }] }), "Análise revisada"), "Análise marcada como revisada.")}>Marcar como revisada</button>
          : <span className="text-fg-muted">Só advogado(a) ou titular revisa.</span>}
        <button className="btn btn-ghost" onClick={() => act.run((ctx) => docService.request({ clientId: a.clientId, caseId: a.caseId, name: a.kind === "bpc" ? "Documentos do BPC/LOAS" : "PPP/LTCAT completo", type: a.kind === "bpc" ? "Comprovante" : "PPP", note: `Solicitado pela análise ${a.title}` }, ctx), "Solicitação criada: aparece no portal do cliente.")}><FilePlus2 aria-hidden className="size-4" /> Solicitar documentos ao cliente</button>
      </section>
      {a.history.length > 0 && <details className="panel mt-3 p-4 text-sm"><summary className="cursor-pointer font-medium">Histórico ({a.history.length})</summary><ol className="mt-2 space-y-1 text-fg-muted">{a.history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString("pt-BR")} · {userName(h.actorId)} · {h.text}</li>)}</ol></details>}
      <Feedback error={act.error} notice={act.notice} />
    </div>
  );
}

function Bpc({ a, onSave, onDraft }: { a: Assessment; onSave: (d: Record<string, unknown>, t: string) => void; onDraft: (title: string, body: string) => void }) {
  const d = a.data as { criterio: string; salarioMinimo: string; fracao: string; membros: Member[]; provas: Record<string, boolean>; notas: string };
  const [f, setF] = useState(d);
  const [nm, setNm] = useState({ name: "", income: "" });
  const sm = parseBRL(f.salarioMinimo) ?? 0;
  const frac = Number(String(f.fracao).replace(",", "."));
  const r = bpcPerCapita(f.membros, sm, frac);
  const missing = Object.entries(f.provas).filter(([, v]) => !v).map(([k]) => k);
  const dirty = JSON.stringify(f) !== JSON.stringify(d);
  const body = !("error" in r) ? [
    `BPC/LOAS — ${a.title}`, "Rascunho para revisão do advogado(a). Não protocolar sem conferência.", "",
    `Critério: ${f.criterio === "idoso" ? "pessoa idosa" : "pessoa com deficiência"}`,
    `Grupo familiar (${f.membros.length} pessoas): ${f.membros.map((m) => `${m.name}${m.excluded ? " [renda excluída do cálculo]" : ""}: ${formatBRL(m.income)}`).join("; ")}`,
    `Renda per capita apurada: ${formatBRL(r.perCapita)} frente a ${f.fracao} do salário mínimo informado (${formatBRL(r.limit)})`,
    `Provas pendentes: ${missing.join(", ") || "nenhuma"}`, "", "Fundamentação: [advogado(a) — não preenchido]",
  ].join("\n") : "";
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel space-y-3 p-4 text-sm">
        <h2 className="font-semibold">Triagem e composição familiar</h2>
        <fieldset className="flex gap-4"><legend className="label">Critério</legend>{[["idoso", "Pessoa idosa"], ["pcd", "Pessoa com deficiência"]].map(([v, l]) => <label key={v} className="flex items-center gap-1.5"><input type="radio" name="crit" className="size-4 accent-[var(--brand)]" checked={f.criterio === v} onChange={() => setF({ ...f, criterio: v })} />{l}</label>)}</fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="label">Salário mínimo vigente (informado, R$)</span><input className="field num" value={f.salarioMinimo} onChange={(e) => setF({ ...f, salarioMinimo: e.target.value })} /></label>
          <label className="block"><span className="label">Fração do mínimo (critério legal a conferir)</span><input className="field num" value={f.fracao} onChange={(e) => setF({ ...f, fracao: e.target.value })} /></label>
        </div>
        <table className="w-full text-sm"><caption className="sr-only">Grupo familiar</caption>
          <thead><tr className="text-left text-xs text-fg-muted"><th className="py-1">Pessoa</th><th>Renda</th><th>Excluir</th><th><span className="sr-only">Remover</span></th></tr></thead>
          <tbody>{f.membros.map((m, i) => (
            <tr key={i} className="border-t border-line"><td className="py-1.5 pr-2">{m.name}</td><td className="num">{formatBRL(m.income)}</td>
              <td><input type="checkbox" aria-label={`Excluir renda de ${m.name}`} className="size-4 accent-[var(--brand)]" checked={!!m.excluded} onChange={(e) => setF({ ...f, membros: f.membros.map((x, j) => (j === i ? { ...x, excluded: e.target.checked } : x)) })} /></td>
              <td><button className="btn btn-ghost min-h-9 px-2" aria-label={`Remover ${m.name}`} onClick={() => setF({ ...f, membros: f.membros.filter((_, j) => j !== i) })}><Trash2 aria-hidden className="size-4" /></button></td></tr>
          ))}</tbody>
        </table>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-40 flex-1"><span className="label">Nome/parentesco</span><input className="field" value={nm.name} onChange={(e) => setNm({ ...nm, name: e.target.value })} /></label>
          <label className="block w-32"><span className="label">Renda (R$)</span><input className="field num" value={nm.income} onChange={(e) => setNm({ ...nm, income: e.target.value })} /></label>
          <button className="btn btn-secondary" disabled={!nm.name.trim() || parseBRL(nm.income || "0") === null} onClick={() => { setF({ ...f, membros: [...f.membros, { name: nm.name.trim(), income: parseBRL(nm.income || "0")! }] }); setNm({ name: "", income: "" }); }}><Plus aria-hidden className="size-4" /> Adicionar</button>
        </div>
        <fieldset><legend className="label">Provas sociais e documentais</legend><div className="grid gap-1 sm:grid-cols-2">{Object.entries(f.provas).map(([k, v]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={v} onChange={(e) => setF({ ...f, provas: { ...f.provas, [k]: e.target.checked } })} />{k}</label>)}</div></fieldset>
        <label className="block"><span className="label">Observações (dados sensíveis: só o necessário)</span><textarea rows={3} className="field py-2" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></label>
        <button className="btn btn-primary" disabled={!dirty} onClick={() => onSave(f, "Triagem BPC atualizada")}>Salvar nova versão</button>
      </section>
      <section className="panel space-y-3 p-4 text-sm" aria-live="polite">
        <h2 className="font-semibold">Resultado ilustrativo</h2>
        {"error" in r ? <p role="alert" className="text-warning">{r.error}</p> : (
          <>
            <dl className="space-y-1">
              <div className="flex justify-between"><dt>Renda considerada</dt><dd className="num">{formatBRL(r.total)}</dd></div>
              <div className="flex justify-between"><dt>Pessoas no grupo</dt><dd className="num">{f.membros.length}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Renda per capita</dt><dd className="num" data-testid="bpc-per-capita">{formatBRL(r.perCapita)}</dd></div>
              <div className="flex justify-between"><dt>Referência ({f.fracao} do mínimo informado)</dt><dd className="num">{formatBRL(r.limit)}</dd></div>
            </dl>
            <Badge tone={r.withinLimit ? "success" : "warning"}>{r.withinLimit ? "Dentro da referência informada" : "Acima da referência — avaliar outros meios de prova"}</Badge>
            <ul className="list-disc pl-5 text-xs text-fg-muted">
              <li>Exclusões de renda: {r.excluded.join(", ") || "nenhuma"} — exigem fundamento a ser conferido.</li>
              <li>A renda per capita não é critério absoluto; vulnerabilidade pode ser provada por outros meios.</li>
              <li>Perícias social e médica (PcD) e CadÚnico são verificados pelo INSS; aqui só organizamos provas.</li>
            </ul>
          </>
        )}
        {missing.length > 0 && <div><p className="font-medium">Provas pendentes</p><ul className="list-disc pl-5">{missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
        <button className="btn btn-secondary" disabled={"error" in r || dirty} onClick={() => onDraft(`Requerimento BPC/LOAS — rascunho`, body)}><FileText aria-hidden className="size-4" /> Gerar minuta para revisão</button>
        {dirty && <p className="text-xs text-fg-muted">Salve a nova versão antes de gerar a minuta.</p>}
      </section>
    </div>
  );
}

function Ppp({ a, onSave, onDraft }: { a: Assessment; onSave: (d: Record<string, unknown>, t: string) => void; onDraft: (title: string, body: string) => void }) {
  const d = a.data as { periodos: PppPeriod[]; quesitos: string[] };
  const [periods, setPeriods] = useState(d.periodos);
  const [quesitos, setQuesitos] = useState(d.quesitos);
  const dirty = JSON.stringify({ periodos: periods, quesitos }) !== JSON.stringify(d);
  const issues = (p: PppPeriod) => [
    p.fim < p.inicio && "Datas invertidas",
    !p.ltcat && "Sem LTCAT anexo",
    /não informad/i.test(p.intensidade) && "Intensidade não informada",
    p.epiEficaz === "não informado" && "EPI não informado",
    p.epiEficaz === "sim" && "PPP declara EPI eficaz",
  ].filter(Boolean) as string[];
  const suggested = periods.flatMap((p) => [
    `Quanto ao período de ${formatCivil(p.inicio)} a ${formatCivil(p.fim)} na ${p.empregador}: o(a) autor(a) esteve exposto(a) a ${p.agente.toLowerCase()} de forma habitual e permanente?`,
    `Qual a intensidade/concentração de ${p.agente.toLowerCase()} medida no ambiente e qual a metodologia utilizada?`,
    ...(p.epiEficaz !== "não" ? [`O EPI fornecido neutralizava efetivamente ${p.agente.toLowerCase()}? Há registro de fornecimento, troca e fiscalização de uso?`] : []),
  ]);
  return (
    <div className="space-y-5">
      <section className="panel overflow-x-auto p-4 text-sm">
        <h2 className="mb-2 font-semibold">Períodos, agentes e provas</h2>
        <ul className="space-y-3">{periods.map((p, i) => (
          <li key={p.id} className="rounded-[var(--radius-control)] border border-line p-3" data-testid={`ppp-${p.id}`}>
            <p className="font-medium">{p.empregador} <span className="num text-fg-muted">· {formatCivil(p.inicio)} – {formatCivil(p.fim)}</span></p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <label className="block"><span className="label">Agente</span><input className="field" value={p.agente} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, agente: e.target.value } : x)))} /></label>
              <label className="block"><span className="label">Intensidade</span><input className="field" value={p.intensidade} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, intensidade: e.target.value } : x)))} /></label>
              <label className="block"><span className="label">EPI eficaz (PPP)</span><select className="field" value={p.epiEficaz} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, epiEficaz: e.target.value } : x)))}>{["sim", "não", "não informado"].map((o) => <option key={o}>{o}</option>)}</select></label>
              <label className="flex items-end gap-2 pb-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={p.ltcat} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, ltcat: e.target.checked } : x)))} /> LTCAT anexo</label>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{issues(p).length ? issues(p).map((t) => <Badge key={t} tone="warning">{t}</Badge>) : <Badge tone="success">Sem pendência documental</Badge>}</div>
            {p.epiEficaz === "sim" && <p className="mt-1 text-xs text-fg-muted">EPI eficaz declarado no PPP: avaliar impugnação conforme o agente (ex.: ruído) e a prova de fornecimento e uso.</p>}
          </li>
        ))}</ul>
        <p className="mt-2 text-xs text-fg-muted">Enquadramento por agente e época depende da norma vigente no período e de jurisprudência: não é decidido aqui.</p>
      </section>
      <section className="panel space-y-3 p-4 text-sm">
        <h2 className="font-semibold">Quesitos para a perícia</h2>
        <p className="text-fg-muted">Sugestões geradas só a partir dos períodos acima (sem fonte externa). Inclua as que fizerem sentido e edite.</p>
        <ul className="space-y-1">{suggested.map((q) => <li key={q} className="flex items-start gap-2"><input type="checkbox" aria-label={`Incluir quesito: ${q}`} className="mt-1 size-4 accent-[var(--brand)]" checked={quesitos.includes(q)} onChange={(e) => setQuesitos(e.target.checked ? [...quesitos, q] : quesitos.filter((x) => x !== q))} /><span>{q}</span></li>)}</ul>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={!dirty} onClick={() => onSave({ periodos: periods, quesitos }, "Períodos/quesitos PPP atualizados")}>Salvar nova versão</button>
          <button className="btn btn-secondary" disabled={dirty || !quesitos.length} onClick={() => onDraft("Quesitos — perícia de atividade especial (rascunho)", ["QUESITOS DO(A) AUTOR(A)", "Rascunho para revisão do advogado(a).", "", ...quesitos.map((q, i) => `${i + 1}. ${q}`), "", "Assistente técnico: [advogado(a) — não preenchido]"].join("\n"))}><FileText aria-hidden className="size-4" /> Gerar minuta de quesitos</button>
        </div>
        {dirty && <p className="text-xs text-fg-muted">Salve a nova versão antes de gerar a minuta.</p>}
      </section>
    </div>
  );
}
