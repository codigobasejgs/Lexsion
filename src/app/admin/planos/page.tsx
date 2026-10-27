"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/providers";
import { PageHeader } from "@/components/ui";
import { readAll, writeMany } from "@/services/mock/db";
import { auditRow } from "@/services/mock/generic";
import { formatBRL, parseBRL } from "@/lib/money";
import { UNLIMITED, QUOTA_LABEL, type BillingCycle, type PlanQuotas } from "@/domain/tenancy";
import { prorata, type PlanConfig } from "@/domain/saas";

const CYCLES: BillingCycle[] = ["mensal", "trimestral", "anual"];

export default function PlanosPage() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => readAll("plans") });
  return (
    <>
      <PageHeader title="Planos e assinaturas" description="Preços, limites e períodos de teste DEMONSTRATIVOS. Não são valores publicados; edite antes da oferta real." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">{plans.data?.map((p) => <PlanCard key={p.id} plan={p} />)}</div>
      <Prorata plans={plans.data ?? []} />
    </>
  );
}

function PlanCard({ plan }: { plan: PlanConfig }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [prices, setPrices] = useState(() => Object.fromEntries(CYCLES.map((c) => [c, (plan.prices[c] / 100).toFixed(2).replace(".", ",")])) as Record<BillingCycle, string>);
  const [trial, setTrial] = useState(plan.trialDays);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    const parsed = CYCLES.map((c) => parseBRL(prices[c]));
    if (parsed.some((v) => v === null || v < 0)) return setMsg({ ok: false, text: "Preço inválido. Use o formato 149,00." });
    const all = await readAll("plans");
    const next: PlanConfig = { ...plan, prices: Object.fromEntries(CYCLES.map((c, i) => [c, parsed[i]!])) as Record<BillingCycle, number>, trialDays: trial };
    await writeMany({ plans: all.map((p) => (p.id === plan.id ? next : p)), audit: [...(await readAll("audit")), auditRow({ organizationId: "platform", actorId: user!.id }, "plan.updated", "Plan", plan.id, "Preços/teste do plano alterados")] });
    await qc.invalidateQueries({ queryKey: ["plans"] });
    setMsg({ ok: true, text: "Plano salvo (demonstração)." });
  };
  return (
    <section className="panel space-y-3 p-5" aria-labelledby={`pl-${plan.id}`}>
      <h2 id={`pl-${plan.id}`} className="text-lg font-semibold">{plan.label}</h2>
      <div className="grid grid-cols-3 gap-2">
        {CYCLES.map((c) => <label key={c} className="block"><span className="label capitalize">{c} (R$)</span><input className="field num" inputMode="decimal" value={prices[c]} onChange={(e) => setPrices({ ...prices, [c]: e.target.value })} /></label>)}
      </div>
      <label className="block"><span className="label">Período de teste</span><select className="field" value={trial} onChange={(e) => setTrial(Number(e.target.value) as PlanConfig["trialDays"])}>{[0, 7, 15, 30].map((d) => <option key={d} value={d}>{d ? `${d} dias` : "Sem teste"}</option>)}</select></label>
      <ul className="grid grid-cols-2 gap-x-3 text-sm text-fg-muted">
        {(Object.keys(plan.quotas) as (keyof PlanQuotas)[]).map((k) => <li key={k}>{plan.quotas[k] === UNLIMITED ? "Ilimitado" : plan.quotas[k]} {QUOTA_LABEL[k]}</li>)}
      </ul>
      <p className="text-sm">Módulos: {plan.modules.join(" · ")}</p>
      <p className="text-xs text-fg-muted">Marca própria: {plan.whiteLabel ? "sim" : "não"} · Domínio próprio: {plan.customDomain ? "sim (após DNS)" : "não"}</p>
      <div className="flex items-center gap-3"><button className="btn btn-secondary" onClick={save}>Salvar plano</button>{msg && <span role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}</div>
    </section>
  );
}

function Prorata({ plans }: { plans: PlanConfig[] }) {
  const [from, setFrom] = useState("essencial");
  const [to, setTo] = useState("profissional");
  const [days, setDays] = useState(15);
  const a = plans.find((p) => p.id === from);
  const b = plans.find((p) => p.id === to);
  const r = a && b ? prorata(a.prices.mensal, b.prices.mensal, days, 30) : null;
  return (
    <section className="panel mt-6 space-y-3 p-5" aria-labelledby="pr">
      <h2 id="pr" className="font-semibold">Simulação de troca de plano no meio do mês</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="label">Plano atual</span><select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="block"><span className="label">Novo plano</span><select className="field" value={to} onChange={(e) => setTo(e.target.value)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="block"><span className="label">Dias restantes (de 30)</span><input type="number" min={0} max={30} className="field" value={days} onChange={(e) => setDays(Math.max(0, Math.min(30, Number(e.target.value))))} /></label>
      </div>
      {r && <p className="text-sm" data-testid="prorata">Crédito do plano atual: <strong>{formatBRL(r.credit)}</strong> · Novo plano proporcional: <strong>{formatBRL(r.charge)}</strong> · {r.difference >= 0 ? "Escritório paga" : "Crédito ao escritório"}: <strong>{formatBRL(Math.abs(r.difference))}</strong> <span className="text-fg-muted">(simulação, sem cobrança)</span></p>}
    </section>
  );
}
