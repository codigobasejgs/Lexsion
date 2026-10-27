// Cotas do plano no FRONTEND (orientação de uso). Limite real será validado no servidor (fase backend).
import { PLAN_LABEL, PLAN_QUOTAS, QUOTA_LABEL, UNLIMITED, type Tenant, type TenantUsage } from "./tenancy";

export function checkQuota(tenant: Tenant, usage: TenantUsage, resource: keyof TenantUsage): { allowed: boolean; reason?: string } {
  if (tenant.status === "suspensa" || tenant.status === "cancelada") return { allowed: false, reason: "Escritório suspenso: cadastros bloqueados até a reativação." };
  const quota = PLAN_QUOTAS[tenant.plan][resource];
  if (usage[resource] < quota) return { allowed: true };
  return { allowed: false, reason: `Limite do plano ${PLAN_LABEL[tenant.plan]} atingido: ${usage[resource]} de ${quota} ${QUOTA_LABEL[resource]}. Peça ao responsável pelo escritório a troca de plano.` };
}

/** Aviso a partir de 80% de uso; null abaixo disso ou em plano ilimitado. */
export function quotaWarning(tenant: Tenant, usage: TenantUsage, resource: keyof TenantUsage): string | null {
  const quota = PLAN_QUOTAS[tenant.plan][resource];
  if (quota === UNLIMITED) return null;
  const pct = (usage[resource] / quota) * 100;
  return pct >= 80 && pct < 100 ? `Você está usando ${usage[resource]} de ${quota} ${QUOTA_LABEL[resource]} (${Math.round(pct)}%).` : null;
}
