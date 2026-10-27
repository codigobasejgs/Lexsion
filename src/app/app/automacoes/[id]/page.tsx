"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Copy, Pause, Play, TestTube2 } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { createRow, updateRow } from "@/services/mock/generic";
import { readAll } from "@/services/mock/db";
import { formatInstant } from "@/lib/dates";
import type { Automation } from "@/domain/types";

const TRIGGERS = ["lead.created (campanha)", "conversa sem resposta do cliente", "document.received", "proposal.accepted", "contract.completed", "installment.overdue", "case.eventAdded", "deadline.near"];
const ACTIONS = ["Criar tarefa para o responsável", "Sugerir mensagem de follow-up (aprovação humana)", "Mudar etapa do funil", "Pedir documento", "Notificar responsável", "Abrir revisão", "Notificar responsável financeiro", "Criar tarefa de revisão"];
const STOPS = ["Cliente respondeu", "Contratado", "Opt-out", "Humano assumiu", "Parcela paga", "Renegociada", "Lead respondido"];

export default function AutomacaoPage({ params }: PageProps<"/app/automacoes/[id]">) {
  const { id } = use(params);
  const autos = useCollection("automations");
  const runs = useCollection("automationRuns");
  const a = autos.data?.find((x) => x.id === id);
  if (autos.isPending) return <LoadingBlock />;
  if (!a) return <EmptyState title="Automação não encontrada" text="" action={<Link className="btn btn-secondary" href="/app/automacoes">Voltar</Link>} />;
  return <Editor key={`${a.id}-${a.version}-${a.status}`} a={a} runs={(runs.data ?? []).filter((r) => r.automationId === a.id)} />;
}

function Editor({ a, runs }: { a: Automation; runs: { id: string; at: string; target: string; result: string; detail: string }[] }) {
  const act = useAction("automations", "automationRuns");
  const [f, setF] = useState({ name: a.name, trigger: a.trigger, conditions: a.conditions.join("\n"), waitHours: a.waitHours, action: a.action, stopWhen: a.stopWhen, maxAttempts: a.maxAttempts });

  const test = () => act.run(async (ctx) => {
    // Teste com dado fictício: deduplica por chave e respeita opt-out/limite.
    const all = await readAll("automationRuns");
    const key = `${a.id}:teste:${f.trigger}`;
    const dup = all.some((r) => r.dedupeKey === key);
    return createRow("automationRuns", { automationId: a.id, at: new Date().toISOString(), target: "Registro fictício de teste", result: dup ? "ignorada" : "teste", detail: dup ? "Evento duplicado ignorado (deduplicação)" : `Ação simulada: ${f.action}. Nada foi enviado.`, dedupeKey: dup ? `${key}:${Date.now()}` : key }, ctx, "Teste de automação");
  }, (r) => r.detail);

  return (
    <Guard area="automacoes">
      <div className="mx-auto max-w-[1000px]">
        <PageHeader breadcrumb={[{ href: "/app/automacoes", label: "Automações" }]} title={a.name} actions={<Badge tone={a.status === "ativa" ? "success" : a.status === "pausada" ? "warning" : "neutral"}>{a.status} · v{a.version}</Badge>} />
        <section className="panel space-y-4 p-4 text-sm">
          <label className="block"><span className="label">Nome</span><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <ol className="space-y-3">
            <li><label className="block"><span className="label">1. Gatilho</span><select className="field" value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })}>{TRIGGERS.map((t) => <option key={t}>{t}</option>)}</select></label></li>
            <li><label className="block"><span className="label">2. Condições (uma por linha)</span><textarea rows={3} className="field py-2" value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} /></label></li>
            <li><label className="block"><span className="label">3. Espera (horas)</span><input type="number" min={0} className="field num" value={f.waitHours} onChange={(e) => setF({ ...f, waitHours: Number(e.target.value) })} /></label></li>
            <li><label className="block"><span className="label">4. Ação</span><select className="field" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}>{ACTIONS.map((t) => <option key={t}>{t}</option>)}</select></label></li>
            <li><fieldset><legend className="label">5. Encerrar quando</legend><div className="flex flex-wrap gap-3">{STOPS.map((s) => <label key={s} className="flex items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.stopWhen.includes(s)} onChange={(e) => setF({ ...f, stopWhen: e.target.checked ? [...f.stopWhen, s] : f.stopWhen.filter((x) => x !== s) })} />{s}</label>)}</div></fieldset></li>
            <li><label className="block"><span className="label">Máximo de tentativas (evita ciclos)</span><input type="number" min={1} max={5} className="field num" value={f.maxAttempts} onChange={(e) => setF({ ...f, maxAttempts: Math.min(5, Math.max(1, Number(e.target.value))) })} /></label></li>
          </ol>
          <p className="text-fg-muted">Regras fixas: respeita opt-out e horário do escritório; deduplica eventos; interrompe follow-up após resposta; não dispara em massa sem audiência autorizada e revisão.</p>
          <Feedback error={act.error} notice={act.notice} />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => act.run((ctx) => updateRow("automations", a.id, ctx, (x: Automation) => ({ ...x, name: f.name, trigger: f.trigger, conditions: f.conditions.split("\n").map((s) => s.trim()).filter(Boolean), waitHours: f.waitHours, action: f.action, stopWhen: f.stopWhen, maxAttempts: f.maxAttempts, version: x.version + 1 }), "Automação salva"), "Nova versão salva.")}>Salvar nova versão</button>
            <button className="btn btn-secondary" onClick={test}><TestTube2 aria-hidden className="size-4" /> Testar com dados fictícios</button>
            {a.status === "ativa" ? <button className="btn btn-ghost" onClick={() => act.run((ctx) => updateRow("automations", a.id, ctx, (x: Automation) => ({ ...x, status: "pausada" }), "Pausada"))}><Pause aria-hidden className="size-4" /> Pausar</button>
              : <button className="btn btn-ghost" onClick={() => act.run((ctx) => updateRow("automations", a.id, ctx, (x: Automation) => ({ ...x, status: "ativa" }), "Ativada"))}><Play aria-hidden className="size-4" /> Ativar</button>}
            <button className="btn btn-ghost" onClick={() => act.run((ctx) => createRow("automations", { ...a, id: undefined, name: `${a.name} (cópia)`, status: "rascunho", version: 1 }, ctx, "Automação duplicada"), "Cópia criada como rascunho.")}><Copy aria-hidden className="size-4" /> Duplicar</button>
          </div>
        </section>
        <section className="panel mt-5 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Execuções</h2>
          {runs.length ? <ul className="space-y-1">{[...runs].reverse().map((r) => <li key={r.id}><span className="num text-fg-muted">{formatInstant(r.at)}</span> · <Badge tone={r.result === "erro" ? "danger" : r.result === "ignorada" ? "neutral" : "success"} icon={false}>{r.result}</Badge> {r.target} — {r.detail}</li>)}</ul> : <p className="text-fg-muted">Sem execuções.</p>}
        </section>
      </div>
    </Guard>
  );
}
