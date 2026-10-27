// Repositório mock de escritórios (tenants), persistido no IndexedDB da demo (coleção "tenants").
// Mesma interface que um SupabaseTenantRepository futuro; sem backend, nada aqui é autorização real.
import type { Tenant, TenantUsage, PlanId, BillingCycle } from "@/domain/tenancy";
import type { Result } from "../contracts";
import { readAll, writeMany } from "./db";
import { auditRow, fail, ok } from "./generic";

const RESERVED = new Set(["admin", "app", "api", "www", "portal", "demo", "lexsion", "suporte", "status", "entrar"]);
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function slugError(slug: string, taken: string[]): string | null {
  if (!SLUG_RE.test(slug)) return "Use 3 a 40 letras minúsculas, números ou hífen (sem hífen no início/fim).";
  if (RESERVED.has(slug)) return "Endereço reservado pela plataforma.";
  if (taken.includes(slug)) return "Endereço já em uso por outro escritório.";
  return null;
}

const PLATFORM = { organizationId: "platform", actorId: "u-super" };

async function save(next: Tenant[], action: string, id: string, detail: string, actorId = PLATFORM.actorId) {
  const audit = await readAll("audit");
  await writeMany({ tenants: next, audit: [...audit, auditRow({ organizationId: "platform", actorId }, action, "Tenant", id, detail)] });
}

export const tenantRepo = {
  list: async (): Promise<Tenant[]> => readAll("tenants"),
  getById: async (id: string): Promise<Tenant | null> => (await readAll("tenants")).find((t) => t.id === id) ?? null,
  getBySlug: async (slug: string): Promise<Tenant | null> => (await readAll("tenants")).find((t) => t.slug === slug) ?? null,

  create: async (input: Omit<Tenant, "id" | "createdAt">, actorId?: string): Promise<Result<Tenant>> => {
    const all = await readAll("tenants");
    const err = slugError(input.slug, all.map((t) => t.slug));
    if (err) return fail("slug_invalido", err);
    const tenant: Tenant = { ...input, id: `org-${input.slug}`, createdAt: new Date().toISOString() };
    if (all.some((t) => t.id === tenant.id)) return fail("duplicado", "Escritório já existe.");
    const orgs = await readAll("organizations");
    await writeMany({ organizations: [...orgs, { id: tenant.id, name: tenant.name, city: "—", focus: "Geral" }] });
    await save([...all, tenant], "tenant.created", tenant.id, `Escritório criado (${tenant.plan})`, actorId);
    return ok(tenant);
  },

  update: async (id: string, patch: Partial<Omit<Tenant, "id" | "slug" | "createdAt">>, actorId?: string, detail = "Escritório atualizado"): Promise<Result<Tenant>> => {
    const all = await readAll("tenants");
    const cur = all.find((t) => t.id === id);
    if (!cur) return fail("not_found", "Escritório não encontrado.");
    const next = { ...cur, ...patch };
    await save(all.map((t) => (t.id === id ? next : t)), "tenant.updated", id, detail, actorId);
    return ok(next);
  },

  suspend: (id: string, reason: string, actorId?: string) =>
    reason.trim() ? tenantRepo.update(id, { status: "suspensa", suspendedAt: new Date().toISOString(), suspensionReason: reason.trim() }, actorId, `Suspenso: ${reason.trim()}`) : Promise.resolve(fail("motivo", "Informe o motivo da suspensão.")),
  reactivate: (id: string, actorId?: string) => tenantRepo.update(id, { status: "ativa", suspendedAt: undefined, suspensionReason: undefined }, actorId, "Reativado"),
  changePlan: (id: string, plan: PlanId, cycle: BillingCycle, actorId?: string) => tenantRepo.update(id, { plan, cycle }, actorId, `Plano: ${plan}/${cycle}`),

  /** Consumo REAL contado nas coleções da demo (não números fixos). */
  getUsage: async (id: string): Promise<TenantUsage> => {
    const [users, clients, automations, files] = await Promise.all([readAll("users"), readAll("clients"), readAll("automations"), readAll("files")]);
    const sizes = (files as { organizationId: string; size?: number }[]).filter((f) => f.organizationId === id).reduce((s, f) => s + (f.size ?? 0), 0);
    return {
      members: users.filter((u) => u.organizationId === id && u.role !== "cliente").length,
      clients: clients.filter((c) => c.organizationId === id).length,
      storage: Math.round(sizes / 1024 / 1024),
      aiMessages: 0,
      automations: automations.filter((a) => a.organizationId === id).length,
    };
  },
};
