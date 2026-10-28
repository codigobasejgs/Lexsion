"use client";

// Armazenamento REAL do ERP (Supabase). Mesma interface do IndexedDB da demo (readAll/writeMany), para as telas não mudarem.
// Toda leitura/escrita usa a sessão do usuário: a RLS do Postgres decide o que ele vê e grava (o organizationId daqui não é autorização).
// Gravação em lote numa transação (apply_changes), com versão: quem editou dado desatualizado recebe conflito, nada é sobrescrito.
import { supabaseBrowser } from "@/lib/supabase/browser";
import { DEFAULT_BRANDING, type Tenant } from "@/domain/tenancy";
import type { AuditEvent, IntegrationConnection, OrgSettings, User } from "@/domain/types";
import * as ops from "@/mocks/fixtures-ops";
import * as platform from "@/mocks/platform";

// Mesmas coleções de public.collection_policies (coleção fora da lista é recusada pelo banco).
const ORG = new Set([
  "clients", "notifications", "settings", "integrations", "integrationEvents", "importBatches", "cases", "tasks", "events", "documents", "files",
  "deadlines", "publications", "processes", "caseEvents", "requisitions", "drafts", "templates", "legalSources", "pensionAnalyses", "calculations",
  "assessments", "leads", "conversations", "messages", "outbox", "objections", "campaigns", "landingPages", "contents", "agents", "agentRuns",
  "automations", "automationRuns", "proposals", "contracts", "installments", "payments", "charges", "expenses", "bankLines", "receipts",
]);
const PLATFORM = new Set(["plans", "saasInvoices", "supportTickets"]);
// ponytail: exclusão em massa por gravação genérica é recusada; reversão grande de importação vira operação de suporte.
const MASS_DELETE = 25;

type Row = Record<string, unknown> & { id: string };
type Snap = Map<string, { json: string; version: number | null }>;
const snaps = new Map<string, Snap>();
let org: string | null = null;
let uid: string | null = null;
let platformSession = false;
let portalSession = false;
let portalSnap: Promise<Record<string, unknown> | null> | null = null;

export function configureReal(s: { userId: string; organizationId: string | null; platform: boolean; portal?: boolean }) {
  uid = s.userId;
  org = s.organizationId;
  platformSession = s.platform;
  portalSession = !!s.portal;
  portalSnap = null;
  snaps.clear();
}

/** Visão do cliente no portal: só campos leigos e liberados (função portal_snapshot no banco). */
export function portalSnapshot(fresh = false) {
  if (fresh || !portalSnap) portalSnap = (async () => {
    const { data, error } = await supabaseBrowser().rpc("portal_snapshot");
    if (error) throw friendly(error);
    return data as Record<string, unknown> | null;
  })();
  return portalSnap;
}

/** Cliente envia arquivo a um pedido do escritório: Storage na pasta do pedido + registro pelo banco. */
export async function portalSendDocument(docId: string, file: File) {
  const sb = supabaseBrowser();
  const snap = await portalSnapshot();
  const orgId = (snap?.organization as { id: string } | undefined)?.id;
  if (!orgId) throw new SaveError("Acesso ao portal não encontrado.", "P0002");
  const path = `${orgId}/${docId}/${Date.now()}-${file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-100)}`;
  const up = await sb.storage.from("documentos").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw new SaveError("Não foi possível enviar o arquivo agora. Tente de novo.", "upload");
  const { error } = await sb.rpc("portal_send_document", { p_doc: docId, p_path: path, p_name: file.name.slice(0, 200), p_mime: file.type, p_size: file.size });
  if (error) throw friendly(error);
  portalSnap = null;
}

export async function portalAsk(text: string) {
  const { error } = await supabaseBrowser().rpc("portal_ask", { p_text: text });
  if (error) throw friendly(error);
}

