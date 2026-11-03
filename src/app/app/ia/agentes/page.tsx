"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bot, Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { AiNav } from "@/modules/ai/subnav";
import { AGENT_STATUS } from "@/modules/ai/labels";
import { createRow } from "@/services/mock/generic";
import { canApprove } from "@/domain/permissions";

// Ponto de partida por finalidade: o escritório ajusta tudo no editor e testa no simulador antes de publicar.
const PRESETS = {
  triagem: { label: "Triagem de novos contatos", objective: "Entender o assunto do contato, coletar os dados mínimos e encaminhar para a equipe avaliar.", steps: ["Cumprimentar e dizer que é a assistente virtual", "Perguntar o assunto", "Coletar nome e cidade", "Informar os documentos iniciais", "Encaminhar para a equipe"], handoff: ["Urgência ou prazo judicial", "Pedido de valor ou chance de ganhar", "Cliente pede atendente"] },
  duvidas: { label: "Dúvidas frequentes do escritório", objective: "Responder horários, endereço, áreas e como funciona a primeira consulta.", steps: ["Cumprimentar", "Responder com a base de conhecimento", "Oferecer falar com a equipe"], handoff: ["Pergunta sobre um processo específico", "Cliente pede atendente"] },
  documentos: { label: "Coleta de documentos", objective: "Lembrar e orientar o envio dos documentos pendentes, um por vez.", steps: ["Lembrar a pendência", "Orientar como fotografar", "Agradecer e informar o próximo passo"], handoff: ["Documento ilegível repetido", "Cliente pede atendente"] },
} as const;
type Preset = keyof typeof PRESETS;

function Wizard({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const act = useAction("agents");
  const [f, setF] = useState({ name: "Assistente do escritório", preset: "triagem" as Preset, area: "", hours: "Seg–sex 9h–18h", tone: "Cordial, frases curtas, linguagem simples." });
  const create = async () => {
    const p = PRESETS[f.preset];
    const r = await act.run((ctx) => createRow("agents", {
      name: f.name.trim(), objective: p.objective, tone: f.tone, rules: ["Não prometer resultado", "Não informar valores sem análise da equipe"], steps: [...p.steps], faq: [], requestedDocs: [], tools: [],
      hours: f.hours, handoff: [...p.handoff], areas: f.area.trim() ? [f.area.trim()] : ["Todas"], approvalRequired: [], status: "rascunho", version: 1,
      versions: [{ version: 1, at: new Date().toISOString(), actorId: ctx.actorId, note: `Criada pelo assistente (${p.label})` }], usage: { conversations: 0, handoffs: 0 }, knowledge: "",
    }, ctx, "Assistente criada"), "Assistente criada como rascunho.");
    if (r) router.push(`/app/ia/agentes/${r.id}`);
  };
  return (
    <Dialog open onClose={onClose} title="Nova assistente virtual">
      <div className="space-y-3 text-sm">
        <label className="block"><span className="label">Nome</span><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} /></label>
        <fieldset><legend className="label">Para que ela serve?</legend>
          {(Object.keys(PRESETS) as Preset[]).map((k) => <label key={k} className="flex items-center gap-2 py-1"><input type="radio" name="preset" className="accent-[var(--brand)]" checked={f.preset === k} onChange={() => setF({ ...f, preset: k })} />{PRESETS[k].label}</label>)}
        </fieldset>
        <label className="block"><span className="label">Área principal (opcional)</span><input className="field" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Ex.: Previdenciário" /></label>
        <label className="block"><span className="label">Horário de atendimento da equipe</span><input className="field" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
        <label className="block"><span className="label">Tom de voz</span><input className="field" value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })} /></label>
        <p className="text-fg-muted">Ela nasce como rascunho. Depois: complete a base de conhecimento, teste no simulador e publique.</p>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={f.name.trim().length < 3 || act.pending} onClick={create}>Criar rascunho</button></div>
      </div>
    </Dialog>
  );
}

export default function AgentesPage() {
  const agents = useCollection("agents");
  const { user, mode } = useSession();
  const [wizard, setWizard] = useState(false);
  const canCreate = !!user && canApprove(user.role);
  return (
    <Guard area="ia">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Agentes de IA" description={mode === "real" ? "Assistentes virtuais do escritório, sempre identificadas como assistente. A versão publicada atende no WhatsApp; edite, teste no simulador e publique." : "Assistentes virtuais configuráveis, sempre identificados como assistente. Nenhum modelo real está conectado: respostas são de demonstração."}
          actions={<>{mode !== "real" && <SimulatedBadge label="Sem modelo real" />}{canCreate && <button className="btn btn-primary" onClick={() => setWizard(true)}><Plus aria-hidden className="size-4" /> Nova assistente</button>}</>} />
        <AiNav />
        {agents.isPending ? <LoadingBlock /> : !agents.data?.length ? <EmptyState title="Nenhuma assistente ainda" text={canCreate ? "Crie a primeira: leva um minuto." : "Peça ao titular do escritório para criar."} /> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.data.map((a) => (
              <li key={a.id}><Link href={`/app/ia/agentes/${a.id}`} className="panel flex h-full flex-col gap-2 p-4 hover:border-line-strong">
                <div className="flex items-center gap-2"><Bot aria-hidden className="size-5 text-ai" /><h2 className="flex-1 font-semibold">{a.name}</h2><Badge tone={AGENT_STATUS[a.status].tone}>{AGENT_STATUS[a.status].label}</Badge></div>
                <p className="text-sm text-fg-muted">{a.objective}</p>
                <p className="num mt-auto text-xs text-fg-muted">v{a.version}{a.publishedVersion ? ` · publicada v${a.publishedVersion}` : ""}{a.whatsapp ? " · atende no WhatsApp" : ""} · {a.usage.conversations} conversas · {a.usage.handoffs} encaminhamentos</p>
              </Link></li>
            ))}
          </ul>
        )}
        {wizard && <Wizard onClose={() => setWizard(false)} />}
      </div>
    </Guard>
  );
}
