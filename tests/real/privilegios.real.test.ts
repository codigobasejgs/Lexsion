import fs from "node:fs";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Privilégios REAIS no Supabase de produção. Duas camadas:
// 1) catálogo (Management API, só leitura): o que cada papel PODE fazer;
// 2) sessões reais (anon e usuários sintéticos de papéis e escritórios diferentes): o que de fato consegue fazer.
// Pessoas e escritórios são sintéticos (qa-…@lexsion-qa.invalid) e apagados no final.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = process.env.RUN_REAL === "1" && !!env.SUPABASE_ACCESS_TOKEN && !!env.SUPABASE_SECRET_KEY;
const q = async <T,>(sql: string): Promise<T[]> => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const j = await r.json();
  // Erro da API (sintaxe, limite) nunca pode virar "lista vazia" e passar o teste por engano.
  if (!Array.isArray(j)) throw new Error(`consulta ao catálogo falhou: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
};
const BRAND_KEYS = ["backgroundDark", "backgroundLight", "brandName", "hasIcon", "iconVersion", "name", "primary", "pwaShortName", "slug", "themeMode"];
const pub = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

describe.skipIf(!ON)("REAL — privilégios do banco (catálogo)", () => {
  it("anônimo: nenhuma tabela e nenhuma sequência pública", async () => {
    expect(await q("select distinct table_name from information_schema.role_table_grants where table_schema='public' and grantee='anon'")).toEqual([]);
    expect(await q("select relname from (select c.oid, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S' offset 0) s where has_sequence_privilege('anon', s.oid, 'USAGE')")).toEqual([]);
  });
  it("autenticado: nunca TRUNCATE, REFERENCES, TRIGGER nem MAINTAIN; auditoria sem UPDATE/DELETE", async () => {
    expect(await q("select distinct table_name from information_schema.role_table_grants where table_schema='public' and grantee='authenticated' and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')")).toEqual([]);
    expect(await q("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and has_table_privilege('authenticated', c.oid, 'MAINTAIN')")).toEqual([]);
    expect(await q("select privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='audit_logs' and grantee='authenticated' and privilege_type in ('UPDATE','DELETE')")).toEqual([]);
  });
  it("RLS ligada em todas as tabelas públicas", async () => {
    expect(await q("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).toEqual([]);
  });
  it("toda função SECURITY DEFINER tem search_path fixo e nenhuma é executável por PUBLIC", async () => {
    const f = await q<{ proname: string; cfg: string[] | null; pub: boolean }>("select p.proname, p.proconfig cfg, has_function_privilege('public', p.oid, 'EXECUTE') pub from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef");
    expect(f.length).toBeGreaterThan(20);
    expect(f.filter((x) => !(x.cfg ?? []).some((c) => c.startsWith("search_path=")))).toEqual([]);
    expect(f.filter((x) => x.pub).map((x) => x.proname)).toEqual([]);
  });
  it("anônimo só executa public_brand; disparo do agendador e trava não são executáveis por ninguém do app", async () => {
    const anonFns = await q<{ proname: string }>("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'EXECUTE')");
    expect(anonFns.map((x) => x.proname)).toEqual(["public_brand"]);
    const svc = await q<{ proname: string; auth: boolean }>("select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') auth from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('trigger_legal_sync','acquire_sync_lock')");
    expect(svc.every((x) => !x.auth)).toBe(true);
  });
  it("hash do segredo do webhook não é legível por usuário logado", async () => {
    const cols = await q<{ column_name: string }>("select column_name from information_schema.column_privileges where table_schema='public' and table_name='whatsapp_instances' and grantee='authenticated' and privilege_type='SELECT'");
    expect(cols.map((c) => c.column_name)).not.toContain("webhook_secret_hash");
  });
});

describe.skipIf(!ON)("REAL — sessões de verdade (anon, papéis e escritórios)", () => {
  const tag = crypto.randomBytes(3).toString("hex");
  let admin: SupabaseClient;
  const users: string[] = [];
  const orgs: string[] = [];
  const s: Record<string, SupabaseClient> = {};
  const id: Record<string, string> = {};
  beforeAll(async () => {
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    for (const k of ["tit", "adv", "est", "fin", "out"]) {
      const email = `qa-priv${k}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
      const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      users.push(data.user!.id); id[k] = data.user!.id;
      s[k] = pub(); await s[k].auth.signInWithPassword({ email, password });
    }
    for (const [slug, owner] of [[`qa-priv-a-${tag}`, id.tit], [`qa-priv-b-${tag}`, id.out]]) {
      const { data } = await admin.from("organizations").insert({ slug, name: `QA Priv ${slug}`, branding: { brandName: "Marca QA", primary: "#123456", hasPublicIcon: false } }).select("id").single().throwOnError();
      orgs.push(data!.id);
      await admin.from("organization_memberships").insert({ organization_id: data!.id, user_id: owner, role: "admin" }).throwOnError();
    }
    await admin.from("organization_memberships").insert([{ organization_id: orgs[0], user_id: id.adv, role: "advogado" }, { organization_id: orgs[0], user_id: id.est, role: "estagiario" }, { organization_id: orgs[0], user_id: id.fin, role: "financeiro" }]).throwOnError();
    await admin.from("profiles").upsert({ user_id: id.adv, full_name: "Nome Original" }).throwOnError();
    await admin.from("audit_logs").insert({ organization_id: orgs[0], actor_id: id.tit, action: "teste", entity: "x", entity_id: `alvo-${tag}` }).throwOnError();
  }, 120_000);
  afterAll(async () => {
    if (!admin) return;
    if (orgs.length) { await admin.from("organizations").delete().in("id", orgs); await admin.from("audit_logs").delete().in("organization_id", orgs); }
    await admin.from("platform_members").delete().in("user_id", users);
    await admin.from("platform_records").delete().like("id", `%${tag}%`);
    for (const u of users) await admin.auth.admin.deleteUser(u);
  }, 120_000);

  it("anônimo não lê nenhuma tabela do app nem executa funções privadas", async () => {
    const a = pub();
    for (const t of ["organizations", "org_records", "audit_logs", "profiles", "organization_memberships", "legal_documents", "whatsapp_instances", "source_sync_runs", "tenant_alerts", "portal_links", "platform_records"]) {
      const r = await a.from(t).select("*").limit(1);
      expect(r.error?.message ?? `${t} legível`).toMatch(/permission denied/);
    }
    for (const f of ["my_access", "portal_snapshot", "platform_org_usage", "org_team"]) expect((await a.rpc(f, f === "org_team" ? { p_org: orgs[0] } : {})).error).not.toBeNull();
  });
  it("anônimo lê SÓ campos de marca, e só de escritório ativo", async () => {
    const a = pub();
    const b = await a.rpc("public_brand", { p_slug: `qa-priv-a-${tag}` });
    expect(b.error).toBeNull();
    expect(Object.keys(b.data as object).sort()).toEqual(BRAND_KEYS);
    await admin.from("organizations").update({ status: "suspensa" }).eq("id", orgs[1]);
    expect((await a.rpc("public_brand", { p_slug: `qa-priv-b-${tag}` })).data).toBeNull();
    await admin.from("organizations").update({ status: "trial" }).eq("id", orgs[1]);
  });
  it("auditoria: ninguém forja autor, altera ou apaga registro", async () => {
    expect((await s.tit.from("audit_logs").insert({ organization_id: orgs[0], actor_id: id.adv, action: "forjado", entity: "x", entity_id: "x" })).error?.message).toMatch(/row-level security/);
    expect((await s.tit.from("audit_logs").update({ detail: "alterado" }).eq("entity_id", `alvo-${tag}`).select("id")).error?.message ?? "").toMatch(/permission denied/);
    expect((await s.tit.from("audit_logs").delete().eq("entity_id", `alvo-${tag}`).select("id")).error?.message ?? "").toMatch(/permission denied/);
    const { count } = await admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("entity_id", `alvo-${tag}`);
    expect(count).toBe(1);
  });
  it("escalada: titular não vira plataforma nem entra em outro escritório; estagiário não se promove", async () => {
    expect((await s.tit.from("platform_members").insert({ user_id: id.tit, role: "superadmin" })).error?.message).toMatch(/permission denied/);
    expect((await s.tit.from("organization_memberships").insert({ organization_id: orgs[1], user_id: id.tit, role: "admin" })).error?.message).toMatch(/row-level security/);
    await s.est.from("organization_memberships").update({ role: "admin" }).eq("user_id", id.est);
    const { data } = await admin.from("organization_memberships").select("role").eq("user_id", id.est).single();
    expect(data!.role).toBe("estagiario");
    expect((await s.tit.from("platform_records").insert({ collection: "supportTickets", id: `x-${tag}`, data: {} })).error?.message).toMatch(/row-level security/);
  });
  it("perfil: titular não altera o nome de outra pessoa", async () => {
    await s.tit.from("profiles").update({ full_name: "Invadido" }).eq("user_id", id.adv);
    const { data } = await admin.from("profiles").select("full_name").eq("user_id", id.adv).single();
    expect(data!.full_name).toBe("Nome Original");
  });
  it("isolamento entre escritórios e papéis em registros do ERP", async () => {
    await admin.from("org_records").insert({ organization_id: orgs[0], collection: "leads", id: `lead-${tag}`, data: { id: `lead-${tag}`, organizationId: orgs[0], name: "Lead QA" } }).throwOnError();
    expect((await s.out.from("org_records").select("id").eq("organization_id", orgs[0])).data ?? []).toEqual([]);
    expect((await s.fin.from("org_records").select("id").eq("collection", "leads")).data ?? []).toEqual([]);
    expect(((await s.adv.from("org_records").select("id").eq("collection", "leads")).data ?? []).length).toBe(1);
  });
  it("operações legítimas continuam funcionando depois do endurecimento", async () => {
    expect((await s.adv.from("org_records").insert({ organization_id: orgs[0], collection: "clients", id: `c-${tag}`, data: { id: `c-${tag}`, organizationId: orgs[0], name: "Cliente QA" } })).error).toBeNull();
    expect(((await s.tit.from("organization_memberships").select("role").eq("organization_id", orgs[0])).data ?? []).length).toBe(4);
    expect(((await s.tit.from("organizations").update({ name: "QA Priv Renomeado" }).eq("id", orgs[0]).select("id")).data ?? []).length).toBe(1);
    expect((await s.adv.rpc("my_access")).error).toBeNull();
    expect((await s.adv.from("audit_logs").insert({ organization_id: orgs[0], actor_id: id.adv, action: "nota", entity: "x", entity_id: "x", detail: "nota legítima" })).error).toBeNull();
    expect(((await s.adv.from("legal_documents").select("id").limit(1)).data ?? []).length).toBe(1);
    expect((await s.tit.from("tenant_legal_preferences").upsert({ organization_id: orgs[0], areas: ["Previdenciário"] })).error).toBeNull();
  });
});
