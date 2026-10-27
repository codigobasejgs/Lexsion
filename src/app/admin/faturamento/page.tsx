"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/providers";
import { Badge, PageHeader } from "@/components/ui";
import { readAll, writeMany } from "@/services/mock/db";
import { auditRow } from "@/services/mock/generic";
import { formatBRL } from "@/lib/money";
import { formatCivil, formatInstant } from "@/lib/dates";
import { applyInvoiceEvent, INTEGRATION_STATUS_LABEL, INVOICE_STATUS_LABEL, type SaasInvoice } from "@/domain/saas";
import { PLAN_LABEL } from "@/domain/tenancy";

type Ev = Parameters<typeof applyInvoiceEvent>[1]["type"];

export default function FaturamentoPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ["saasInvoices"], queryFn: async () => ({ inv: await readAll("saasInvoices"), tenants: await readAll("tenants"), providers: await readAll("platformProviders") }) });
  const [log, setLog] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<Record<string, string>>({});
  const name = (id: string) => data.data?.tenants.find((t) => t.id === id)?.name ?? id;

  // Simula o webhook do provedor. Mesmo id de evento enviado duas vezes NÃO altera a fatura duas vezes.
  const send = async (inv: SaasInvoice, type: Ev, repeat = false) => {
    const id = repeat && lastEvent[inv.id] ? lastEvent[inv.id] : `evt-${crypto.randomUUID().slice(0, 8)}`;
    const all = await readAll("saasInvoices");
    const cur = all.find((i) => i.id === inv.id)!;
    const next = applyInvoiceEvent(cur, { id, type, at: new Date().toISOString() });
    if (!next) return setLog(`Evento ${id} ignorado: já processado ou transição não permitida (${INVOICE_STATUS_LABEL[cur.status]}).`);
    await writeMany({ saasInvoices: all.map((i) => (i.id === inv.id ? next : i)), audit: [...(await readAll("audit")), auditRow({ organizationId: "platform", actorId: user!.id }, "saas_invoice.event", "SaasInvoice", inv.id, `${type} (${id})`)] });
    setLastEvent({ ...lastEvent, [inv.id]: id });
    setLog(`Evento simulado ${id} aplicado: ${INVOICE_STATUS_LABEL[next.status]}. Nenhuma comunicação com provedor real.`);
    await qc.invalidateQueries({ queryKey: ["saasInvoices"] });
    await qc.invalidateQueries({ queryKey: ["admin-metrics"] });
  };

  return (
    <>
      <PageHeader title="Financeiro da plataforma" description="Faturas da assinatura LexSion cobradas dos escritórios. Separado dos honorários que cada escritório cobra dos clientes dele." />
      <div aria-live="polite">{log && <p role="status" className="mb-4 rounded border border-info/30 bg-info-bg p-3 text-sm text-info" data-testid="webhook-log">{log}</p>}</div>
      <section className="panel mb-6 overflow-x-auto" tabIndex={0} aria-label="Faturas SaaS (role horizontalmente)" data-tour="sa-faturas">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Faturas da plataforma</caption>
          <thead><tr className="text-left text-xs text-fg-muted"><th className="p-3">Escritório</th><th>Plano</th><th>Período</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th className="p-3">Simular evento do provedor</th></tr></thead>
          <tbody>
            {data.data?.inv.map((i) => (
              <tr key={i.id} className="border-t border-line" data-testid={`fatura-${i.id}`}>
                <td className="p-3">{name(i.organizationId)}</td>
                <td>{PLAN_LABEL[i.plan]} ({i.cycle})</td>
                <td className="num">{formatCivil(i.periodStart)} – {formatCivil(i.periodEnd)}</td>
                <td className="num">{formatCivil(i.due)}</td>
                <td className="num">{formatBRL(i.amount)}</td>
                <td><Badge tone={i.status === "paga" ? "success" : i.status === "pendente" ? "info" : "warning"}>{INVOICE_STATUS_LABEL[i.status]}</Badge>{i.paidAt && <span className="block text-xs text-fg-muted">{formatInstant(i.paidAt)}</span>}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <button className="btn btn-ghost min-h-9" onClick={() => send(i, "pagamento_confirmado")}>Pagamento confirmado</button>
                    <button className="btn btn-ghost min-h-9" onClick={() => send(i, "pagamento_falhou")}>Falha</button>
                    <button className="btn btn-ghost min-h-9" onClick={() => send(i, "estorno")}>Estorno</button>
                    <button className="btn btn-ghost min-h-9" disabled={!lastEvent[i.id]} onClick={() => send(i, "pagamento_confirmado", true)}>Reenviar último evento</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <h2 className="mb-3 text-lg font-semibold">Provedores de cobrança da plataforma</h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
        {data.data?.providers.map((p) => (
          <section key={p.id} className="panel space-y-2 p-4 text-sm" aria-labelledby={`pv-${p.id}`}>
            <div className="flex items-center gap-2"><h3 id={`pv-${p.id}`} className="flex-1 font-semibold">{p.name}</h3><Badge tone="neutral">{INTEGRATION_STATUS_LABEL[p.status]}</Badge></div>
            <ul className="text-fg-muted">{Object.entries(p.methods).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
            <p className="text-xs text-fg-muted">{p.notes}</p>
            <p className="text-xs">Ambiente: sandbox · Credenciais: <strong>não configuradas</strong> (ficarão só no servidor).</p>
          </section>
        ))}
      </div>
    </>
  );
}
