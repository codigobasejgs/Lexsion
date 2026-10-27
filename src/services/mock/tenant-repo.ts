// Repositório mock de tenants (Onda 1 SaaS).
import type { Tenant, TenantUsage, PlanId, BillingCycle } from "@/domain/tenancy";
import type { Result } from "../contracts";
import { tenants } from "@/mocks/tenants";

const cid = () => crypto.randomUUID().slice(0, 8);
const ok = <T,>(data: T): Result<T> => ({ ok: true, data, correlationId: cid() });
const fail = (code: string, message: string): Result<never> => ({ ok: false, error: { code, message, retryable: false }, correlationId: cid() });

// Demo: tenants em memória; real usaria Supabase.
let state = structuredClone(tenants);

export const tenantRepo = {
  list: async (): Promise<Tenant[]> => structuredClone(state),

  getById: async (id: string): Promise<Tenant | null> => {
    const t = state.find(x => x.id === id);
    return t ? structuredClone(t) : null;
  },

  getBySlug: async (slug: string): Promise<Tenant | null> => {
    const t = state.find(x => x.slug === slug);
    return t ? structuredClone(t) : null;
  },

  getByDomain: async (domain: string): Promise<Tenant | null> => {
    const t = state.find(x => x.customDomain === domain);
    return t ? structuredClone(t) : null;
  },

  create: async (input: Omit<Tenant, "id" | "createdAt">): Promise<Result<Tenant>> => {
    if (state.some(t => t.slug === input.slug)) return fail("slug_taken", "Slug já em uso.");
    const tenant: Tenant = { ...input, id: `org-${cid()}`, createdAt: new Date().toISOString() };
    state = [...state, tenant];
    return ok(tenant);
  },

  update: async (id: string, patch: Partial<Omit<Tenant, "id" | "slug" | "createdAt">>): Promise<Result<Tenant>> => {
    const idx = state.findIndex(t => t.id === id);
    if (idx < 0) return fail("not_found", "Tenant não encontrado.");
    const updated = { ...state[idx], ...patch };
    state = [...state.slice(0, idx), updated, ...state.slice(idx + 1)];
    return ok(updated);
  },

  suspend: async (id: string, reason: string): Promise<Result<Tenant>> => {
    return tenantRepo.update(id, { status: "suspensa", suspendedAt: new Date().toISOString(), suspensionReason: reason });
  },

  reactivate: async (id: string): Promise<Result<Tenant>> => {
    return tenantRepo.update(id, { status: "ativa", suspendedAt: undefined, suspensionReason: undefined });
  },

  changePlan: async (id: string, plan: PlanId, cycle: BillingCycle): Promise<Result<Tenant>> => {
    return tenantRepo.update(id, { plan, cycle });
  },

  // Demo: usage mock derivado de fixtures; real consultaria agregações.
  getUsage: async (id: string): Promise<TenantUsage | null> => {
    const t = await tenantRepo.getById(id);
    if (!t) return null;
    // ponytail: valores hardcoded; integrar com contagens reais quando db.ts suportar tenant_id.
    if (id === "org-aurora") return { members: 6, clients: 12, storage: 42, aiMessages: 87, automations: 2 };
    if (id === "org-boreal") return { members: 1, clients: 3, storage: 8, aiMessages: 15, automations: 0 };
    if (id === "org-novo") return { members: 1, clients: 0, storage: 0, aiMessages: 3, automations: 0 };
    return { members: 0, clients: 0, storage: 0, aiMessages: 0, automations: 0 };
  },

  reset: () => { state = structuredClone(tenants); },
};
