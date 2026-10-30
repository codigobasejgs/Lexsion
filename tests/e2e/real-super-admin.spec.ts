import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { passMfa } from "./totp";

// Super Admin REAL (Supabase de produção, dados sintéticos apagados no fim): fonte real × demo, lista, ficha 360º,
// teste grátis (conceder, prorrogar, persistência), cortesia sem receita, plano, papéis internos e titular bloqueado.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const SLOW = Number(process.env.SLOW ?? 30_000);
const tag = crypto.randomBytes(3).toString("hex");
type U = { id: string; email: string; password: string };
let admin: SupabaseClient, org = "", saSecret: string | undefined;
const people: Record<string, U> = {};
test.describe.configure({ mode: "serial", timeout: 8 * SLOW + 60_000 });
test.skip(!ON, "Supabase não configurado neste ambiente");

async function mkUser(key: string, name: string): Promise<U> {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ user_id: data.user.id, full_name: name }).throwOnError();
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U, dest: RegExp) {
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(dest, { timeout: SLOW });
}
// Lista real: no celular o card inteiro é o link; no desktop o nome na tabela.
const openOrg = async (page: Page) => { const card = page.getByTestId(`org-qa-sa-${tag}`).locator("visible=true").first(); await (await card.evaluate((e) => e.tagName === "A") ? card : card.getByRole("link").first()).click(); await page.waitForURL(/\/admin\/organizacoes\/[0-9a-f-]{36}/); };
const orgRow = async () => (await admin.from("organizations").select("status,plan,meta,updated_at").eq("id", org).single()).data!;

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  people.sa = await mkUser("sa-own", "QA Proprietário");
  people.tit = await mkUser("sa-tit", "QA Titular SA");
  await admin.from("platform_members").insert({ user_id: people.sa.id, role: "superadmin" }).throwOnError();
  org = (await admin.from("organizations").insert({ slug: `qa-sa-${tag}`, name: `QA Super Admin ${tag}`, status: "ativa", meta: { origem: "qa" } }).select("id").single().throwOnError()).data!.id;
  await admin.from("organization_memberships").insert({ organization_id: org, user_id: people.tit.id, role: "admin" }).throwOnError();
});
test.afterAll(async () => {
  if (!admin) return;
  await admin.from("organizations").delete().eq("id", org);
  await admin.from("audit_logs").delete().eq("organization_id", org);
  await admin.from("platform_members").delete().eq("user_id", people.sa?.id ?? "");
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("SA-01: /admin real mostra 'Dados reais' (nunca a tarja da demonstração) e o escritório do banco aparece na lista", async ({ page }) => {
  await login(page, people.sa, /\/admin/);
  saSecret = await passMfa(page, saSecret);
  await expect(page.getByTestId("faixa-ambiente")).toContainText("Dados reais");
  await expect(page.getByTestId("fonte-real")).toBeVisible();
  await expect(page.getByText("dados fictícios da demonstração")).toHaveCount(0);
  await page.goto("/admin/organizacoes");
  await expect(page.getByTestId(`org-qa-sa-${tag}`).locator("visible=true").first()).toBeVisible();
});

test("SA-02: conceder 14 dias de teste e prorrogar +7 pela ficha; persiste no banco, após recarregar e com auditoria", async ({ page }) => {
  await login(page, people.sa, /\/admin/);
  saSecret = await passMfa(page, saSecret);
  await page.goto("/admin/organizacoes");
  await openOrg(page);
  await page.getByRole("button", { name: "Teste grátis" }).click();
  let d = page.getByRole("dialog");
  await d.getByRole("radio", { name: "Conceder" }).check();
  await d.getByLabel("Outro (1–365)").fill("14");
  await d.getByLabel(/Motivo/).fill("QA: teste inicial de 14 dias");
  await d.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Teste atualizado" })).toBeVisible({ timeout: SLOW });
  const first = Date.parse((await orgRow()).meta.trialEndsAt as string);
  expect(Math.round((first - Date.now()) / 86_400_000)).toBeGreaterThanOrEqual(14);
  await page.reload();
  await page.getByRole("button", { name: "Estender teste" }).click();
  d = page.getByRole("dialog");
  await d.getByRole("button", { name: "+7 dias" }).click();
  await d.getByLabel(/Motivo/).fill("QA: prorrogação de 7 dias");
  await d.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(async () => Math.round((Date.parse((await orgRow()).meta.trialEndsAt as string) - first) / 86_400_000), { timeout: SLOW }).toBe(7);
  expect((await orgRow()).status).toBe("trial");
  const { data: g } = await admin.from("saas_trial_grants").select("kind,reason").eq("organization_id", org).order("created_at");
  expect(g?.map((x) => x.kind)).toEqual(["concessao", "extensao"]);
  await page.getByRole("tab", { name: "Histórico e auditoria" }).click();
  await expect(page.getByTestId("ficha-historico")).toContainText("QA: prorrogação de 7 dias");
});

test("SA-03: cortesia não vira receita; alterar plano não cria cobrança", async ({ page }) => {
  await login(page, people.sa, /\/admin/);
  saSecret = await passMfa(page, saSecret);
  await page.goto(`/admin/organizacoes/${org}`);
  await page.getByRole("button", { name: "Cortesia" }).click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Válida até").fill(new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10));
  await d.getByLabel(/Motivo/).fill("QA: parceria institucional");
  await d.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(async () => (await orgRow()).status, { timeout: SLOW }).toBe("ativa");
  // O banco grava antes de o modal fechar: espera a confirmação na tela (modal fechado) antes da próxima ação.
  await expect(page.getByRole("status").filter({ hasText: "Cortesia atualizada" })).toBeVisible({ timeout: SLOW });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Alterar plano" }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Novo plano").selectOption("profissional");
  await d.getByLabel(/Motivo/).fill("QA: upgrade administrativo");
  await d.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(async () => (await orgRow()).plan, { timeout: SLOW }).toBe("profissional");
  expect((await admin.from("saas_orders").select("id").eq("organization_id", org)).data ?? []).toEqual([]);
  await page.goto("/admin");
  await expect(page.getByTestId("fonte-real")).toBeVisible();
  await expect(page.getByText(/Cortesias vigentes/)).toBeVisible();
});

test("SA-04: titular do escritório não executa ações da plataforma nem abre /admin", async ({ page, request }) => {
  const tit = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await tit.auth.signInWithPassword({ email: people.tit.email, password: people.tit.password });
  expect((await tit.rpc("platform_trial", { p_org: org, p_op: "prorrogar", p_days: 30, p_until: null, p_reason: "Autoprorrogação indevida", p_expected: null, p_key: null })).error?.message).toMatch(/sem permissão/);
  expect((await tit.rpc("platform_orgs")).error?.message).toMatch(/somente a plataforma/);
  expect((await request.post("/api/admin/operacoes", { data: { action: "status", org, status: "suspensa", reason: "anônimo tentando" } })).status()).toBe(401);
  await login(page, people.tit, /\/app\//);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin/);
});
