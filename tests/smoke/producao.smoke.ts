import { expect, test } from "@playwright/test";

// Fumaça contra o ambiente publicado (SMOKE_URL). Só leitura e fluxos demonstrativos; nenhum dado real.
test("PROD-01: entrada LexSion, login demo, Meu dia e Super Admin", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demonstracao");
  await expect(page).toHaveTitle(/LexSion/);
  await expect(page.getByRole("img", { name: /LexSion/ }).first()).toBeVisible();
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await expect(page.getByRole("heading", { name: /Olá, Helena/ })).toBeVisible();
  await page.goto("/demo/tenant/atlas-juridico");
  await page.waitForURL(/\/app\/inicio/);
  await expect(page.locator("html")).toHaveAttribute("data-tenant", "atlas-juridico");
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: /Suporte LexSion/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await expect(page.getByRole("heading", { name: "Painel geral" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("PROD-02: service worker registra e o app abre offline após visita", async ({ page, context }) => {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app\/inicio/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto("/app/inicio");
  await expect(page.getByRole("heading", { name: /Olá, Helena/ })).toBeVisible();
  await context.setOffline(false);
});

// PROD-03 (QA35): operação REAL na versão publicada com escritório e titular SINTÉTICOS (qa-…@lexsion-qa.invalid),
// criados e apagados aqui. Login real, escrita e leitura no banco, isolamento, gates das integrações e rotas protegidas.
import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
test("PROD-03: login real, escrita/leitura controlada, isolamento e saúde das integrações", async ({ page, request }, info) => {
  test.skip(!env.SUPABASE_SECRET_KEY || info.project.name !== "prod-desktop", "só desktop e com chave do servidor");
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const tag = crypto.randomBytes(3).toString("hex"), email = `qa-smoke-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const uid = (await admin.auth.admin.createUser({ email, password, email_confirm: true })).data.user!.id;
  const org = (await admin.from("organizations").insert({ slug: `qa-smoke-${tag}`, name: `QA Smoke ${tag}`, status: "trial" }).select("id").single().throwOnError()).data!.id as string;
  try {
    await admin.from("organization_memberships").insert({ organization_id: org, user_id: uid, role: "admin" }).throwOnError();
    // Saúde e gates (sem sessão): integrações que tratam dados de clientes respondem o estado; webhook/cron protegidos.
    const estado = await (await request.get("/api/integracoes/estado")).json();
    expect(typeof estado.ai === "boolean" && typeof estado.whatsapp === "boolean").toBe(true);
    expect((await request.post("/api/whatsapp/webhook?org=x&s=y")).status()).toBe(estado.whatsapp ? 401 : 503);
    expect((await request.get("/api/cron/atendimento")).status()).toBe(401);
    expect((await request.post("/api/admin/contratos", { data: { action: "reconcile" } })).status()).toBe(401);
    // Login real e escrita controlada pela tela.
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(/\/app\/inicio/, { timeout: 45_000 });
    await expect(page.getByText("Ambiente demonstrativo")).toHaveCount(0);
    await page.goto("/app/clientes/novo");
    await page.getByLabel("Nome completo").fill(`Cliente Smoke ${tag}`);
    await page.getByLabel("CPF").pressSequentially("52998224725"); // fictício com dígitos válidos; campo com máscara
    await page.getByLabel("Telefone (WhatsApp)").fill("(71) 99999-0002");
    await page.getByLabel("Cidade").fill("Salvador");
    // Escritório novo: o único responsável possível é o próprio titular (já selecionado por padrão).
    await page.getByRole("button", { name: /Salvar|Cadastrar/ }).first().click();
    await expect.poll(async () => (await admin.from("org_records").select("id").eq("organization_id", org).eq("collection", "clients").contains("data", { name: `Cliente Smoke ${tag}` })).data?.length ?? 0, { timeout: 45_000 }).toBe(1);
    // Leitura em outro contexto (nova sessão) e isolamento: anônimo não lê; o escritório só vê o próprio registro.
    const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    await s.auth.signInWithPassword({ email, password });
    const mine = await s.from("org_records").select("organization_id").eq("collection", "clients");
    expect(mine.error).toBeNull();
    expect(new Set((mine.data ?? []).map((r) => r.organization_id))).toEqual(new Set([org]));
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    expect((await anon.from("org_records").select("id").limit(1)).error?.message).toMatch(/permission denied/);
    // Titular não abre o painel da plataforma.
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin$/);
  } finally {
    await admin.from("organizations").delete().eq("id", org);
    await admin.from("audit_logs").delete().eq("organization_id", org);
    await admin.auth.admin.deleteUser(uid);
  }
});
