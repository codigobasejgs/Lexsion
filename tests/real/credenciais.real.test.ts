import fs from "node:fs";
import crypto from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// Rota de chaves do escritório contra build local + Supabase REAL + provedores REAIS (chaves FALSAS: o provedor
// recusa; nada é cobrado nem enviado). Confere permissões, cifra no banco e que a chave nunca volta na resposta.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = process.env.RUN_REAL === "1" && !!env.SUPABASE_SECRET_KEY;
const PORT = 3220, BASE = `http://localhost:${PORT}`;
const tag = crypto.randomBytes(3).toString("hex");
const CK = crypto.randomBytes(32).toString("base64");
let server: ChildProcess | undefined, admin: SupabaseClient;
const users: string[] = [], orgs: string[] = [];
const cookie: Record<string, string> = {};
async function login(email: string, password: string) {
  const jar = new Map<string, string>();
  const c = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((x) => jar.set(x.name, x.value)) } });
  await c.auth.signInWithPassword({ email, password });
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
const post = (who: string, body: object) => fetch(`${BASE}/api/integracoes/credenciais`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie[who], Origin: BASE }, body: JSON.stringify(body) });

describe.skipIf(!ON)("REAL — chaves de integração do escritório", () => {
  beforeAll(async () => {
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env: { ...process.env, ...env, CREDENTIALS_KEY: CK }, stdio: "ignore" });
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + "/entrar")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
    const mk = async (k: string) => { const email = `qa-cred${k}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`; const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true }); users.push(data.user!.id); return { id: data.user!.id, email, password }; };
    const [tit, fin, outro] = [await mk("tit"), await mk("fin"), await mk("outro")];
    for (const [slug, owner] of [[`qa-cred-a-${tag}`, tit.id], [`qa-cred-b-${tag}`, outro.id]] as const) {
      const { data } = await admin.from("organizations").insert({ slug, name: `QA Cred ${slug}` }).select("id").single().throwOnError();
      orgs.push(data!.id);
      await admin.from("organization_memberships").insert({ organization_id: data!.id, user_id: owner, role: "admin" }).throwOnError();
    }
    await admin.from("organization_memberships").insert({ organization_id: orgs[0], user_id: fin.id, role: "financeiro" }).throwOnError();
    cookie.tit = await login(tit.email, tit.password); cookie.fin = await login(fin.email, fin.password); cookie.outro = await login(outro.email, outro.password);
  }, 180_000);
  afterAll(async () => {
    server?.kill();
    if (!admin) return;
    if (orgs.length) { await admin.from("organizations").delete().in("id", orgs); await admin.from("audit_logs").delete().in("organization_id", orgs); }
    for (const u of users) await admin.auth.admin.deleteUser(u);
  }, 120_000);

  it.each([["asaas", "$aact_hmlg_000000000000000000000000falsa", "teste"], ["mercadopago", "APP_USR-0000000000000000-falsa", "producao"], ["zapsign", "token-falso-de-homologacao-lexsion", "teste"], ["gemini", "AIzaFalsaDeHomologacaoLexSion000000000", "producao"]])("%s: chave falsa ⇒ provedor real recusa; resposta não devolve a chave; banco guarda só cifrado", async (provider, secret, environment) => {
    const r = await post("tit", { organizationId: orgs[0], provider, action: "save", secret, environment });
    const body = await r.text();
    expect(r.status).toBe(200);
    expect(JSON.parse(body).data.status).toBe("recusada");
    expect(body).not.toContain(secret);
    const { data } = await admin.from("org_credentials").select("sealed,hint,status,environment").eq("organization_id", orgs[0]).eq("provider", provider).single();
    expect(data!.sealed).not.toContain(secret.slice(4, -4));
    expect(data!.hint).toBe(`••••${secret.slice(-4)}`);
    expect(data!.status).toBe("recusada");
    const list = await (await fetch(`${BASE}/api/integracoes/credenciais?org=${orgs[0]}`, { headers: { Cookie: cookie.tit } })).text();
    expect(list).not.toContain(secret);
    expect(list).not.toContain(data!.sealed);
  }, 60_000);
  it("InfinitePay: handle salva sem teste possível (estado honesto)", async () => {
    const j = await (await post("tit", { organizationId: orgs[0], provider: "infinitepay", action: "save", secret: "$escritorio-qa" })).json();
    expect(j.data.status).toBe("nao_verificavel");
  });
  it("financeiro do mesmo escritório e titular de outro escritório não configuram (403); sem sessão 403", async () => {
    expect((await post("fin", { organizationId: orgs[0], provider: "asaas", action: "save", secret: "x-y-z-falsa" })).status).toBe(403);
    expect((await post("outro", { organizationId: orgs[0], provider: "asaas", action: "remove" })).status).toBe(403);
    expect((await fetch(`${BASE}/api/integracoes/credenciais?org=${orgs[0]}`)).status).toBe(403);
    expect((await fetch(`${BASE}/api/integracoes/credenciais?org=${orgs[0]}`, { headers: { Cookie: cookie.outro } })).status).toBe(403);
  });
  it("remover apaga a chave", async () => {
    expect((await post("tit", { organizationId: orgs[0], provider: "zapsign", action: "remove" })).status).toBe(200);
    expect((await admin.from("org_credentials").select("provider").eq("organization_id", orgs[0]).eq("provider", "zapsign")).data).toEqual([]);
  });
});
