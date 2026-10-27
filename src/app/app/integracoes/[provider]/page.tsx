"use client";

import Link from "next/link";
import { use } from "react";
import { PlugZap, RefreshCw, Unplug } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { INT_STATUS } from "@/modules/integrations/labels";
import { messagingService } from "@/services/mock/ops-repo";
import { createRow } from "@/services/mock/generic";
import { formatInstant } from "@/lib/dates";

export default function IntegracaoPage({ params }: PageProps<"/app/integracoes/[provider]">) {
  const { provider } = use(params);
  const { user } = useSession();
  const ints = useCollection("integrations");
  const outbox = useCollection("outbox");
  const events = useCollection("integrationEvents");
  const act = useAction("integrations", "integrationEvents", "outbox", "messages");
  const i = ints.data?.find((x) => x.provider === provider);
  if (ints.isPending) return <LoadingBlock />;
  if (!i) return <EmptyState title="Integração não encontrada" text="" action={<Link className="btn btn-secondary" href="/app/integracoes">Voltar</Link>} />;
  const pending = (outbox.data ?? []).filter((o) => o.status === "pendente");
  const evs = (events.data ?? []).filter((e) => e.provider === provider).slice(-10).reverse();
  const isAdmin = user?.role === "admin";

  return (
    <Guard area="integracoes">
      <div className="mx-auto max-w-[1000px]">
        <PageHeader breadcrumb={[{ href: "/app/integracoes", label: "Integrações" }]} title={i.name} description={i.purpose} actions={<><SimulatedBadge label={`Modo ${i.mode}`} /><Badge tone={INT_STATUS[i.status].tone}>{INT_STATUS[i.status].label}</Badge></>} />
        {i.lastError && <p role="alert" className="mb-4 rounded-[var(--radius-control)] border border-danger/40 bg-danger-bg p-3 text-sm text-danger">{i.lastError}. {isAdmin ? "Como resolver: reconecte a instância (leia o QR no aparelho do escritório). Mensagens pendentes serão reenviadas uma única vez." : "A equipe administradora já foi avisada; suas mensagens ficam guardadas e serão enviadas quando a conexão voltar."}</p>}
        <div className="grid gap-5 md:grid-cols-2">
          <section className="panel p-4 text-sm">
            <h2 className="mb-2 font-semibold">Capacidades</h2>
            <ul className="space-y-1">{Object.entries(i.capabilities).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className={v === "supported" ? "text-success" : v === "unsupported" ? "text-danger" : "text-warning"}>{v === "supported" ? "suportado" : v === "unsupported" ? "não suportado" : "a validar"}</span></li>)}{!Object.keys(i.capabilities).length && <li className="text-fg-muted">A identificar.</li>}</ul>
            <h2 className="mb-1 mt-4 font-semibold">Limitações</h2><ul className="list-disc space-y-0.5 pl-5">{i.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
            <h2 className="mb-1 mt-4 font-semibold">Requisitos para produção</h2><ul className="list-disc space-y-0.5 pl-5">{i.requirements.map((l) => <li key={l}>{l}</li>)}</ul>
          </section>
          <section className="panel space-y-3 p-4 text-sm">
            <h2 className="font-semibold">Configuração (mascarada)</h2>
            {Object.keys(i.maskedConfig).length ? <dl>{Object.entries(i.maskedConfig).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt className="text-fg-muted">{k}</dt><dd className="font-mono">{v}</dd></div>)}</dl> : <p className="text-fg-muted">Nada configurado. Chaves ficam só no servidor (nunca no navegador).</p>}
            <p className="text-fg-muted">Última sincronização: {i.lastSync ? formatInstant(i.lastSync) : "—"}</p>
            {provider === "evolution" && (
              <div className="space-y-2 border-t border-line pt-3">
                <h3 className="font-medium" data-tour="conexao-whatsapp">Conexão WhatsApp (simulação)</h3>
                <div aria-label="QR de exemplo, não funcional" role="img" className="grid size-32 grid-cols-8 gap-0.5 rounded bg-white p-2">{Array.from({ length: 64 }, (_, k) => <span key={k} className={(k * 7) % 3 === 0 || k % 9 === 0 ? "bg-black" : "bg-white"} />)}</div>
                <p className="text-xs text-fg-muted">QR de exemplo, não funcional. Transporte (Baileys/WhatsApp Web × Cloud API) a confirmar com a instância existente.</p>
                <p>Fila de saída: <strong className="num">{pending.length}</strong> mensagem(ns) pendente(s)</p>
                <div className="flex flex-wrap gap-2">
                  {i.status === "operacional" ? <button className="btn btn-danger min-h-9" onClick={() => act.run((ctx) => messagingService.setConnection("desconectado", ctx), "WhatsApp desconectado (simulação). Novas respostas ficam na fila.")}><Unplug aria-hidden className="size-4" /> Simular desconexão</button>
                    : <button className="btn btn-primary min-h-9" onClick={async () => { if (await act.run((ctx) => messagingService.setConnection("operacional", ctx))) await act.run((ctx) => messagingService.flush(ctx), (n) => `Reconectado. ${n} mensagem(ns) reenviada(s), sem duplicar.`); }}><PlugZap aria-hidden className="size-4" /> Simular reconexão</button>}
                  <button className="btn btn-ghost min-h-9" disabled={i.status !== "operacional" || !pending.length} onClick={() => act.run((ctx) => messagingService.flush(ctx), (n) => `${n} reenviada(s).`)}><RefreshCw aria-hidden className="size-4" /> Reprocessar fila</button>
                </div>
              </div>
            )}
            {provider !== "evolution" && <button className="btn btn-secondary min-h-9" onClick={() => act.run((ctx) => createRow("integrationEvents", { provider, correlationId: `corr-${crypto.randomUUID().slice(0, 6)}`, type: "connection.test", attempt: 1, at: new Date().toISOString(), status: "sucesso", detail: "Teste simulado: nenhuma chamada externa realizada" }, ctx, "Teste de conexão simulado"), "Teste simulado registrado no log.")}>Testar (simulado)</button>}
            <Feedback error={act.error} notice={act.notice} />
          </section>
        </div>
        <section className="panel mt-5 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Eventos recentes</h2>
          {evs.length ? <ul className="space-y-1 font-mono text-xs">{evs.map((e) => <li key={e.id}>{e.at.slice(0, 19).replace("T", " ")} · {e.type} · tentativa {e.attempt} · {e.status}{isAdmin ? ` · ${e.correlationId}` : ""} · {e.detail}</li>)}</ul> : <p className="text-fg-muted">Sem eventos.</p>}
        </section>
      </div>
    </Guard>
  );
}
