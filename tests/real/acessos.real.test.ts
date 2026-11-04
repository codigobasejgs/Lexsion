import fs from "node:fs";
import crypto from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Acessos de equipe criados pelo titular (e-mail + senha, sem e-mail enviado), contra build local + Supabase REAL.
// E-mails @lexsion-qa.invalid (domínio inexistente): prova que o login não depende de caixa de entrada.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = process.env.RUN_REAL === "1" && !!env.SUPABASE_SECRET_KEY;
const PORT = 3221, BASE = `http://localhost:${PORT}`;
const tag = crypto.randomBytes(3).toString("hex");
let server: ChildProcess | undefined, admin: SupabaseClient;
const users: string[] = [];
let org = "", otherOrg = "", finId = "";
const cookie: Record<string, string> = {};
async function login(email: string, password: string) {
  const jar = new Map<string, string>();
  const c = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((x) => jar.set(x.name, x.value)) } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  return error ? null : [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const post = (who: string, body: object) => fetch(`${BASE}/api/equipe/acessos`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie[who], Origin: BASE }, body: JSON.stringify(body) });

describe.skipIf(!ON)("REAL — acessos da equipe criados pelo titular", () => {
  beforeAll(async () => {
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, ...env }, stdio: "ignore" });
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + "/entrar")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
    const mk = async (k: string) => {
      const email = `qa-ac${k}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
      const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      users.push(data.user!.id);
      return { id: data.user!.id, email, password };
    };
    const [tit, fin, outro] = [await mk("tit"), await mk("fin"), await mk("outro")];
    finId = fin.id;
    for (const [slug, owner] of [[`qa-ac-a-${tag}`, tit.id], [`qa-ac-b-${tag}`, outro.id]] as const) {
      const { data } = await admin.from("organizations").insert({ slug, name: `QA Acessos ${slug}` }).select("id").single().throwOnError();
      await admin.from("organization_memberships").insert({ organization_id: data!.id, user_id: owner, role: "admin" }).throwOnError();
      if (owner === tit.id) org = data!.id; else otherOrg = data!.id;
    }
    // Limite de 3 usuários (cortesia) para provar o bloqueio sem depender do plano.
    await admin.from("saas_entitlement_overrides").insert({ organization_id: org, key: "max_users", value: 3, reason: "QA acessos" }).throwOnError();
    await admin.from("organization_memberships").insert({ organization_id: org, user_id: fin.id, role: "financeiro" }).throwOnError();
    cookie.tit = (await login(tit.email, tit.password))!;
    cookie.fin = (await login(fin.email, fin.password))!;
    cookie.outro = (await login(outro.email, outro.password))!;
  }, 180_000);
  afterAll(async () => {
    server?.kill();
    if (!admin) return;
    const { data: all } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of all.users.filter((x) => x.email?.endsWith(`-${tag}@lexsion-qa.invalid`) || x.email?.endsWith(`${tag}@lexsion-qa.invalid`))) if (!users.includes(u.id)) users.push(u.id);
    for (const o of [org, otherOrg].filter(Boolean)) { await admin.from("organizations").delete().eq("id", o); await admin.from("audit_logs").delete().eq("organization_id", o); }
    for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => null);
  }, 120_000);

  const email = `maria-${tag}@lexsion-qa.invalid`;
  const firstPassword = `Maria${tag}Escritorio7`;
  let mariaId = "";
  it("titular cria acesso com senha: login funciona na hora, sem e-mail e sem caixa de entrada", async () => {
    const r = await post("tit", { organizationId: org, action: "create", fullName: "Maria QA", email, password: firstPassword, role: "advogado" });
    const j = await r.json();
    expect(r.status, JSON.stringify(j)).toBe(200);
    mariaId = j.data.userId;
    expect(await login(email, firstPassword)).toBeTruthy();
    const { data } = await admin.from("organization_memberships").select("role").eq("organization_id", org).eq("user_id", mariaId).single();
    expect(data!.role).toBe("advogado");
  });
  it("senha fraca, e-mail já existente, financeiro, outro escritório e limite do plano são recusados; nada fica solto", async () => {
    expect((await post("tit", { organizationId: org, action: "create", fullName: "Fraca QA", email: `fraca-${tag}@lexsion-qa.invalid`, password: "12345678901", role: "advogado" })).status).toBe(400);
    expect((await post("tit", { organizationId: org, action: "create", fullName: "Maria QA", email, password: `Outra${tag}Chave99x`, role: "advogado" })).status).toBe(409);
    expect((await post("fin", { organizationId: org, action: "create", fullName: "Fin QA", email: `fin2-${tag}@lexsion-qa.invalid`, password: `Fin${tag}Chave123x`, role: "advogado" })).status).toBe(403);
    expect((await post("outro", { organizationId: org, action: "create", fullName: "Out QA", email: `out2-${tag}@lexsion-qa.invalid`, password: `Out${tag}Chave123x`, role: "advogado" })).status).toBe(403);
    expect((await post("tit", { organizationId: org, action: "create", fullName: "Lim QA", email: `lim2-${tag}@lexsion-qa.invalid`, password: `Lim${tag}Chave123x`, role: "estagiario" })).status).toBe(409); // 3 de 3
    const { data: all } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(all.users.filter((u) => /^(fraca|fin2|out2|lim2)-/.test(u.email ?? "") && (u.email ?? "").endsWith(`-${tag}@lexsion-qa.invalid`))).toEqual([]);
  });
  it("nova senha derruba a antiga; outro escritório não troca; remover apaga a conta criada pelo escritório", async () => {
    const np = `Nova${tag}Chave2026x`;
    expect((await post("outro", { organizationId: org, action: "password", userId: mariaId, password: np })).status).toBe(403);
    expect((await post("tit", { organizationId: org, action: "password", userId: mariaId, password: np })).status).toBe(200);
    expect(await login(email, firstPassword)).toBeNull();
    expect(await login(email, np)).toBeTruthy();
    expect((await post("tit", { organizationId: org, action: "remove", userId: mariaId })).status).toBe(200);
    expect(await login(email, np)).toBeNull();
    expect((await admin.auth.admin.getUserById(mariaId)).data.user).toBeNull();
  });
  it("não troca a senha de quem tem conta própria (entrou por convite)", async () => {
    expect((await post("tit", { organizationId: org, action: "password", userId: finId, password: `Troca${tag}Chave99x` })).status).toBe(403);
  });
});
