import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Integrações REAIS (IA Gemini e WhatsApp Evolution) com escritório sintético. Nenhuma mensagem é enviada a pessoa real:
// o WhatsApp de teste nunca é pareado (só QR gerado), o envio é testado até a recusa "desconectado", e a instância QA é apagada.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.GEMINI_API_KEY && !!env.EVOLUTION_API_KEY;
const SLOW = Number(process.env.SLOW ?? 30_000);
const tag = crypto.randomBytes(3).toString("hex");
const slug = `qa-int-${tag}`;
type U = { id: string; email: string; password: string };
let admin: SupabaseClient;
let org = "";
const people: Record<string, U> = {};

test.describe.configure({ mode: "serial", timeout: 4 * SLOW + 60_000 });
test.skip(!ON, "integrações não configuradas neste ambiente");

async function mkUser(key: string, name: string): Promise<U> {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ user_id: data.user.id, full_name: name }).throwOnError();
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\/inicio/, { timeout: SLOW });
}
const evo = (method: string, path: string) => fetch(`${env.EVOLUTION_URL}${path}`, { method, headers: { apikey: env.EVOLUTION_API_KEY } });

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  people.tit = await mkUser("itit", "QA Titular Integrações");
  people.est = await mkUser("iest", "QA Estagiário Integrações");
  const { data } = await admin.from("organizations").insert({ slug, name: `QA Integrações ${tag}`, status: "trial" }).select("id").single().throwOnError();
  org = data!.id;
  await admin.from("organization_memberships").insert([{ organization_id: org, user_id: people.tit.id, role: "admin" }, { organization_id: org, user_id: people.est.id, role: "estagiario" }]).throwOnError();
});

