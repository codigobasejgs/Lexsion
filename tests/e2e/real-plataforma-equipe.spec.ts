import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Super Admin (sintético) dá à conta de uma pessoa (sintética) o papel de Suporte sem o módulo Financeiro; a pessoa
// entra e só vê o que foi liberado; depois o acesso é revogado. Nada toca contas reais.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const SLOW = Number(process.env.SLOW ?? 20_000);
const tag = crypto.randomBytes(3).toString("hex");
const pw = () => `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
const sa = { email: `qa-psa-${tag}@lexsion-qa.invalid`, password: pw(), id: "" };
const staff = { email: `qa-pst-${tag}@lexsion-qa.invalid`, password: pw(), id: "" };
let admin: SupabaseClient;

test.describe.configure({ mode: "serial", timeout: 4 * SLOW });
test.skip(!ON, "Supabase não configurado neste ambiente");
async function login(page: Page, u: { email: string; password: string }) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/admin/, { timeout: SLOW });
}
test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  for (const u of [sa, staff]) u.id = (await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true })).data.user!.id;
  await admin.from("platform_members").insert({ user_id: sa.id, role: "superadmin", note: "QA E2E" }).throwOnError();
});
test.afterAll(async () => {
  if (!admin) return;
  await admin.from("platform_members").delete().in("user_id", [sa.id, staff.id]);
  await admin.from("audit_logs").delete().eq("entity", "platform_members").in("entity_id", [sa.id, staff.id]);
  for (const u of [sa, staff]) if (u.id) await admin.auth.admin.deleteUser(u.id);
});

test("PLAT-01: Super Admin dá papel de Suporte sem Financeiro; a pessoa vê só o liberado; revogar corta o acesso", async ({ page, browser, isMobile, viewport }) => {
  await login(page, sa);
  await page.goto("/admin/equipe");
  await page.getByLabel("E-mail da conta já cadastrada").fill(staff.email);
  await page.getByLabel(/Suporte LexSion|Suporte/).first().check();
  await page.getByRole("checkbox", { name: "Financeiro da plataforma" }).uncheck();
  await page.getByLabel("Motivo (fica na auditoria)").fill("QA: suporte sem financeiro");
  await page.getByRole("button", { name: "Dar acesso" }).click();
  await expect(page.getByRole("status")).toContainText(staff.email, { timeout: SLOW });
  await expect(page.getByTestId("equipe-plataforma")).toContainText(staff.email);
  // A pessoa entra: menu sem Financeiro e sem Equipe; URL direta do Financeiro bloqueada.
  const ctx = await browser.newContext({ viewport, isMobile });
  const p2 = await ctx.newPage();
  await login(p2, staff);
  // No celular o menu fica recolhido atrás de "Abrir menu".
  if ((viewport?.width ?? 1440) < 1024) await p2.getByRole("button", { name: "Abrir menu" }).click({ timeout: SLOW });
  const nav = p2.getByRole("navigation", { name: "Super Admin" }).locator("visible=true").first();
  await expect(nav.getByRole("link", { name: "Suporte" })).toBeVisible({ timeout: SLOW });
  await expect(nav.getByRole("link", { name: "Financeiro da plataforma" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Equipe da plataforma" })).toHaveCount(0);
  await p2.goto("/admin/faturamento");
  await expect(p2.getByTestId("modulo-bloqueado")).toBeVisible({ timeout: SLOW });
  // Servidor também recusa: ação de contratante com o módulo liberado passa pelo papel; Equipe da plataforma é negada.
  expect((await p2.request.post("/api/admin/contratos", { data: { action: "reconcile" } })).status()).toBe(403);
  await ctx.close();
  // Revogar.
  page.once("dialog", (d) => d.accept("QA: fim do teste de suporte"));
  await page.getByTestId("equipe-plataforma").locator("li", { hasText: staff.email }).getByRole("button", { name: "Revogar" }).click();
  await expect(page.getByRole("status")).toContainText("revogado", { timeout: SLOW });
  expect((await admin.from("platform_members").select("user_id").eq("user_id", staff.id)).data).toEqual([]);
});
