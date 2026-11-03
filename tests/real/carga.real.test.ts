import fs from "node:fs";
import crypto from "node:crypto";
import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

// QA34 — carga e concorrência representativas (escritório pequeno): rajada de webhooks com reentregas e várias
// pessoas mudando o modo da mesma conversa ao mesmo tempo. Build local + Supabase REAL; Evolution/Gemini simulados.
// Registra volume, erros e latências (p50/p95) no console. RUN_REAL=1 e `pnpm build` antes.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = process.env.RUN_REAL === "1" && !!env.SUPABASE_SECRET_KEY;
const PORT = 3219, EVO = 3293, GEM = 3294;
const BASE = `http://localhost:${PORT}`;
const tag = crypto.randomBytes(3).toString("hex");
const SECRET = crypto.randomBytes(24).toString("base64url");
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const sent: string[] = [];
const mocks: http.Server[] = [];
let server: ChildProcess | undefined;
let admin: SupabaseClient;
let org = "", user = "", cookie = "";
const inst = `lexsion-qa-load-${tag}`;
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
const timed = async (fn: () => Promise<Response>) => { const t = performance.now(); const r = await fn(); return { status: r.status, ms: performance.now() - t, body: await r.text() }; };

describe.skipIf(!ON)("REAL — carga e concorrência do atendimento (QA34)", () => {
  beforeAll(async () => {
    admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    const listen = (port: number, h: http.RequestListener) => new Promise<void>((r) => { const s = http.createServer(h); mocks.push(s); s.listen(port, "127.0.0.1", () => r()); });
    await listen(EVO, (req, res) => {
      let b = ""; req.on("data", (d) => (b += d)).on("end", () => {
        if (req.url?.startsWith("/instance/connectionState/")) return res.end(JSON.stringify({ instance: { state: "open" } }));
        if (req.url?.startsWith("/message/sendText/")) { sent.push(JSON.parse(b).number); return res.end(JSON.stringify({ key: { id: `L${sent.length}${tag}` } })); }
        res.statusCode = 404; res.end("{}");
      });
    });
    await listen(GEM, (req, res) => { req.resume(); req.on("end", () => res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Olá! Sou a assistente virtual." }] } }] }))); });
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
      env: { ...process.env, ...env, WHATSAPP_ENABLED: "1", AI_ENABLED: "1", EVOLUTION_URL: `http://127.0.0.1:${EVO}`, EVOLUTION_API_KEY: "chave-falsa-do-provedor-simulado-qa", GEMINI_API_BASE: `http://127.0.0.1:${GEM}`, GEMINI_API_KEY: "chave-falsa-do-provedor-simulado-qa", AI_DEBOUNCE_MS: "300", HTTPS_PROXY: "", HTTP_PROXY: "", NODE_USE_ENV_PROXY: "" },
      stdio: "ignore",
    });
    for (let i = 0; i < 80; i++) { try { if ((await fetch(BASE + "/entrar")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
    const email = `qa-load-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
    user = (await admin.auth.admin.createUser({ email, password, email_confirm: true })).data.user!.id;
    org = (await admin.from("organizations").insert({ slug: `qa-load-${tag}`, name: `QA Carga ${tag}`, ai_enabled_at: new Date().toISOString() }).select("id").single().throwOnError()).data!.id;
    await admin.from("organization_memberships").insert({ organization_id: org, user_id: user, role: "admin" }).throwOnError();
    await admin.from("whatsapp_instances").insert({ organization_id: org, instance_name: inst, status: "operacional", webhook_secret_hash: sha(SECRET) }).throwOnError();
    const pub = { name: "QA", objective: "", tone: "", rules: [], steps: [], faq: [], requestedDocs: [], hours: "", handoff: [], knowledge: "", version: 1 };
    await admin.from("org_records").insert({ organization_id: org, collection: "agents", id: `ag-${tag}`, data: { id: `ag-${tag}`, organizationId: org, ...pub, status: "publicado", published: pub, versions: [], usage: { conversations: 0, handoffs: 0 }, areas: [], tools: [], approvalRequired: [] } }).throwOnError();
    const jar = new Map<string, string>();
    const c = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((x) => jar.set(x.name, x.value)) } });
    await c.auth.signInWithPassword({ email, password });
    cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }, 180_000);
  afterAll(async () => {
    server?.kill();
    for (const s of mocks) s.close();
    if (!admin) return;
    if (org) { await admin.from("organizations").delete().eq("id", org); await admin.from("audit_logs").delete().eq("organization_id", org); }
    if (user) await admin.auth.admin.deleteUser(user);
  }, 120_000);

  it("rajada: 25 contatos + 25 reentregas simultâneas ⇒ 25 conversas, 25 mensagens, 25 respostas, 0 duplicadas", async () => {
    const evs = Array.from({ length: 25 }, (_, i) => ({ event: "messages.upsert", instance: inst, data: { key: { id: `LD${i}${tag}`, remoteJid: `55119100${String(i).padStart(5, "0")}@s.whatsapp.net`, fromMe: false }, pushName: `Contato ${i}`, message: { conversation: `mensagem ${i}` }, messageTimestamp: Math.floor(Date.now() / 1000) } }));
    const t0 = performance.now();
    const res = await Promise.all([...evs, ...evs].map((e) => timed(() => fetch(`${BASE}/api/whatsapp/webhook?org=${org}&s=${SECRET}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e) }))));
    const lat = res.map((r) => r.ms);
    console.log(`QA34 webhook: ${res.length} pedidos em ${Math.round(performance.now() - t0)} ms; status ${JSON.stringify(res.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {} as Record<number, number>))}; p50 ${Math.round(pct(lat, 50))} ms, p95 ${Math.round(pct(lat, 95))} ms, máx ${Math.round(Math.max(...lat))} ms`);
    expect(res.every((r) => r.status === 200)).toBe(true);
    const done = async () => (await admin.from("org_records").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("collection", "messages").contains("data", { author: "ia", status: "enviada" })).count ?? 0;
    const end = Date.now() + 90_000;
    while ((await done()) < 25 && Date.now() < end) await new Promise((r) => setTimeout(r, 1000));
    const t1 = performance.now();
    const count = async (col: string, filter: Record<string, unknown>) => (await admin.from("org_records").select("id", { count: "exact", head: true }).eq("organization_id", org).eq("collection", col).contains("data", filter)).count;
    const [convs, inbound, ai, evRows] = [await count("conversations", { channel: "whatsapp" }), await count("messages", { author: "contato" }), await count("messages", { author: "ia" }), (await admin.from("wa_events").select("id", { count: "exact", head: true }).eq("organization_id", org)).count];
    console.log(`QA34 resultado: eventos ${evRows}, conversas ${convs}, entradas ${inbound}, respostas IA ${ai}, envios ao provedor ${sent.length}; tudo processado em ${Math.round((t1 - t0) / 1000)} s`);
    expect([evRows, convs, inbound, ai, sent.length]).toEqual([25, 25, 25, 25, 25]);
    expect(new Set(sent).size).toBe(25);
  }, 240_000);

  it("concorrência: 20 trocas de modo simultâneas na mesma conversa ⇒ versão = 1 + nº de sucessos, sem erro 500", async () => {
    const conv = (await admin.from("org_records").select("id").eq("organization_id", org).eq("collection", "conversations").limit(1).single()).data!.id;
    const v0 = (await admin.from("conversation_control").select("version").eq("organization_id", org).eq("conversation_id", conv).single()).data!.version as number;
    const res = await Promise.all(Array.from({ length: 20 }, (_, i) => timed(() => fetch(`${BASE}/api/whatsapp`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie, Origin: BASE }, body: JSON.stringify({ organizationId: org, action: "mode", conversationId: conv, mode: i % 2 ? "ia" : "humano" }) }))));
    const ok = res.filter((r) => r.status === 200).length;
    const lat = res.map((r) => r.ms);
    console.log(`QA34 modo: 20 pedidos; ${ok} aplicados; status ${JSON.stringify(res.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {} as Record<number, number>))}; p50 ${Math.round(pct(lat, 50))} ms, p95 ${Math.round(pct(lat, 95))} ms`);
    expect(res.some((r) => r.status >= 500)).toBe(false);
    const v1 = (await admin.from("conversation_control").select("version").eq("organization_id", org).eq("conversation_id", conv).single()).data!.version as number;
    expect(v1 - v0).toBe(ok); // cada troca aplicada incrementou exatamente uma vez (trava de linha)
  }, 120_000);
});
