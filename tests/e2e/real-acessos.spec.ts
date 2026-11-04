import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Titular cria, pela TELA, o login de uma pessoa da equipe (e-mail sem caixa de entrada + senha) e a pessoa entra.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const SLOW = Number(process.env.SLOW ?? 20_000);
const tag = crypto.randomBytes(3).toString("hex");
let admin: SupabaseClient, org = "", titId = "";
const tit = { email: `qa-acet-${tag}@lexsion-qa.invalid`, password: `Qa${crypto.randomBytes(12).toString("base64url")}7x` };

test.describe.configure({ mode: "serial" });
test.skip(!ON, "Supabase não configurado neste ambiente");
async function login(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\//, { timeout: SLOW });
}
test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  titId = (await admin.auth.admin.createUser({ ...tit, email_confirm: true })).data.user!.id;
  await admin.from("profiles").upsert({ user_id: titId, full_name: "QA Titular Acessos" });
  org = (await admin.from("organizations").insert({ slug: `qa-acet-${tag}`, name: `QA Acessos Tela ${tag}`, status: "trial" }).select("id").single().throwOnError()).data!.id;
  await admin.from("organization_memberships").insert({ organization_id: org, user_id: titId, role: "admin" }).throwOnError();
});
test.afterAll(async () => {
  if (!admin) return;
  const { data: m } = await admin.from("organization_memberships").select("user_id").eq("organization_id", org);
  await admin.from("organizations").delete().eq("id", org);
  await admin.from("audit_logs").delete().eq("organization_id", org);
  for (const u of new Set([titId, ...(m ?? []).map((x) => x.user_id)])) await admin.auth.admin.deleteUser(u).catch(() => null);
});

test("ACESSO-01: titular cria o login da equipe pela tela; a pessoa entra com a senha e vê o escritório", async ({ page, browser }) => {
  await login(page, tit.email, tit.password);
  await page.goto("/app/equipe");
  const box = page.getByTestId("acessos-equipe");
  await expect(box).toBeVisible({ timeout: SLOW });
  const email = `joana-${tag}@lexsion-qa.invalid`;
  await box.getByLabel("Nome").fill("Joana QA Estagiária");
  await box.getByLabel("E-mail de login").fill(email);
  await box.getByRole("button", { name: "Gerar" }).click();
  const password = await box.getByLabel("Senha").inputValue();
  expect(password.length).toBeGreaterThanOrEqual(10);
  await box.getByLabel("Perfil").selectOption("estagiario");
  await box.getByRole("button", { name: "Criar acesso" }).click();
  await expect(box.getByTestId("acesso-criado")).toContainText(password, { timeout: SLOW });
  await expect(box.getByText("Joana QA Estagiária")).toBeVisible({ timeout: SLOW });
  // A pessoa entra em outro navegador, sem e-mail nenhum.
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await login(p2, email, password);
  await expect(p2.getByRole("heading", { name: "Olá, Joana" })).toBeVisible({ timeout: SLOW });
  await expect(p2.getByRole("link", { name: new RegExp(`QA Acessos Tela ${tag}`) })).toHaveCount(1);
  await other.close();
});