export class SaveError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
function friendly(e: { code?: string; message?: string } | null): SaveError {
  const code = e?.code ?? "unknown";
  const msg = e?.message ?? "";
  if (code === "40001") return new SaveError("Este registro foi alterado por outra pessoa. Recarregue a página e tente de novo; nada foi sobrescrito.", code);
  if (/row-level security|permission denied/i.test(msg)) return new SaveError("Seu perfil não tem permissão para esta ação. Nada foi gravado.", "42501");
  if (["42501", "23514", "P0002", "22023"].includes(code) && msg) return new SaveError(msg.charAt(0).toUpperCase() + msg.slice(1) + ".", code);
  if (code === "23505") return new SaveError("Registro duplicado: já existe um igual.", code);
  return new SaveError("Não foi possível salvar agora (conexão ou serviço). Nada foi alterado; tente de novo.", code);
}

async function paged<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message?: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw friendly(error);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

function remember(name: string, rows: Row[], versions?: Map<string, number>) {
  snaps.set(name, new Map(rows.map((r) => [r.id, { json: JSON.stringify(r), version: versions?.get(r.id) ?? null }])));
  return rows;
}

type OrgRow = { id: string; slug: string; name: string; status: Tenant["status"]; plan: Tenant["plan"]; branding: Record<string, unknown>; meta: Record<string, unknown>; status_reason: string | null; created_at: string };
const toTenant = (o: OrgRow): Tenant => ({
  id: o.id, slug: o.slug, name: o.name, status: o.status, plan: o.plan, createdAt: o.created_at,
  cycle: (o.meta.cycle as Tenant["cycle"]) ?? "mensal", trialEndsAt: o.meta.trialEndsAt as string | undefined, suspendedAt: o.meta.suspendedAt as string | undefined,
  suspensionReason: o.status_reason ?? undefined, ownerName: o.meta.ownerName as string | undefined, ownerEmail: o.meta.ownerEmail as string | undefined,
  document: o.meta.document as string | undefined, notes: o.meta.notes as string | undefined, modules: o.meta.modules as string[] | undefined,
  settings: { ...DEFAULT_BRANDING, brandName: o.name, ...(o.branding as object) },
});
const META_KEYS = ["cycle", "trialEndsAt", "suspendedAt", "ownerName", "ownerEmail", "document", "notes", "modules"] as const;

async function orgRows(): Promise<OrgRow[]> {
  const sb = supabaseBrowser();
  return paged<OrgRow>((a, b) => sb.from("organizations").select("id,slug,name,status,plan,branding,meta,status_reason,created_at").order("created_at").range(a, b));
}

/** Configuração inicial do escritório (sem dados fictícios): feriados NACIONAIS; municipais/estaduais o escritório cadastra. */
export function defaultSettings(organizationId: string): OrgSettings {
  const n = (date: string, name: string) => ({ date, name, scope: "Nacional" });
  return {
    id: `set-${organizationId}`, organizationId, hours: "Seg–sex, 9h às 18h", timezone: "America/Sao_Paulo",
    areas: ["Previdenciário", "Trabalhista", "Família", "Civil", "Consumidor", "Bancário"],
    financeCategories: ["Honorários", "Custas", "Ocupação", "Software", "Repasse a parceiro", "Dinheiro de cliente (não é receita)"],
    retentionYears: 10, notificationPrefs: {}, stageLabels: {}, onboardingDone: [], dataRequests: [], calendarVersion: "nacional-2026-2027",
    holidays: [
      n("2026-11-02", "Finados"), n("2026-11-15", "Proclamação da República"), n("2026-11-20", "Dia Nacional de Zumbi e da Consciência Negra"), n("2026-12-25", "Natal"),
      n("2027-01-01", "Confraternização Universal"), n("2027-03-26", "Sexta-feira Santa"), n("2027-04-21", "Tiradentes"), n("2027-05-01", "Dia do Trabalho"),
      n("2027-09-07", "Independência do Brasil"), n("2027-10-12", "Nossa Senhora Aparecida"), n("2027-11-02", "Finados"), n("2027-11-15", "Proclamação da República"),
      n("2027-11-20", "Dia Nacional de Zumbi e da Consciência Negra"), n("2027-12-25", "Natal"),
    ],
  };
}

