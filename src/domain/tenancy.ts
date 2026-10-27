// Domínio multi-tenant: isolamento, branding, quotas (seção 2 do prompt master SaaS).
import type { ID } from "./types";

export type TenantStatus = "ativa" | "trial" | "suspensa" | "removida";
export type PlanId = "trial" | "essencial" | "profissional" | "avancado" | "enterprise";
export type BillingCycle = "mensal" | "trimestral" | "semestral" | "anual";

export interface Tenant {
  id: ID;
  slug: string; // URL-safe, único: aurora-advocacia, atlas-juridico
  name: string;
  status: TenantStatus;
  plan: PlanId;
  cycle: BillingCycle;
  trialEndsAt?: string; // ISO8601
  createdAt: string;
  suspendedAt?: string;
  suspensionReason?: string;
  customDomain?: string; // aurora.adv.br (não implementado na demo)
  settings: TenantBranding;
}

export interface TenantBranding {
  logo?: string; // data: URI ou /uploads/<tenant>/<hash>.png
  primaryColor: string; // #d6ae62
  accentColor: string; // #f1d397
  template: "executivo" | "classico" | "minimal" | "moderno" | "personalizado";
  density: "compacta" | "confortavel" | "espaçosa";
  textSize: "padrao" | "grande" | "extra-grande";
  reducedMotion?: boolean;
  simpleLanguage?: boolean;
}

export interface PlanQuotas {
  members: number; // Trial 2, Essencial 3, Prof 10, Avanç 25, Ent ilimitado
  clients: number; // Trial 10, Ess 50, Prof 200, Avanç 1000, Ent ilim
  storage: number; // MB: Trial 100, Ess 500, Prof 2000, Avanç 10000, Ent ilim
  aiMessages: number; // Trial 50, Ess 200, Prof 1000, Avanç 5000, Ent ilim
  automations: number; // Trial 0, Ess 3, Prof 10, Avanç 50, Ent ilim
}

export const PLAN_QUOTAS: Record<PlanId, PlanQuotas> = {
  trial: { members: 2, clients: 10, storage: 100, aiMessages: 50, automations: 0 },
  essencial: { members: 3, clients: 50, storage: 500, aiMessages: 200, automations: 3 },
  profissional: { members: 10, clients: 200, storage: 2000, aiMessages: 1000, automations: 10 },
  avancado: { members: 25, clients: 1000, storage: 10000, aiMessages: 5000, automations: 50 },
  enterprise: { members: 999, clients: 99999, storage: 999999, aiMessages: 99999, automations: 999 },
};

export const PLAN_PRICES: Record<PlanId, Record<BillingCycle, number>> = {
  trial: { mensal: 0, trimestral: 0, semestral: 0, anual: 0 },
  essencial: { mensal: 14900, trimestral: 39900, semestral: 74900, anual: 139900 }, // cents
  profissional: { mensal: 39900, trimestral: 107700, semestral: 203400, anual: 383400 },
  avancado: { mensal: 79900, trimestral: 215700, semestral: 407400, anual: 767400 },
  enterprise: { mensal: 0, trimestral: 0, semestral: 0, anual: 0 }, // contrato customizado
};

export const PLAN_LABEL: Record<PlanId, string> = {
  trial: "Trial",
  essencial: "Essencial",
  profissional: "Profissional",
  avancado: "Avançado",
  enterprise: "Enterprise",
};

// ponytail: TenantContext pode vir de cookie/header criptografado (JWT) quando houver backend; agora é resolução client-side.
export interface TenantContext {
  tenantId: ID;
  slug: string;
  isSuperAdmin?: boolean; // contexto especial para /admin
}

export interface TenantUsage {
  members: number;
  clients: number;
  storage: number; // MB aproximado
  aiMessages: number; // mês corrente
  automations: number;
}