test.afterAll(async () => {
  if (!admin) return;
  await evo("DELETE", `/instance/delete/lexsion-${slug}`).catch(() => null);
  await admin.from("organizations").delete().eq("id", org);
  await admin.from("audit_logs").delete().eq("organization_id", org);
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("IA-01: sem habilitação do titular a IA recusa; titular habilita; sugestão real do Gemini marcada para revisão; uso registrado sem conteúdo", async ({ page }) => {
  await login(page, people.est);
  const r0 = await page.evaluate(async (o) => (await fetch("/api/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: o, purpose: "resumo", context: "Texto sintético de teste para resumo." }) })).status, org);
  expect(r0).toBe(412);
  await page.locator("summary", { hasText: "Menu do usuário" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/entrar/, { timeout: SLOW });

  await login(page, people.tit);
  await page.goto("/app/ia/assistente");
  await page.getByRole("button", { name: "Habilitar IA" }).click();
  await expect(page.getByText("Habilitada para este escritório.")).toBeVisible({ timeout: SLOW });
  await page.getByLabel("Finalidade").selectOption("resumo");
  await page.getByLabel(/Texto \(até/).fill("Cliente sintético, 62 anos, trabalhou 20 anos com carteira assinada e pediu aposentadoria por idade em janeiro. O INSS negou alegando falta de carência. Ele tem a CTPS completa.");
  await page.getByRole("button", { name: "Gerar sugestão" }).click();
  await expect(page.getByText("Sugestão da IA — revise antes de usar")).toBeVisible({ timeout: 90_000 });
  const out = await page.locator("pre").innerText();
  expect(out.length).toBeGreaterThan(20);
  const { data: use } = await admin.from("ai_usage").select("purpose,model,input_chars,output_chars").eq("organization_id", org);
  expect(use?.length).toBe(1);
  expect(Object.keys(use![0]).sort()).toEqual(["input_chars", "model", "output_chars", "purpose"]); // sem conteúdo
  const { data: au } = await admin.from("audit_logs").select("detail").eq("organization_id", org).eq("action", "ai");
  expect(au?.[0]?.detail).toMatch(/habilitada/);
});

test("WA-01: titular gera QR real da instância lexsion-<slug>; estagiário não conecta; envio sem pareamento é recusado (nada sai)", async ({ page }) => {
  await login(page, people.tit);
  await page.goto("/app/integracoes/evolution");
  await page.getByRole("button", { name: "Gerar QR" }).click();
  await expect(page.getByRole("img", { name: "QR para conectar o WhatsApp do escritório" })).toBeVisible({ timeout: 60_000 });
  const st = await (await evo("GET", `/instance/connectionState/lexsion-${slug}`)).json();
  expect(["connecting", "close"]).toContain(st?.instance?.state);
  const { data: inst } = await admin.from("whatsapp_instances").select("instance_name,status").eq("organization_id", org).single();
  expect(inst!.instance_name).toBe(`lexsion-${slug}`);

  // Mensagem da equipe gravada numa conversa sintética; despacho recusado porque o número não está pareado.
  const conv = { id: `conv-${tag}`, organizationId: org, contactName: "Contato QA", phone: "+55 71 90000-0000", channel: "whatsapp", status: "aguardando_equipe", aiActive: false, unread: 0, lastMessageAt: new Date().toISOString(), summary: "", missingDocs: [], tags: [] };
  const msg = { id: `msg-${tag}`, organizationId: org, conversationId: conv.id, author: "equipe", text: "Teste QA (não enviado)", at: new Date().toISOString(), status: "fila" };
  await admin.from("org_records").insert([{ organization_id: org, collection: "conversations", id: conv.id, data: conv }, { organization_id: org, collection: "messages", id: msg.id, data: msg }]).throwOnError();
  const r = await page.evaluate(async ({ o, c, m }) => { const x = await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: o, action: "send", conversationId: c, messageId: m }) }); return { s: x.status, j: await x.json() }; }, { o: org, c: conv.id, m: msg.id });
  expect(r.s).toBe(409);
  expect(r.j.error.code).toBe("disconnected");

  await page.locator("summary", { hasText: "Menu do usuário" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/entrar/, { timeout: SLOW });
  await login(page, people.est);
  const c2 = await page.evaluate(async (o) => (await fetch("/api/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: o, action: "connect" }) })).status, org);
  expect(c2).toBe(403);
});

test("WA-02: webhook aceita só o segredo do escritório, grava a mensagem recebida uma única vez e ignora instância alheia", async ({ request }) => {
  // Segredo novo só para o teste: substitui o hash (o segredo real nunca sai do servidor).
  const secret = crypto.randomBytes(24).toString("base64url");
  await admin.from("whatsapp_instances").update({ webhook_secret_hash: crypto.createHash("sha256").update(secret).digest("hex") }).eq("organization_id", org).throwOnError();
  const ev = (id: string, instance = `lexsion-${slug}`) => ({ event: "messages.upsert", instance, data: { key: { id, remoteJid: "5571988887777@s.whatsapp.net", fromMe: false }, pushName: "Contato Webhook QA", message: { conversation: "Olá, quero saber do meu processo (teste)" }, messageTimestamp: Math.floor(Date.now() / 1000) } });
  expect((await request.post(`/api/whatsapp/webhook?org=${org}&s=errado-errado-errado-errado`, { data: ev("A1") })).status()).toBe(401);
  expect((await request.post(`/api/whatsapp/webhook?org=${org}&s=${secret}`, { data: ev("A1") })).status()).toBe(200);
  expect((await request.post(`/api/whatsapp/webhook?org=${org}&s=${secret}`, { data: ev("A1") })).status()).toBe(200); // reentrega
  expect((await request.post(`/api/whatsapp/webhook?org=${org}&s=${secret}`, { data: ev("B2", "tubarao-qualquer") })).status()).toBe(200); // ignorado
  const { data: msgs } = await admin.from("org_records").select("id,data").eq("organization_id", org).eq("collection", "messages").like("id", "wa-%");
  expect(msgs?.map((m) => m.id)).toEqual(["wa-A1"]);
  const { data: convs } = await admin.from("org_records").select("data").eq("organization_id", org).eq("collection", "conversations");
  expect(convs?.some((c) => (c.data as { contactName: string }).contactName === "Contato Webhook QA")).toBe(true);
});
