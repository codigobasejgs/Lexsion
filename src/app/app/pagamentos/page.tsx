"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { FinanceNav } from "@/modules/finance/subnav";
import { CHARGE_STATUS } from "@/modules/commercial/labels";
import { chargeService } from "@/services/mock/ops-repo";
import { formatBRL } from "@/lib/money";
import { formatCivil } from "@/lib/dates";
import type { Charge } from "@/domain/types";

const PROVIDERS: { key: Charge["provider"]; name: string; role: string }[] = [
  { key: "asaas", name: "Asaas", role: "Candidato inicial para cobranças do escritório" },
  { key: "infinitepay", name: "InfinitePay", role: "Checkout/link de pagamento" },
  { key: "mercadopago", name: "Mercado Pago", role: "Alternativa" },
];

export default function PagamentosPage() {
  const charges = useCollection("charges");
  const insts = useCollection("installments");
  const clients = useCollection("clients");
  const ints = useCollection("integrations");
  const act = useAction("charges", "payments", "installments", "integrationEvents");
  const [inst, setInst] = useState("");
  const [provider, setProvider] = useState<Charge["provider"]>("asaas");
  const [method, setMethod] = useState<Charge["method"]>("pix");
  const key = useRef(crypto.randomUUID());
  const open = (insts.data ?? []).filter((i) => i.status === "aberta" || i.status === "parcial");
  const label = (id: string) => { const i = insts.data?.find((x) => x.id === id); return `${i?.label ?? ""} — ${clients.data?.find((c) => c.id === i?.clientId)?.name ?? ""}`; };

  return (
    <Guard area="pagamentos">
      <div className="mx-auto min-w-0 max-w-[1200px]">
        <PageHeader title="Central de pagamentos" description="Cobranças de honorários do escritório. A assinatura SaaS da plataforma é outra conta e outra conciliação. Nenhuma cobrança real é criada." actions={<SimulatedBadge />} />
        <FinanceNav />
        <section className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
          {PROVIDERS.map((p) => {
            const conn = ints.data?.find((i) => i.provider === p.key);
            return (
              <article key={p.key} className="panel p-4 text-sm">
                <div className="flex items-center gap-2"><h2 className="flex-1 font-semibold">{p.name}</h2><Badge tone="neutral" icon={false}>{conn?.status ?? "planejado"}</Badge></div>
                <p className="text-fg-muted">{p.role}</p>
                <ul className="mt-2 space-y-0.5">{Object.entries(conn?.capabilities ?? {}).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className={v === "supported" ? "text-success" : v === "unsupported" ? "text-danger" : "text-warning"}>{v === "supported" ? "suportado" : v === "unsupported" ? "não suportado" : "a validar"}</span></li>)}</ul>
              </article>
            );
          })}
        </section>
        <p className="mb-6 text-sm text-fg-muted">Escolha comercial do provedor: pendente. Split/marketplace exige contrato e habilitação — não é promessa desta versão.</p>

        <section className="panel mb-6 space-y-3 p-4">
          <h2 className="font-semibold">Nova cobrança (simulada)</h2>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
            <label className="block"><span className="label">Parcela</span><select className="field" value={inst} onChange={(e) => { setInst(e.target.value); key.current = crypto.randomUUID(); }}><option value="">Escolha…</option>{open.map((i) => <option key={i.id} value={i.id}>{label(i.id)} · {formatBRL(i.amount - i.paid)}</option>)}</select></label>
            <label className="block"><span className="label">Provedor</span><select className="field" value={provider} onChange={(e) => setProvider(e.target.value as Charge["provider"])}>{PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
            <label className="block"><span className="label">Meio</span><select className="field" value={method} onChange={(e) => setMethod(e.target.value as Charge["method"])}><option value="pix">Pix</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="link">Link de pagamento</option></select></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={!inst || act.pending} onClick={() => act.run((ctx) => chargeService.create({ installmentId: inst, provider, method }, { ...ctx, idempotencyKey: key.current }), "Cobrança simulada criada.")}>Criar cobrança</button>
            <button className="btn btn-ghost" disabled={!inst} onClick={() => act.run((ctx) => chargeService.create({ installmentId: inst, provider, method }, { ...ctx, idempotencyKey: key.current }), "Reenvio com a mesma chave: nenhuma cobrança nova.")}>Reenviar (mesma chave)</button>
          </div>
          <Feedback error={act.error} notice={act.notice} />
        </section>

        {charges.isPending ? <LoadingBlock /> : !charges.data?.length ? <EmptyState title="Sem cobranças" text="Crie uma cobrança simulada acima." /> : (
          <ul className="space-y-3">
            {charges.data.map((c) => (
              <li key={c.id} className="panel p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 font-medium">{label(c.installmentId)}</span>
                  <span className="num">{formatBRL(c.amount)} · vence {formatCivil(c.due)}</span>
                  <Badge icon={false}>{c.provider} · {c.method}</Badge>
                  <Badge tone={CHARGE_STATUS[c.status].tone}>{CHARGE_STATUS[c.status].label}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-fg-muted [overflow-wrap:anywhere]">externalId {c.externalId} · link demonstrativo (não leva a pagamento real): {c.link}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {([["retorno_checkout", "Cliente voltou do checkout"], ["confirmar", "Confirmar pagamento"], ["confirmar_duplicado", "Confirmação duplicada"], ["expirar", "Expirar"], ["erro", "Erro"], ["estornar", "Estornar"], ["cancelar", "Cancelar"]] as const).map(([k, l]) => (
                    <button key={k} className="btn btn-ghost min-h-8 border border-line text-xs" onClick={() => act.run((ctx) => chargeService.simulate(c.id, k, ctx), (r) => r.note)}>{l}</button>
                  ))}
                </div>
                <details className="mt-2"><summary className="cursor-pointer text-fg-muted">Eventos ({c.events.length})</summary><ul className="mt-1 space-y-0.5 font-mono text-xs">{c.events.map((e) => <li key={e.id}>{e.at.slice(0, 19).replace("T", " ")} · {e.type}</li>)}</ul></details>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm"><Link className="underline underline-offset-2" href="/app/integracoes/eventos">Ver log de eventos de integração</Link></p>
      </div>
    </Guard>
  );
}