/** Catálogo de integrações com o estado VERDADEIRO desta implantação. */
function integrationCatalog(organizationId: string): IntegrationConnection[] {
  const live: Record<string, string[]> = {
    supabase: ["Autenticação, banco e arquivos com isolamento por escritório (RLS) em operação."],
    resend: ["Em uso para convites e recuperação de acesso. Envio de e-mails a clientes ainda não habilitado."],
  };
  return ops.integrations.map((i) => ({
    ...i, organizationId, mode: "production" as const, maskedConfig: {}, lastSync: undefined, lastError: undefined,
    status: live[i.provider] ? ("operacional" as const) : ("nao_configurado" as const),
    limitations: live[i.provider] ?? i.limitations.filter((l) => !/demo|simula/i.test(l)),
  }));
}

const PORTAL_PART: Record<string, string> = { cases: "cases", documents: "documents", events: "events", installments: "installments", charges: "charges" };

export async function realRead(name: string): Promise<unknown[]> {
  const sb = supabaseBrowser();
  if (portalSession) {
    if (name === "organizations") { const o = (await portalSnapshot())?.organization as { id: string; name: string } | undefined; return o ? [{ id: o.id, name: o.name, city: "—", focus: "" }] : []; }
    if (name === "tenants") { const o = (await portalSnapshot())?.organization as OrgRow | undefined; return o ? [toTenant({ ...o, meta: {}, status_reason: null, created_at: "" })] : []; }
    const part = PORTAL_PART[name];
    return part ? (((await portalSnapshot())?.[part] as unknown[]) ?? []) : [];
  }
  if (ORG.has(name)) {
    if (!org) return [];
    const rows = await paged<{ id: string; data: Row; version: number }>((a, b) => sb.from("org_records").select("id,data,version").eq("organization_id", org!).eq("collection", name).order("updated_at").range(a, b));
    const versions = new Map(rows.map((r) => [r.id, r.version]));
    let data = rows.map((r) => r.data);
    if (name === "settings" && !data.length) data = [defaultSettings(org) as unknown as Row];
    if (name === "integrations") {
      const have = new Set(data.map((d) => d.provider));
      data = [...data, ...(integrationCatalog(org).filter((i) => !have.has(i.provider)) as unknown as Row[])];
    }
    return remember(name, data, versions);
  }
  if (name === "organizations") return (await orgRows()).map((o) => ({ id: o.id, name: o.name, city: "—", focus: "" }));
  if (name === "tenants") return remember(name, (await orgRows()).map(toTenant) as unknown as Row[]);
  if (name === "users") {
    if (!org) return [];
    const { data, error } = await sb.rpc("org_team", { p_org: org });
    if (error) throw friendly(error);
    return ((data ?? []) as { user_id: string; full_name: string; role: User["role"] }[]).map((u): User => ({ id: u.user_id, name: u.full_name, role: u.role, organizationId: org }));
  }
  if (name === "audit") {
    const q = sb.from("audit_logs").select("id,organization_id,actor_id,action,entity,entity_id,detail,at").order("at", { ascending: false }).limit(1000);
    const { data, error } = await (platformSession ? q.eq("entity", "organizations") : org ? q.eq("organization_id", org) : q.limit(0));
    if (error) throw friendly(error);
    const rows = ((data ?? []) as { id: number; organization_id: string | null; actor_id: string | null; action: string; entity: string; entity_id: string; detail: string | null; at: string }[])
      .reverse().map((a): AuditEvent => ({ id: String(a.id), organizationId: platformSession ? "platform" : a.organization_id ?? "", at: a.at, actorId: a.actor_id ?? "sistema", action: a.action, entity: a.entity, entityId: a.entity_id, detail: a.detail ?? "" }));
    return remember(name, rows as unknown as Row[]);
  }
  if (PLATFORM.has(name)) {
    const { data, error } = await sb.from("platform_records").select("id,data").eq("collection", name);
    if (error) throw friendly(error);
    let rows = ((data ?? []) as { data: Row }[]).map((r) => r.data);
    if (name === "plans" && !rows.length) rows = platform.plans as unknown as Row[]; // catálogo de planos do produto (configuração, não dado de cliente)
    return remember(name, rows);
  }
  if (name === "platformProviders") return platform.platformProviders.map((p) => ({ ...p, enabled: false, status: "requires_credentials" }));
  if (name === "learning") {
    try { return JSON.parse(localStorage.getItem(`lexsion.learning.${uid}`) ?? "[]"); } catch { return []; }
  }
  return []; // demais coleções da demo (ex.: amostras do jornal) não existem na operação real
}

