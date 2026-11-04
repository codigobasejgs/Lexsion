import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Assistente virtual na operação REAL (Supabase do projeto), com a IA DESLIGADA na plataforma (estado de produção):
// criar pelo assistente passo a passo, salvar rascunho, publicar (versão congelada), isolamento entre escritórios e
// simulador avisando que a IA está desligada. Pessoas e escritórios sintéticos, apagados no fim.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const tag = crypto.randomBytes(3).toString("hex");
const SLOW = Number(process.env.SLOW ?? 20_000);
type U = { id: string; email: string; password: string };
let admin: SupabaseClient;
let orgA = "", orgB = "";
const people: Record<string, U> = {};

test.describe.configure({ mode: "serial" });
test.skip(!ON, "Supabase não configurado neste ambiente");

async function mkUser(key: string): Promise<U> {
  const email = `qa-ast${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\//, { timeout: SLOW });
}

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  [people.tit, people.titB] = [await mkUser("tit"), await mkUser("titb")];
  for (const [slug, owner] of [[`qa-ast-a-${tag}`, people.tit.id], [`qa-ast-b-${tag}`, people.titB.id]] as const) {
    const { data } = await admin.from("organizations").insert({ slug, name: `QA Assistente ${slug.slice(-8)}`, status: "trial" }).select("id").single().throwOnError();
    await admin.from("organization_memberships").insert({ organization_id: data!.id, user_id: owner, role: "admin" }).throwOnError();
    if (owner === people.tit.id) orgA = data!.id; else orgB = data!.id;
  }
});
test.afterAll(async () => {
  if (!admin) return;
  await admin.from("organizations").delete().in("id", [orgA, orgB].filter(Boolean));
  await admin.from("audit_logs").delete().in("organization_id", [orgA, orgB].filter(Boolean));
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("AST-01: titular cria a assistente, salva rascunho e publica; versão publicada fica congelada no banco", async ({ page, isMobile }) => {
  await login(page, people.tit);
  await page.goto("/app/ia/agentes");
  await expect(page.getByText("Ambiente demonstrativo")).toHaveCount(0);
  await expect(page.getByText("Nenhuma assistente ainda")).toBeVisible({ timeout: SLOW });
  await page.getByRole("button", { name: "Nova assistente" }).click();
  const d = page.getByRole("dialog", { name: "Nova assistente virtual" });
  await d.getByLabel("Nome").fill("Assistente QA");
  await d.getByLabel("Coleta de documentos").check();
  await d.getByRole("button", { name: "Criar rascunho" }).click();
  await page.waitForURL(/\/app\/ia\/agentes\/agents-/, { timeout: SLOW });
  // Celular: as seções viram um seletor; computador: abas.
  if (isMobile) await page.getByLabel("Seção").selectOption("conhecimento");
  else await page.getByRole("tab", { name: "Base de conhecimento" }).click();
  await page.getByLabel("Base de conhecimento do escritório").fill(`Endereço: Rua QA, 1. Código ${tag}.`);
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText(/Rascunho salvo/)).toBeVisible({ timeout: SLOW });
  await page.getByRole("button", { name: "Publicar versão" }).click();
  await expect(page.getByText(/Versão publicada/)).toBeVisible({ timeout: SLOW });
  await expect.poll(async () => {
    const { data } = await admin.from("org_records").select("data").eq("organization_id", orgA).eq("collection", "agents");
    const a = data?.[0]?.data as { status?: string; published?: { knowledge?: string; version?: number }; version?: number } | undefined;
    return a?.status === "publicado" && a.published?.knowledge?.includes(tag) && a.published.version === a.version;
  }, { timeout: SLOW }).toBe(true);
});

test("AST-02: escritório B não vê a assistente do A (lista vazia e acesso direto negado)", async ({ page }) => {
  const { data } = await admin.from("org_records").select("id").eq("organization_id", orgA).eq("collection", "agents");
  await login(page, people.titB);
  await page.goto("/app/ia/agentes");
  await expect(page.getByText("Nenhuma assistente ainda")).toBeVisible({ timeout: SLOW });
  await page.goto(`/app/ia/agentes/${data![0].id}`);
  await expect(page.getByText("Agente não encontrado")).toBeVisible({ timeout: SLOW });
});

test("AST-03: simulador na operação real avisa que a IA está desligada e não envia", async ({ page }) => {
  test.skip(env.AI_ENABLED === "1", "IA ligada neste ambiente");
  await login(page, people.tit);
  await page.goto("/app/ia/simulador");
  await expect(page.getByTestId("integracao-em-auditoria-ai")).toBeVisible({ timeout: SLOW });
  await page.getByLabel("Mensagem do cliente").fill("Olá");
  await expect(page.getByRole("button", { name: "Enviar" })).toBeDisabled();
  expect((await page.request.post("/api/ia/simulador", { data: { organizationId: orgA, agentId: "x", history: [{ role: "user", text: "oi" }] } })).status()).toBe(503);
});

test("INT-01: integrações no escritório real mostram o estado verificado no servidor e levam à configuração", async ({ page }) => {
  await login(page, people.tit);
  await page.goto("/app/integracoes");
  await expect(page.getByTestId("integracoes-reais")).toBeVisible({ timeout: SLOW });
  for (const id of ["evolution", "gemini", "resend", "backup", "fontes", "zapsign", "pagamentos"]) await expect(page.getByTestId(`integracao-${id}`)).toBeVisible();
  await expect(page.getByText(/operacional” significa simulado/)).toHaveCount(0); // nada do catálogo da demonstração
  const wa = page.getByTestId("integracao-evolution");
  if (env.WHATSAPP_ENABLED === "1") {
    await wa.getByRole("link", { name: "Gerar QR e conectar" }).click();
    await expect(page.getByRole("heading", { name: "WhatsApp do escritório" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar QR" })).toBeVisible({ timeout: SLOW });
  } else {
    await expect(wa.getByText("Aguardando liberação")).toBeVisible();
    await page.goto("/app/integracoes/evolution");
    await expect(page.getByTestId("integracao-em-auditoria-whatsapp")).toBeVisible({ timeout: SLOW });
  }
  // Rota de saúde: sem sessão 401; de outro escritório 403.
  expect((await page.context().request.get(`/api/integracoes/saude?org=${orgB}`)).status()).toBe(403);
});

test("INT-02: titular vê o passo a passo de cada conta, salva uma chave (recusada pelo provedor real) e a chave não volta à tela", async ({ page }) => {
  await login(page, people.tit);
  await page.goto("/app/integracoes");
  const box = page.getByTestId("chaves-escritorio");
  await expect(box).toBeVisible({ timeout: SLOW });
  for (const id of ["gemini", "asaas", "mercadopago", "zapsign", "infinitepay"]) await expect(page.getByTestId(`chave-${id}`)).toBeVisible();
  const card = page.getByTestId("chave-asaas");
  await card.getByText("Como conseguir a chave").click();
  await expect(card.getByRole("link", { name: /Abrir o painel/ })).toHaveAttribute("href", /^https:\/\//);
  const fake = "$aact_hmlg_000000000000000000000000e2e";
  await card.getByLabel("Chave de API").fill(fake);
  await card.getByLabel("Teste (sandbox)").check();
  await card.getByRole("button", { name: "Salvar e testar" }).click();
  await expect(card.getByRole("alert")).toContainText(/recusou/, { timeout: SLOW });
  await expect(card.getByText("Recusada pelo provedor")).toBeVisible();
  await expect(card.getByText(/••••0e2e/)).toBeVisible();
  expect(await page.content()).not.toContain(fake);
});
