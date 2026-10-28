// Domínio multi-tenant: escritórios (tenants), identidade visual, planos e cotas.
import type { ID } from "./types";

export type TenantStatus = "ativa" | "trial" | "suspensa" | "inadimplente" | "cancelada" | "removida";
export type PlanId = "trial" | "essencial" | "profissional" | "avancado" | "enterprise";
export type BillingCycle = "mensal" | "trimestral" | "anual";

/** Identidade visual do escritório (white-label). Persistida só no navegador nesta fase. */
export interface TenantBranding {
  brandName: string;
  pwaShortName: string; // ≤ 12 caracteres recomendado
  logoLight?: string; // data:image/png|jpeg|webp (raster validado) ou /tenants/<slug>/logo.svg (asset da demo)
  logoDark?: string;
  favicon?: string;
  pwaIcon192?: string;
  pwaIcon512?: string;
  pwaMaskableIcon?: string;
  primary: string; // #rrggbb
  secondary: string;
  accent: string;
  backgroundLight: string;
  backgroundDark: string;
  surface: string;
  text: string;
  themeMode: "dark" | "light" | "system";
  template: "executivo" | "classico" | "minimal" | "moderno" | "personalizado";
  density: "compacta" | "confortavel" | "espacosa";
  textSize: "padrao" | "grande" | "extra-grande";
  radius: "reto" | "suave" | "arredondado";
  reducedMotion?: boolean;
  simpleLanguage?: boolean;
  showPoweredBy: boolean; // "Tecnologia LexSion" discreto
  /** Operação: ícone publicado no bucket público "marcas" (manifesto PWA do escritório usa o ícone próprio). */
  hasPublicIcon?: boolean;
  brandingVersion: number;
}

export interface Tenant {
  id: ID; // = organizationId
  slug: string;
  name: string; // razão/nome fantasia
  hostname?: string; // subdomínio reservado (demo) — só funciona com DNS configurado
  status: TenantStatus;
  plan: PlanId;
  cycle: BillingCycle;
  trialEndsAt?: string;
  createdAt: string;
  suspendedAt?: string;
  suspensionReason?: string;
  ownerName?: string;
  ownerEmail?: string;
  document?: string; // CNPJ sintético
  modules?: string[];
  notes?: string;
  settings: TenantBranding;
}

export interface PlanQuotas {
  members: number;
  clients: number;
  storage: number; // MB
  aiMessages: number;
  automations: number;
}

export type TenantUsage = PlanQuotas;
export const QUOTA_LABEL: Record<keyof PlanQuotas, string> = { members: "membros da equipe", clients: "clientes", storage: "MB de arquivos", aiMessages: "mensagens de IA no mês", automations: "automações" };

export const UNLIMITED = Number.MAX_SAFE_INTEGER;
export const PLAN_QUOTAS: Record<PlanId, PlanQuotas> = {
  trial: { members: 3, clients: 25, storage: 200, aiMessages: 50, automations: 2 },
  essencial: { members: 3, clients: 150, storage: 2000, aiMessages: 200, automations: 3 },
  profissional: { members: 10, clients: 1000, storage: 10000, aiMessages: 1000, automations: 15 },
  avancado: { members: 25, clients: 5000, storage: 50000, aiMessages: 5000, automations: 50 },
  enterprise: { members: UNLIMITED, clients: UNLIMITED, storage: UNLIMITED, aiMessages: UNLIMITED, automations: UNLIMITED },
};

// Preços DEMONSTRATIVOS em centavos (não são preços publicados). Editáveis no Super Admin.
export const PLAN_PRICES: Record<PlanId, Record<BillingCycle, number>> = {
  trial: { mensal: 0, trimestral: 0, anual: 0 },
  essencial: { mensal: 14900, trimestral: 40200, anual: 149000 },
  profissional: { mensal: 39900, trimestral: 107700, anual: 399000 },
  avancado: { mensal: 79900, trimestral: 215700, anual: 799000 },
  enterprise: { mensal: 0, trimestral: 0, anual: 0 },
};

export const PLAN_LABEL: Record<PlanId, string> = { trial: "Trial", essencial: "Essencial", profissional: "Profissional", avancado: "Avançado", enterprise: "Enterprise" };
export const CYCLE_MONTHS: Record<BillingCycle, number> = { mensal: 1, trimestral: 3, anual: 12 };
export const STATUS_LABEL: Record<TenantStatus, string> = { ativa: "Ativa", trial: "Em teste", suspensa: "Suspensa", inadimplente: "Inadimplente", cancelada: "Cancelada", removida: "Removida" };

/** Receita mensal equivalente de um escritório (MRR), em centavos. Trial/Enterprise sem preço = 0. */
export function monthlyValue(t: Pick<Tenant, "plan" | "cycle" | "status">): number {
  if (t.status !== "ativa" && t.status !== "inadimplente") return 0;
  return Math.round(PLAN_PRICES[t.plan][t.cycle] / CYCLE_MONTHS[t.cycle]);
}

export const DEFAULT_BRANDING: TenantBranding = {
  brandName: "Meu escritório", pwaShortName: "Escritório",
  primary: "#1f4e79", secondary: "#2f6f9f", accent: "#b8862b",
  backgroundLight: "#f7f8fa", backgroundDark: "#0e1116", surface: "#ffffff", text: "#18202b",
  themeMode: "dark", template: "executivo", density: "confortavel", textSize: "padrao", radius: "suave",
  showPoweredBy: true, brandingVersion: 1,
};

export const HEX_RE = /^#[0-9a-f]{6}$/i;
/** Normaliza #RGB/#RRGGBB para #rrggbb minúsculo; null se inválido. */
export function normalizeHex(v: string): string | null {
  const s = v.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return HEX_RE.test(s) ? s : null;
}
