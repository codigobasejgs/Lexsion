// Validação de quotas por plano (Onda 2).
import type { Tenant, TenantUsage, PlanId } from "@/domain/tenancy";
import { PLAN_QUOTAS } from "@/domain/tenancy";

export function checkQuota(tenant: Tenant, usage: TenantUsage, resource: keyof TenantUsage): { allowed: boolean; reason?: string } {
  const quota = PLAN_QUOTAS[tenant.plan][resource];
  const current = usage[resource];

  if (current >= quota) {
    return {
      allowed: false,
      reason: `Limite do plano ${tenant.plan} atingido: ${current}/${quota} ${resource}. Atualize seu plano para continuar.`,
    };
  }

  return { allowed: true };
}

export function quotaWarning(tenant: Tenant, usage: TenantUsage, resource: keyof TenantUsage): string | null {
  const quota = PLAN_QUOTAS[tenant.plan][resource];
  const current = usage[resource];
  const percent = (current / quota) * 100;

  if (percent >= 80 && percent < 100) {
    return `Você está usando ${current} de ${quota} ${resource} disponíveis (${percent.toFixed(0)}%).`;
  }

  return null;
}
