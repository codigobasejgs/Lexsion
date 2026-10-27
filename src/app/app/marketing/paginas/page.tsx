"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, Monitor, Smartphone, Trash2 } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { MarketingNav } from "@/modules/marketing/subnav";
import { updateRow } from "@/services/mock/generic";
import type { LandingPage } from "@/domain/types";

const KINDS: LandingPage["blocks"][number]["kind"][] = ["apresentacao", "servico", "duvidas", "formulario", "privacidade", "contato"];
const KIND_LABEL = { apresentacao: "Apresentação", servico: "Serviço", duvidas: "Dúvidas", formulario: "Formulário", privacidade: "Privacidade", contato: "Contato" };

export default function PaginasPage() {
  const pages = useCollection("landingPages");
  const lp = pages.data?.[0];
  return (
    <Guard area="marketing">
      <div className="mx-auto max-w-[1300px]">
        <PageHeader title="Landing pages" description="Editor por blocos próprios com prévia desktop/celular. O formulário de captação é testado em “Simular formulário de campanha”." actions={<Link href="/app/crm/captura" className="btn btn-secondary">Testar formulário</Link>} />
        <MarketingNav />
        {pages.isPending ? <LoadingBlock /> : !lp ? <EmptyState title="Sem páginas" text="" /> : <Editor key={lp.id + lp.blocks.length} lp={lp} />}
      </div>
    </Guard>
  );
}

function Editor({ lp }: { lp: LandingPage }) {
  const act = useAction("landingPages");
  const [blocks, setBlocks] = useState(lp.blocks);
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const move = (i: number, d: -1 | 1) => { const b = [...blocks]; [b[i], b[i + d]] = [b[i + d], b[i]]; setBlocks(b); };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="panel space-y-3 p-4 text-sm">
        <h2 className="font-semibold">{lp.title} <span className="font-normal text-fg-muted">/lp/{lp.slug}</span></h2>
        <ol className="space-y-2">
          {blocks.map((b, i) => (
            <li key={b.id} className="rounded-[var(--radius-control)] border border-line p-2">
              <div className="mb-1 flex items-center gap-1"><span className="flex-1 font-medium">{KIND_LABEL[b.kind]}</span>
                <button className="btn btn-ghost min-h-8 px-2" aria-label="Subir bloco" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp aria-hidden className="size-4" /></button>
                <button className="btn btn-ghost min-h-8 px-2" aria-label="Descer bloco" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown aria-hidden className="size-4" /></button>
                <button className="btn btn-ghost min-h-8 px-2" aria-label="Remover bloco" disabled={b.kind === "privacidade"} onClick={() => setBlocks(blocks.filter((x) => x.id !== b.id))}><Trash2 aria-hidden className="size-4" /></button>
              </div>
              <textarea aria-label={`Texto do bloco ${KIND_LABEL[b.kind]}`} rows={2} className="field py-1.5 text-sm" value={b.text} onChange={(e) => setBlocks(blocks.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))} />
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-1">{KINDS.map((k) => <button key={k} className="btn btn-ghost min-h-8 border border-line text-xs" onClick={() => setBlocks([...blocks, { id: crypto.randomUUID().slice(0, 6), kind: k, text: "" }])}>+ {KIND_LABEL[k]}</button>)}</div>
        <p className="text-xs text-fg-muted">O bloco de privacidade é obrigatório. Evite promessas de resultado e depoimentos de êxito.</p>
        <Feedback error={act.error} notice={act.notice} />
        <button className="btn btn-primary" onClick={() => act.run((ctx) => updateRow("landingPages", lp.id, ctx, (x: LandingPage) => ({ ...x, blocks, status: "revisao" }), "Landing page salva"), "Salva e enviada para revisão (OAB).")}>Salvar e enviar para revisão</button>
      </section>
      <section aria-label="Prévia" className="space-y-2">
        <div role="radiogroup" aria-label="Dispositivo" className="inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm">
          <button role="radio" aria-checked={device === "mobile"} onClick={() => setDevice("mobile")} className={`flex items-center gap-1 rounded-md px-3 py-1.5 ${device === "mobile" ? "bg-brand text-on-brand" : "text-fg-muted"}`}><Smartphone aria-hidden className="size-4" /> Celular</button>
          <button role="radio" aria-checked={device === "desktop"} onClick={() => setDevice("desktop")} className={`flex items-center gap-1 rounded-md px-3 py-1.5 ${device === "desktop" ? "bg-brand text-on-brand" : "text-fg-muted"}`}><Monitor aria-hidden className="size-4" /> Computador</button>
        </div>
        <div className={`mx-auto overflow-hidden rounded-[var(--radius-panel)] border border-line bg-[#fbf8f2] text-[#211a10] ${device === "mobile" ? "max-w-[360px]" : "w-full"}`}>
          {blocks.map((b) => (
            <div key={b.id} className={`border-b border-[#eee8dd] p-5 ${b.kind === "apresentacao" ? "bg-[#15120e] text-[#f7f1e6]" : ""}`}>
              <p className="text-xs uppercase tracking-widest text-[#a67c36]">{KIND_LABEL[b.kind]}</p>
              {b.kind === "formulario" ? <div className="mt-2 space-y-2"><div className="h-9 rounded border border-[#d9cdb8] bg-white" /><div className="h-9 rounded border border-[#d9cdb8] bg-white" /><div className="h-10 rounded bg-[#765414]" /></div> : <p className={b.kind === "apresentacao" ? "mt-1 font-serif text-lg" : "mt-1"}>{b.text || "(vazio)"}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
