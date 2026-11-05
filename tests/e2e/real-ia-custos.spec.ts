import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Controle financeiro da IA no Super Admin (sintético): painel mostra o bloqueio do OCR, o teto e os preços oficiais;
// a confirmação de faturamento exige evidência e fica na auditoria; desfeito no fim (estado original restaurado).
// Nenhuma chamada ao Google é feita.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const SLOW = Number(process.env.SLOW ?? 20_000);
const tag = crypto.randomBytes(3).toString("hex");
const sa = { email: `qa-iac-${tag}@lexsion-qa.invalid`, password: `Qa${crypto.randomBytes(12).toString("base64url")}7x`, id: "" };
let admin: SupabaseClient;
let before: Record<string, unknown> | null = null;

test.describe.configure({ mode: "serial" });
test.skip(!ON, "Supabase não configurado neste ambiente");
async function login(page: Page) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(sa.email);
  await page.getByLabel("Senha", { exact: true }).fill(sa.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/admin/, { timeout: SLOW });
}
test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  before = (await admin.from("ai_settings").select("ocr_enabled,billing_confirmed_at,billing_confirmed_by,billing_note").single()).data;
  sa.id = (await admin.auth.admin.createUser({ email: sa.email, password: sa.password, email_confirm: true })).data.user!.id;
  await admin.from("platform_members").insert({ user_id: sa.id, role: "superadmin", note: "QA E2E IA" }).throwOnError();
});
test.afterAll(async () => {
  if (!admin) return;
  if (before) await admin.from("ai_settings").update(before).eq("id", true);
  await admin.from("audit_logs").delete().eq("actor_id", sa.id);
  await admin.from("platform_members").delete().eq("user_id", sa.id);
  if (sa.id) await admin.auth.admin.deleteUser(sa.id);
});

test("IAC-01: painel de IA mostra OCR bloqueado, teto e preços; ligar exige faturamento confirmado com evidência", async ({ page }) => {
  await login(page);
  await page.goto("/admin/faturamento");
  const panel = page.getByTestId("ia-custos");
  await expect(panel.getByText("Inteligência artificial: consumo e limites")).toBeVisible({ timeout: SLOW });
  await expect(panel.getByText("Bloqueada", { exact: true })).toBeVisible();
  await expect(panel.getByText(/gemini-2\.5-flash-lite: entrada US\$ 0,10|gemini-2\.5-flash-lite: entrada US\$ 0\.10/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Ligar OCR" })).toBeDisabled();
  await panel.getByRole("button", { name: "Confirmar faturamento" }).click();
  await expect(panel.getByText(/pelo menos 10 caracteres/)).toBeVisible({ timeout: SLOW });
  await panel.getByLabel("Evidência (projeto, conta de faturamento, data)").fill("QA automatizado — sem faturamento real");
  await panel.getByRole("button", { name: "Confirmar faturamento" }).click();
  await expect(panel.getByText("Faturamento confirmado e registrado na auditoria.")).toBeVisible({ timeout: SLOW });
  await panel.getByRole("button", { name: "Ligar OCR" }).click();
  await expect(panel.getByText("Ligada", { exact: true })).toBeVisible({ timeout: SLOW });
  await panel.getByRole("button", { name: "Retirar confirmação" }).click();
  await expect(panel.getByText("Bloqueada", { exact: true })).toBeVisible({ timeout: SLOW });
  const { data } = await admin.from("audit_logs").select("action").eq("actor_id", sa.id).order("at");
  expect((data ?? []).map((x) => x.action).sort()).toEqual(["ia.billing", "ia.billing", "ia.ocr"]);
  const { data: s } = await admin.from("ai_settings").select("ocr_enabled,billing_confirmed_at").single();
  expect(s).toEqual({ ocr_enabled: false, billing_confirmed_at: null }); // retirar a confirmação desliga o OCR
});

test("IAC-02: teto da plataforma não aceita ficar sem valor (consumo irrestrito bloqueado)", async ({ page }) => {
  await login(page);
  await page.goto("/admin/faturamento");
  const panel = page.getByTestId("ia-custos");
  const cap = panel.getByLabel("Teto Plataforma (todos)");
  await expect(cap).toBeVisible({ timeout: SLOW });
  const original = await cap.inputValue();
  await cap.fill("");
  await panel.getByRole("row", { name: /Plataforma \(todos\)/ }).getByRole("button", { name: "Salvar" }).click();
  await expect(panel.getByText(/consumo irrestrito não é permitido/)).toBeVisible({ timeout: SLOW });
  const { data } = await admin.from("ai_budgets").select("monthly_usd").eq("scope", "plataforma").single();
  expect(Number(data!.monthly_usd)).toBe(Number(original));
});
