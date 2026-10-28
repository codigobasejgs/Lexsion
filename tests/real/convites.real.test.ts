import fs from "node:fs";
import crypto from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Rota /api/equipe/convites contra o build local (next start) + Supabase REAL. RUN_REAL=1 e `pnpm build` antes.
// Convites vão para endereços .invalid (nunca entregues). Tudo criado é removido no final.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = process.env.RUN_REAL === "1" && !!env.SUPABASE_SECRET_KEY;
const PORT = 3217;
const BASE = `http://localhost:${PORT}`;
const tag = crypto.randomBytes(3).toString("hex");
let server: ChildProcess | undefined;
let admin: SupabaseClient;
const made: string[] = [];
const orgs: string[] = [];

async function user(key: string) {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(16).toString("base64url")}7`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  made.push(data.user.id);
  return { id: data.user.id, email, password };
}
/** Faz login como o navegador faria e devolve o cabeçalho Cookie de sessão do @supabase/ssr. */
async function cookieFor(u: { email: string; password: string }) {
  const jar = new Map<string, string>();
  const c = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((x) => jar.set(x.name, x.value)) } });
  const { error } = await c.auth.signInWithPassword(u);
  if (error) throw error;
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const invite = (cookie: string, body: object) => fetch(`${BASE}/api/equipe/convites`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: BASE }, body: JSON.stringify(body) });

describe.skipIf(!ON)("REAL — convite de equipe pela rota do servidor", () => {
  let titular: { id: string; email: string; password: string }, adv: typeof titular, outro: typeof titular, orgA = "";
  beforeAll(async () => {
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, ...env }, stdio: "ignore" });
    for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + "/entrar")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
    [titular, adv, outro] = [await user("tit"), await user("adv"), await user("outro")];
    const ins = async (slug: string, owner: string) => {
      const { data, error } = await admin.from("organizations").insert({ slug, name: `QA ${slug}` }).select("id").single();
      if (error) throw error;
      orgs.push(data.id);
      await admin.from("organization_memberships").insert({ organization_id: data.id, user_id: owner, role: "admin" }).throwOnError();
      return data.id as string;
    };
    orgA = await ins(`qa-conv-a-${tag}`, titular.id);
    await ins(`qa-conv-b-${tag}`, outro.id);
    await admin.from("organization_memberships").insert({ organization_id: orgA, user_id: adv.id, role: "advogado" }).throwOnError();
  }, 120_000);
  afterAll(async () => {
    server?.kill();
    if (!admin) return;
    if (orgs.length) await admin.from("organizations").delete().in("id", orgs);
    if (orgs.length) await admin.from("audit_logs").delete().in("organization_id", orgs);
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of data.users.filter((x) => x.email?.endsWith(`-${tag}@lexsion-qa.invalid`))) made.includes(u.id) || made.push(u.id);
    for (const id of made) await admin.auth.admin.deleteUser(id);
  }, 120_000);

  it("titular convida: conta criada no Auth e vínculo gravado com o papel pedido", async () => {
    const email = `qa-convidado-${tag}@lexsion-qa.invalid`;
    const r = await invite(await cookieFor(titular), { organizationId: orgA, email, role: "estagiario", fullName: "QA Convidado" });
    expect(r.status).toBe(200);
    const j = await r.json();
    made.push(j.data.userId);
    const { data } = await admin.from("organization_memberships").select("role").eq("organization_id", orgA).eq("user_id", j.data.userId).single();
    expect(data?.role).toBe("estagiario");
  });
  it("advogado não convida (403)", async () => {
    const r = await invite(await cookieFor(adv), { organizationId: orgA, email: `qa-x-${tag}@lexsion-qa.invalid`, role: "advogado" });
    expect(r.status).toBe(403);
  });
  it("titular de OUTRO escritório não convida para o A (403), mesmo mandando o id do A", async () => {
    const r = await invite(await cookieFor(outro), { organizationId: orgA, email: `qa-y-${tag}@lexsion-qa.invalid`, role: "admin" });
    expect(r.status).toBe(403);
  });
  it("sem sessão: 401; origem estranha: 403; dados inválidos: 400", async () => {
    expect((await invite("", { organizationId: orgA, email: `qa-z-${tag}@lexsion-qa.invalid`, role: "advogado" })).status).toBe(401);
    const bad = await fetch(`${BASE}/api/equipe/convites`, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: "{}" });
    expect(bad.status).toBe(403);
    expect((await invite(await cookieFor(titular), { organizationId: orgA, email: "nao-e-email", role: "advogado" })).status).toBe(400);
  });
});