function diff(name: string, rows: Row[]) {
  const before = snaps.get(name) ?? new Map();
  const ids = new Set(rows.map((r) => r.id));
  const upserts = rows.filter((r) => before.get(r.id)?.json !== JSON.stringify(r));
  const deletes = [...before.keys()].filter((id) => !ids.has(id));
  if (deletes.length > MASS_DELETE && deletes.length > before.size / 2) throw new SaveError("Proteção de dados: exclusão em massa bloqueada. Fale com o suporte LexSion.", "mass_delete");
  return { before, upserts, deletes };
}

export async function realWrite(patch: Record<string, unknown[]>): Promise<void> {
  const sb = supabaseBrowser();
  const changes: Record<string, unknown>[] = [];
  const uploads: { path: string; blob: Blob }[] = [];
  const removeObjects: string[] = [];
  const after: [string, Row[]][] = [];
  for (const [name, list] of Object.entries(patch)) {
    let rows = list as Row[];
    if (!ORG.has(name)) continue;
    if (!org) throw new SaveError("Sessão sem escritório. Entre novamente.", "no_org");
    if (name === "files") {
      rows = rows.map((f) => {
        if (!(f.blob instanceof Blob)) return f;
        const path = `${org}/${f.id}/${String(f.name).normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-120)}`;
        uploads.push({ path, blob: f.blob });
        const { blob: _blob, ...rest } = f;
        void _blob;
        return { ...rest, path };
      });
    }
    const { before, upserts, deletes } = diff(name, rows);
    for (const r of upserts) changes.push({ collection: name, data: r, ...(before.get(r.id)?.version != null ? { expected: before.get(r.id)!.version } : {}) });
    for (const id of deletes) {
      changes.push({ op: "delete", org, collection: name, id });
      if (name === "files") { const p = (JSON.parse(before.get(id)!.json) as Row).path; if (typeof p === "string") removeObjects.push(p); }
    }
    after.push([name, rows]);
  }
  for (const u of uploads) {
    const { error } = await sb.storage.from("documentos").upload(u.path, u.blob, { contentType: u.blob.type, upsert: false });
    if (error) throw new SaveError("Não foi possível enviar o arquivo agora. Nada foi gravado; tente de novo.", "upload");
  }
  if (changes.length) {
    const { error } = await sb.rpc("apply_changes", { p_changes: changes });
    if (error) {
      if (uploads.length) await sb.storage.from("documentos").remove(uploads.map((u) => u.path));
      throw friendly(error);
    }
  }
  for (const [name] of after) snaps.delete(name); // próxima leitura traz versões novas
  if (removeObjects.length) await sb.storage.from("documentos").remove(removeObjects);

  // Notas de auditoria legíveis (a trilha técnica já é gravada pelo banco em cada alteração).
  const audit = patch.audit as AuditEvent[] | undefined;
  if (audit && org) {
    const known = snaps.get("audit") ?? new Map();
    const fresh = audit.filter((a) => !known.has(a.id) && a.organizationId === org);
    if (fresh.length) await sb.from("audit_logs").insert(fresh.map((a) => ({ organization_id: org, actor_id: uid, action: a.action, entity: a.entity, entity_id: a.entityId, detail: a.detail })));
    snaps.delete("audit");
  }
  if (patch.tenants) await writeTenants(patch.tenants as Tenant[]);
  for (const name of Object.keys(patch).filter((n) => PLATFORM.has(n))) {
    const { before, upserts, deletes } = diff(name, patch[name] as Row[]);
    void before;
    if (upserts.length) { const { error } = await sb.from("platform_records").upsert(upserts.map((r) => ({ collection: name, id: r.id, data: r, updated_at: new Date().toISOString() }))); if (error) throw friendly(error); }
    if (deletes.length) { const { error } = await sb.from("platform_records").delete().eq("collection", name).in("id", deletes); if (error) throw friendly(error); }
    snaps.delete(name);
  }
  if (patch.learning) {
    try { localStorage.setItem(`lexsion.learning.${uid}`, JSON.stringify(patch.learning)); } catch {}
  }
}

