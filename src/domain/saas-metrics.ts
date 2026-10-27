// Métricas SaaS derivadas (puras, testáveis). Só faturas da PLATAFORMA; honorários de escritório nunca entram.
import { DEMO_TODAY } from "@/mocks/clock";
import { monthlyValue, type PlanId, type Tenant, type TenantStatus } from "./tenancy";
import type { SaasInvoice } from "./saas";

export function saasMetrics(tenants: Tenant[], invoices: SaasInvoice[], today = DEMO_TODAY) {
  const live = tenants.filter((t) => t.status !== "removida");
  const mrr = live.reduce((s, t) => s + monthlyValue(t), 0);
  const paying = live.filter((t) => monthlyValue(t) > 0).length;
  const byStatus: Partial<Record<TenantStatus, number>> = {};
  const byPlan: Partial<Record<PlanId, number>> = {};
  for (const t of live) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPlan[t.plan] = (byPlan[t.plan] ?? 0) + 1;
  }
  const soon = new Date(`${today}T00:00:00-03:00`).getTime() + 7 * 86_400_000;
  const platformInv = invoices.filter((i) => i.billingAccountOwner === "platform");
  const open = platformInv.filter((i) => i.status === "pendente" || i.status === "vencida" || i.status === "falhou");
  return {
    mrr, arr: mrr * 12, arpa: paying ? Math.round(mrr / paying) : 0, total: live.length,
    churnPct: live.length ? ((byStatus.cancelada ?? 0) / live.length) * 100 : 0,
    byStatus, byPlan,
    trialEndingSoon: live.filter((t) => t.status === "trial" && t.trialEndsAt && new Date(t.trialEndsAt).getTime() <= soon).length,
    openInvoices: open.reduce((s, i) => s + i.amount, 0),
    overdueCount: open.filter((i) => i.due < today).length,
  };
}
