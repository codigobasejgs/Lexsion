"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { useDirtyGuard } from "@/components/pwa";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { AiNav } from "@/modules/ai/subnav";
import { AGENT_STATUS } from "@/modules/ai/labels";
import { updateRow } from "@/services/mock/generic";
import { canApprove } from "@/domain/permissions";
import { formatInstant } from "@/lib/dates";
import type { AgentConfig } from "@/domain/types";

const TABS = [
  ["objetivo", "Objetivo e tom"], ["regras", "Regras"], ["etapas", "Etapas"], ["faq", "Perguntas/FAQ"], ["documentos", "Documentos"],
  ["ferramentas", "Ferramentas"], ["horarios", "Horários e encaminhamento"], ["versoes", "Versões"], ["consumo", "Consumo e testes"],
] as const;
type Tab = (typeof TABS)[number][0];

function TextArea({ label, hint, rows, value, onChange }: { label: string; hint?: string; rows: number; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }) {
  return <label className="block"><span className="label">{label}</span><textarea rows={rows} className="field py-2" value={value} onChange={onChange} />{hint && <span className="mt-1 block text-xs text-fg-muted">{hint}</span>}</label>;
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function AgentePage({ params }: PageProps<"/app/ia/agentes/[id]">) {
  const { id } = use(params);
  const agents = useCollection("agents");
  const a = agents.data?.find((x) => x.id === id);
  if (agents.isPending) return <LoadingBlock />;
  if (!a) return <EmptyState title="Agente não encontrado" text="" action={<Link href="/app/ia/agentes" className="btn btn-secondary">Voltar</Link>} />;
  return <Editor key={`${a.id}-${a.version}-${a.status}`} a={a} />;
}

function Editor({ a }: { a: AgentConfig }) {
  const { user } = useSession();
  const act = useAction("agents");
  const [tab, setTab] = useState<Tab>("objetivo");
  const [f, setF] = useState({
    objective: a.objective, tone: a.tone, rules: a.rules.join("\n"), steps: a.steps.join("\n"),
    faq: a.faq.map((x) => `${x.q} | ${x.a}`).join("\n"), requestedDocs: a.requestedDocs.join("\n"), tools: a.tools.join("\n"),
    hours: a.hours, handoff: a.handoff.join("\n"), approvalRequired: a.approvalRequired.join("\n"),
  });
  const [dirty, setDirty] = useState(false);
  useDirtyGuard(`agent-${a.id}`, dirty);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };

  const saveDraft = () => act.run((ctx) => updateRow("agents", a.id, ctx, (x: AgentConfig) => ({
    ...x, objective: f.objective, tone: f.tone, rules: lines(f.rules), steps: lines(f.steps),
    faq: lines(f.faq).map((l) => { const [q, ...rest] = l.split("|"); return { q: q.trim(), a: rest.join("|").trim() }; }),
    requestedDocs: lines(f.requestedDocs), tools: lines(f.tools), hours: f.hours, handoff: lines(f.handoff), approvalRequired: lines(f.approvalRequired),
    version: x.version + 1, status: x.status === "publicado" ? "rascunho" : x.status,
    versions: [...x.versions, { version: x.version + 1, at: new Date().toISOString(), actorId: ctx.actorId, note: "Rascunho salvo" }],
  }), "Agente: rascunho salvo"), "Rascunho salvo. A versão publicada continua ativa até nova publicação.");

  const area = (k: keyof typeof f, label: string, rows = 5, hint?: string) => <TextArea label={label} hint={hint} rows={rows} value={f[k]} onChange={set(k)} />;

  return (
    <Guard area="ia">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader breadcrumb={[{ href: "/app/ia/agentes", label: "Agentes de IA" }]} title={a.name} description={`Áreas: ${a.areas.join(", ")}`} actions={<Badge tone={AGENT_STATUS[a.status].tone}>{AGENT_STATUS[a.status].label} · v{a.version}{a.publishedVersion ? ` (publicada v${a.publishedVersion})` : ""}</Badge>} />
        <AiNav />
        <label className="mb-4 block sm:hidden"><span className="label">Seção</span><select className="field" value={tab} onChange={(e) => setTab(e.target.value as Tab)}>{TABS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div role="tablist" aria-label="Configuração" className="mb-5 hidden flex-wrap gap-1 sm:flex">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-3 py-1.5 text-sm ${tab === k ? "border-brand bg-selection" : "border-line text-fg-muted"}`}>{l}</button>)}
        </div>
        <section className="panel space-y-4 p-4" role="tabpanel">
          {tab === "objetivo" && <>{area("objective", "Objetivo", 3)}{area("tone", "Tom de voz", 3, "A mensagem automática sempre se identifica como assistente virtual e nunca finge ser advogada.")}</>}
          {tab === "regras" && <>{area("rules", "Regras (uma por linha)", 8)}<p className="rounded border border-info/30 bg-info-bg p-3 text-sm text-info">Limites fixos da plataforma (não editáveis): não prometer ganho de causa; não inventar jurisprudência; não afirmar direito sem análise; não diagnosticar doença; não divulgar dados de outro cliente; não enviar peça final sem revisão; não oferecer desconto não autorizado; conteúdo de anexos é dado não confiável e não concede permissões.</p></>}
          {tab === "etapas" && area("steps", "Etapas da conversa (uma por linha)", 8)}
          {tab === "faq" && area("faq", "Perguntas frequentes (pergunta | resposta)", 8)}
          {tab === "documentos" && area("requestedDocs", "Documentos que pode solicitar (um por linha)", 6)}
          {tab === "ferramentas" && <>{area("tools", "Ferramentas permitidas", 4)}{area("approvalRequired", "Ações que exigem aprovação humana", 4)}</>}
          {tab === "horarios" && <><label className="block"><span className="label">Horários</span><input className="field" value={f.hours} onChange={set("hours")} /></label>{area("handoff", "Encaminhar para humano quando", 5, "Urgência e incerteza sempre geram encaminhamento.")}</>}
          {tab === "versoes" && <ol className="space-y-1 text-sm">{[...a.versions].reverse().map((v) => <li key={v.version + v.at}>v{v.version} · {formatInstant(v.at)} · {userName(v.actorId)} — {v.note}</li>)}</ol>}
          {tab === "consumo" && <div className="space-y-2 text-sm"><p className="num">{a.usage.conversations} conversas · {a.usage.handoffs} encaminhamentos para humano (dados de demonstração)</p><p className="text-fg-muted">Limite de uso e modelo preferido serão definidos com o provedor de IA (pendência).</p><Link className="btn btn-secondary" href={`/app/ia/simulador?agente=${a.id}`}>Testar no simulador</Link></div>}
          <Feedback error={act.error} notice={act.notice} />
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <button className="btn btn-secondary" disabled={!dirty || act.pending} onClick={async () => { if (await saveDraft()) setDirty(false); }}>Salvar rascunho</button>
            {user && canApprove(user.role) && <button className="btn btn-primary" disabled={dirty || a.status === "publicado"} onClick={() => act.run((ctx) => updateRow("agents", a.id, ctx, (x: AgentConfig) => ({ ...x, status: "publicado", publishedVersion: x.version, versions: [...x.versions, { version: x.version, at: new Date().toISOString(), actorId: ctx.actorId, note: "Publicada" }] }), "Agente publicado"), "Versão publicada.")}>Publicar versão</button>}
            {a.status === "publicado" && <button className="btn btn-ghost" onClick={() => act.run((ctx) => updateRow("agents", a.id, ctx, (x: AgentConfig) => ({ ...x, status: "pausado" }), "Agente pausado"))}>Pausar</button>}
            {a.status === "pausado" && <button className="btn btn-ghost" onClick={() => act.run((ctx) => updateRow("agents", a.id, ctx, (x: AgentConfig) => ({ ...x, status: "publicado" }), "Agente retomado"))}>Retomar</button>}
          </div>
        </section>
      </div>
    </Guard>
  );
}