async function writeTenants(next: Tenant[]) {
  const sb = supabaseBrowser();
  const before = snaps.get("tenants") ?? new Map();
  for (const t of next) {
    const raw = before.get(t.id)?.json;
    if (!raw) throw new SaveError("Novo escritório só pelo assistente do Super Admin (convite do responsável).", "use_wizard");
    const old = JSON.parse(raw) as Tenant;
    if (raw === JSON.stringify(t)) continue;
    const call = async (fn: string, args: Record<string, unknown>) => { const { error } = await sb.rpc(fn, args); if (error) throw friendly(error); };
    if (JSON.stringify(old.settings) !== JSON.stringify(t.settings)) {
      if (platformSession) await call("platform_set_org_branding", { p_org: t.id, p_branding: t.settings });
      else { const { error } = await sb.from("organizations").update({ branding: t.settings, updated_at: new Date().toISOString() }).eq("id", t.id); if (error) throw friendly(error); }
    }
    if (old.status !== t.status) await call("set_organization_status", { p_org: t.id, p_status: t.status, p_reason: t.suspensionReason ?? null });
    if (old.plan !== t.plan) await call("set_organization_plan", { p_org: t.id, p_plan: t.plan });
    const meta = Object.fromEntries(META_KEYS.filter((k) => JSON.stringify(old[k]) !== JSON.stringify(t[k])).map((k) => [k, t[k] ?? null]));
    if (Object.keys(meta).length) await call("platform_set_org_meta", { p_org: t.id, p_meta: meta });
  }
  snaps.delete("tenants");
}

/** Consumo agregado (membros, clientes, armazenamento). Plataforma: todos os escritórios; titular: o próprio. */
let usageCache: Promise<Map<string, { members: number; clients: number; storage_bytes: number }>> | null = null;
export async function platformUsage(orgId: string) {
  const sb = supabaseBrowser();
  if (platformSession) {
    usageCache ??= (async () => {
      const { data, error } = await sb.rpc("platform_org_usage");
      if (error) throw friendly(error);
      return new Map(((data ?? []) as { organization_id: string; members: number; clients: number; storage_bytes: number }[]).map((u) => [u.organization_id, u]));
    })();
    const u = (await usageCache).get(orgId);
    setTimeout(() => { usageCache = null; }, 30_000);
    return { members: u?.members ?? 0, clients: u?.clients ?? 0, storage: Math.round((u?.storage_bytes ?? 0) / 1024 / 1024), aiMessages: 0, automations: 0 };
  }
  const [team, clients, files] = await Promise.all([realRead("users"), realRead("clients"), realRead("files")]);
  return { members: team.length, clients: clients.length, storage: Math.round((files as { size?: number }[]).reduce((s, f) => s + (f.size ?? 0), 0) / 1024 / 1024), aiMessages: 0, automations: 0 };
}

/** URL temporária (5 min) de um arquivo do escritório ou compartilhado com o cliente. A RLS do Storage decide. */
export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await supabaseBrowser().storage.from("documentos").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
