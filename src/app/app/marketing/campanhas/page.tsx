"use client";

import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { MarketingNav } from "@/modules/marketing/subnav";
import { updateRow } from "@/services/mock/generic";
import { canApprove } from "@/domain/permissions";
import { pct, ratio } from "@/domain/metrics";
import { formatBRL } from "@/lib/money";
import { formatCivil } from "@/lib/dates";
import type { Campaign } from "@/domain/types";

/** Métricas por coorte = leads cuja PRIMEIRA origem é a campanha (first touch). Gasto ausente/zero ⇒ não calculável. */
export default function CampanhasPage() {
  const { user } = useSession();
  const camps = useCollection("campaigns");
  const leads = useCollection("leads");
  const contracts = useCollection("contracts");
  const pays = useCollection("payments");
  const insts = useCollection("installments");
  const act = useAction("campaigns");

  const metrics = useMemo(() => (camps.data ?? []).map((c) => {
    const cohort = (leads.data ?? []).filter((l) => l.firstTouch.utm?.utm_campaign === c.utmCampaign);
    const qualified = cohort.filter((l) => ["triagem", "documentos", "analise", "proposta", "assinatura", "contratado"].includes(l.stage)).length;
    const signed = cohort.filter((l) => l.stage === "contratado").length;
    const clientIds = new Set(cohort.map((l) => l.clientId).filter(Boolean));
    const contractIds = new Set((contracts.data ?? []).filter((k) => clientIds.has(k.clientId)).map((k) => k.id));
    const revenue = (pays.data ?? []).filter((p) => contractIds.has(insts.data?.find((i) => i.id === p.installmentId)?.contractId ?? "")).reduce((s, p) => s + p.amount, 0);
    const spent = c.spent;
    return {
      c, leads: cohort.length, qualified, signed, lost: cohort.filter((l) => l.stage === "perdido").length, revenue,
      cpl: spent && cohort.length ? ratio(spent, cohort.length) : null, cac: spent && signed ? ratio(spent, signed) : null,
      roi: spent ? ratio(revenue - spent, spent) : null,
    };
  }), [camps.data, leads.data, contracts.data, pays.data, insts.data]);

  return (
    <Guard area="marketing">
      <div className="mx-auto max-w-[1300px]">
        <PageHeader title="Marketing" description="Planejamento e mensuração. Publicação e investimento dependem de aprovação humana e integração futura." />
        <MarketingNav />
        <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning"><ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> Nunca enviar CNIS, laudos, CPF, conteúdo de caso ou dados de saúde para pixels e audiências. Revisão de publicidade jurídica (OAB) é etapa obrigatória.</p>
        <Feedback error={act.error} />
        {camps.isPending ? <LoadingBlock /> : !metrics.length ? <EmptyState title="Sem campanhas" text="" /> : (
          <div className="space-y-3">
            {metrics.map((m) => (
              <article key={m.c.id} className="panel p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="flex-1 font-semibold">{m.c.name}</h2>
                  <Badge icon={false}>{m.c.platform}</Badge>
                  <Badge tone={m.c.status === "aprovada" ? "success" : m.c.status === "em_revisao" ? "warning" : "neutral"}>{m.c.status === "em_revisao" ? "Em revisão (OAB)" : m.c.status}</Badge>
                  {m.c.status === "em_revisao" && user && canApprove(user.role) && <button className="btn btn-secondary min-h-9" onClick={() => act.run((ctx) => updateRow("campaigns", m.c.id, ctx, (x: Campaign) => ({ ...x, status: "aprovada" }), "Campanha aprovada"))}>Aprovar revisão</button>}
                </div>
                <p className="text-fg-muted">{m.c.service} · {formatCivil(m.c.start)}–{formatCivil(m.c.end)} · orçamento {formatBRL(m.c.budget)} · gasto {m.c.spent === null ? "não informado" : formatBRL(m.c.spent)} · utm_campaign={m.c.utmCampaign}</p>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  {[["Leads", m.leads], ["Qualificados", m.qualified], ["Contratados", m.signed], ["Perdidos", m.lost], ["Conversão", pct(m.signed, m.leads)], ["CPL", m.cpl === null ? "não calculável" : formatBRL(Math.round(m.cpl))], ["CAC", m.cac === null ? "não calculável" : formatBRL(Math.round(m.cac))], ["Retorno", m.roi === null ? "não calculável" : `${(m.roi * 100).toFixed(0)}%`]].map(([k, v]) => (
                    <div key={String(k)}><dt className="text-xs text-fg-muted">{k}</dt><dd className="num font-semibold">{v}</dd></div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-fg-muted">Coorte: leads com primeiro contato nesta campanha. Receita atribuída: recebimentos efetivos de contratos desses clientes. Retorno = (receita − gasto) ÷ gasto.</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </Guard>
  );
}
