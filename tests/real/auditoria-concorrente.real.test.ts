import fs from "node:fs";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverNow, totp } from "../shared/totp";

// Auditoria REAL sob concorrência (Supabase de produção, dados sintéticos): várias sessões ao mesmo tempo
// suspendem/reativam escritórios, alteram permissões e convidam. Cada ação gera exatamente UMA linha de auditoria,
// nenhuma se perde, nenhuma duplica, e usuário comum não altera nem apaga o histórico.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = process.env.RUN_REAL === "1" && !!env.SUPABASE_SECRET_KEY;
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const N = 4; // escritórios em paralelo

describe.skipIf(!ON)("REAL — auditoria concorrente", () => {
  const tag = crypto.randomBytes(3).toString("hex");
  let admin: SupabaseClient;
  const made: string[] = [];
  const orgs: string[] = [];
  const s: Record<string, SupabaseClient> = {};
  const id: Record<string, string> = {};
  const login = async (k: string) => {
    const email = `qa-audc${k}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    made.push(data.user!.id); id[k] = data.user!.id;
    const c = createClient(URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email, password });
    s[k] = c;
  };
  beforeAll(async () => {
    admin = createClient(URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    await login("plat");
    await admin.from("platform_members").insert({ user_id: id.plat, role: "platform_admin" }).throwOnError();
    const { data: e } = await s.plat.auth.mfa.enroll({ factorType: "totp", friendlyName: `qa-${tag}` });
    await s.plat.auth.mfa.challengeAndVerify({ factorId: e!.id, code: totp(e!.totp.secret, await serverNow(URL)) });
    for (let i = 0; i < N; i++) {
      await login(`tit${i}`); await login(`est${i}`);
      const { data } = await admin.from("organizations").insert({ slug: `qa-audc-${i}-${tag}`, name: `QA AudC ${i}` }).select("id").single().throwOnError();
      orgs.push(data!.id);
      await admin.from("organization_memberships").insert([{ organization_id: data!.id, user_id: id[`tit${i}`], role: "admin" }, { organization_id: data!.id, user_id: id[`est${i}`], role: "estagiario" }]).throwOnError();
    }
  }, 180_000);
  afterAll(async () => {
    if (!admin) return;
    if (orgs.length) { await admin.from("organizations").delete().in("id", orgs); await admin.from("audit_logs").delete().in("organization_id", orgs); }
    await admin.from("platform_members").delete().in("user_id", made);
    for (const u of made) await admin.auth.admin.deleteUser(u);
  }, 180_000);

  const count = async (org: string, action: string, like?: string) => {
    let q = admin.from("audit_logs").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("action", action);
    if (like) q = q.like("detail", like);
    return (await q).count ?? 0;
  };

  it("suspender e reativar N escritórios em paralelo, 3 rodadas: 1 linha por ação, nenhuma perdida", async () => {
    for (let r = 1; r <= 3; r++) {
      await Promise.all(orgs.map((o) => s.plat.rpc("set_organization_status", { p_org: o, p_status: "suspensa", p_reason: `QA concorrente r${r}` }).then((x) => { if (x.error) throw x.error; })));
      await Promise.all(orgs.map((o) => s.plat.rpc("set_organization_status", { p_org: o, p_status: "ativa", p_reason: null }).then((x) => { if (x.error) throw x.error; })));
    }
    for (const o of orgs) {
      expect(await count(o, "status", "suspensa: QA concorrente r%")).toBe(3);
      expect(await count(o, "status", "ativa%")).toBe(3);
      expect((await admin.from("organizations").select("status").eq("id", o).single()).data?.status).toBe("ativa");
    }
  });

  it("titulares alteram permissões ao mesmo tempo nos N escritórios: cada mudança auditada uma vez", async () => {
    await Promise.all(orgs.map((o, i) => s[`tit${i}`].from("org_role_restrictions").insert({ organization_id: o, role: "estagiario", collection: "clients", deny_read: true, reason: "QA concorrente" }).then((x) => { if (x.error) throw x.error; })));
    await Promise.all(orgs.map((o, i) => s[`tit${i}`].from("org_role_restrictions").delete().eq("organization_id", o).eq("role", "estagiario").eq("collection", "clients").then((x) => { if (x.error) throw x.error; })));
    for (const o of orgs) {
      expect(await count(o, "permissao.insert")).toBe(1);
      expect(await count(o, "permissao.delete")).toBe(1);
    }
  });

  it("mesma organização, várias gravações simultâneas: N eventos distintos, sem duplicar nem perder", async () => {
    const o = orgs[0];
    const before = await count(o, "nota");
    await Promise.all(Array.from({ length: 12 }, (_, k) => s.tit0.from("audit_logs").insert({ organization_id: o, actor_id: id.tit0, action: "nota", entity: "qa", entity_id: `n-${k}`, detail: `nota ${k}` }).then((x) => { if (x.error) throw x.error; })));
    expect(await count(o, "nota")).toBe(before + 12);
    const { data } = await admin.from("audit_logs").select("entity_id").eq("organization_id", o).eq("action", "nota");
    expect(new Set(data!.map((d) => d.entity_id)).size).toBe(12);
  });

  it("usuário comum não altera nem apaga auditoria, e não forja autor", async () => {
    const o = orgs[0];
    expect((await s.tit0.from("audit_logs").update({ detail: "alterado" }).eq("organization_id", o).select("id")).error?.message ?? "").toMatch(/permission denied/);
    expect((await s.tit0.from("audit_logs").delete().eq("organization_id", o).select("id")).error?.message ?? "").toMatch(/permission denied/);
    expect((await s.est0.from("audit_logs").insert({ organization_id: o, actor_id: id.tit0, action: "forjado", entity: "x", entity_id: "x" })).error?.message ?? "").toMatch(/row-level security/);
    expect(await count(o, "status", "suspensa: QA concorrente r%")).toBe(3); // histórico intacto
  });
});
