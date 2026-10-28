"use client";

// Sessão REAL (Supabase Auth + vínculos do banco). Nenhum dado fictício: fixtures só entram na /demonstracao.
import { supabaseBrowser } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/env";
import { setRealBackend } from "@/services/mock/db";
import { configureReal, realRead, realWrite } from "@/services/real/backend";
import { switchToDemoClock, switchToRealClock } from "@/mocks/clock";
import { DEFAULT_BRANDING, type Tenant, type TenantStatus } from "@/domain/tenancy";
import type { Organization, Role, User } from "@/domain/types";
import { setPeople } from "./people";

type Access = {
  name: string | null;
  platform: Role | null;
  memberships: { organizationId: string; name: string; slug: string; status: TenantStatus; role: Role }[];
  portal: { organizationId: string; name: string; slug: string; status: TenantStatus; clientId: string }[];
};
export interface RealSession { user: User; org: Organization | null; tenant: Tenant | null; orgs: Organization[]; team: User[] }

const ORG_PREF = "lexsion.org";
export const preferOrg = (id: string) => { try { localStorage.setItem(ORG_PREF, id); } catch {} };

/** Lê a sessão real; falha de rede é tentada de novo (até 3x, 1 s e 3 s) antes de mostrar "Sem conexão". */
export async function loadRealSession(): Promise<RealSession | null> {
  for (const wait of [1000, 3000]) {
    try { return await loadOnce(); } catch { await new Promise((r) => setTimeout(r, wait)); }
  }
  return loadOnce();
}

/** Lê a sessão do Supabase e os vínculos REAIS. null = ninguém autenticado (ou backend não configurado). */
async function loadOnce(): Promise<RealSession | null> {
  if (!supabaseConfigured()) return null;
  const sb = supabaseBrowser();
  // Sem cookie de sessão: ninguém entrou (não consulta a rede).
  if (!document.cookie.split("; ").some((c) => c.startsWith("sb-"))) return null;
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr && (authErr.status === undefined || authErr.status === 0 || authErr.status >= 500)) throw new Error("offline");
  if (!auth.user) return null;
  const { data, error } = await sb.rpc("my_access");
  if (error) throw new Error("offline"); // falha de rede/serviço NUNCA cai na demonstração
  if (!data) return null;
  const a = data as Access;
  const name = a.name ?? auth.user.email?.split("@")[0] ?? "Usuário";
  let pref: string | null = null;
  try { pref = localStorage.getItem(ORG_PREF); } catch {}
  const toOrg = (m: { organizationId: string; name: string }): Organization => ({ id: m.organizationId, name: m.name, city: "—", focus: "" });
  const stub = (m: { organizationId: string; name: string; slug: string; status: TenantStatus }): Tenant => ({
    id: m.organizationId, slug: m.slug, name: m.name, status: m.status, plan: "trial", cycle: "mensal", createdAt: "", settings: { ...DEFAULT_BRANDING, brandName: m.name },
  });

  let s: RealSession;
  if (a.platform) {
    s = { user: { id: auth.user.id, name, role: a.platform, organizationId: null }, org: null, tenant: null, orgs: [], team: [] };
    configureReal({ userId: auth.user.id, organizationId: null, platform: true });
  } else if (a.memberships.length) {
    const m = a.memberships.find((x) => x.organizationId === pref) ?? a.memberships.find((x) => x.status === "ativa" || x.status === "trial") ?? a.memberships[0];
    s = { user: { id: auth.user.id, name, role: m.role, organizationId: m.organizationId }, org: toOrg(m), tenant: stub(m), orgs: a.memberships.map(toOrg), team: [] };
    configureReal({ userId: auth.user.id, organizationId: m.organizationId, platform: false });
  } else if (a.portal.length) {
    const p = a.portal[0];
    s = { user: { id: auth.user.id, name, role: "cliente", organizationId: p.organizationId, clientId: p.clientId }, org: toOrg(p), tenant: stub(p), orgs: [toOrg(p)], team: [] };
    configureReal({ userId: auth.user.id, organizationId: p.organizationId, platform: false, portal: true });
  } else return null;

  activateReal(s);
  if (s.org && (s.tenant?.status === "ativa" || s.tenant?.status === "trial")) {
    // Marca e nome reais do escritório (RLS: só membros/cliente do próprio escritório leem).
    const t = ((await realRead("tenants").catch(() => [])) as Tenant[]).find((x) => x.id === s.org!.id);
    if (t) s.tenant = t;
    if (s.user.role !== "cliente") s.team = (await realRead("users").catch(() => [])) as User[];
  }
  if (!s.team.some((u) => u.id === s.user.id)) s.team.push(s.user);
  setPeople(s.team);
  return s;
}

/** Liga o armazenamento real (idempotente). configureReal já fixou usuário e escritório da sessão. */
export function activateReal(s: RealSession) {
  setRealBackend({ read: realRead, write: realWrite });
  switchToRealClock();
  setPeople(s.team);
}

/** Volta ao armazenamento local da demonstração (idempotente). */
export function leaveRealMode() {
  setRealBackend(null);
  switchToDemoClock();
  setPeople(null);
}

export async function realSignOut() {
  await (await import("@/app/entrar/actions")).signOutAction().catch(() => null);
  await supabaseBrowser().auth.signOut().catch(() => null);
}
