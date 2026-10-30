import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// QA-ROTA / QA-LANDING / QA-LOGIN / QA-DEMO — jornadas públicas separadas (landing, login, demonstração).
const serious = async (page: import("@playwright/test").Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

// Login e recuperação REAIS dependem do Supabase (CI público não tem credenciais): sem ele o teste é PULADO, não aprovado.
const SUPABASE = (() => { try { return fs.readFileSync(".env.local", "utf8").includes("NEXT_PUBLIC_SUPABASE_URL=https://"); } catch { return !!process.env.NEXT_PUBLIC_SUPABASE_URL; } })();
const overflow = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("QA-ROTA-01: / mostra a landing (não redireciona para login) e as 3 ações levam a destinos diferentes", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: /gestão completa do seu escritório/i })).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
  const scope = isMobile ? page.getByRole("dialog", { name: "Menu do site" }) : page.locator("header");
  for (const [name, url] of [["Entrar", /\/entrar$/], ["Ver demonstração", /\/demonstracao$/], ["Solicitar apresentação", /\/contato$/]] as const) {
    await expect(scope.getByRole("link", { name, exact: true }).first()).toHaveAttribute("href", url);
  }
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  expect(await serious(page)).toEqual([]);
});

test("QA-LANDING-01: prints reais carregam, têm texto alternativo e ampliam", async ({ page }) => {
  await page.goto("/");
  const imgs = page.locator('img[alt^="Tela real da LexSion"]');
  expect(await imgs.count()).toBeGreaterThanOrEqual(10);
  await imgs.first().scrollIntoViewIfNeeded();
  await expect.poll(() => imgs.first().evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Ampliar print: Meu dia" }).click();
  await expect(page.getByRole("dialog", { name: "Meu dia" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Meu dia" })).toBeHidden();
});

test("QA-LANDING-02: páginas institucionais renderizam, sem overflow e sem violação séria; nenhum preço inventado", async ({ page }) => {
  for (const r of ["/funcionalidades", "/solucoes", "/planos", "/sobre", "/contato", "/instalar", "/privacidade", "/termos"]) {
    await page.goto(r);
    await expect(page.locator("h1").first(), r).toBeVisible();
    expect(await overflow(page), r).toBeLessThanOrEqual(0);
    expect(await serious(page), r).toEqual([]);
  }
  // Planos vêm do banco; sem aprovação do dono, nenhum valor aparece (CONTR-01 cobre o conteúdo de cada plano).
  await page.goto("/planos");
  await expect(page.getByText(/R\$\s?\d/)).toHaveCount(0);
});

test("QA-LANDING-03: todo link interno da landing aponta para uma página existente", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = [...new Set(await page.locator("a[href^='/']").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!.split("#")[0] || "/")))];
  for (const h of hrefs) expect((await request.get(h)).status(), h).toBeLessThan(400);
});

test("QA-LANDING-04: contato valida e diz com clareza que nada foi enviado", async ({ page }) => {
  await page.goto("/contato?plano=Profissional");
  await expect(page.getByLabel("Mensagem (opcional)")).toHaveValue(/Profissional/);
  await page.getByRole("button", { name: "Solicitar apresentação" }).click();
  await expect(page.getByText("Informe seu nome.")).toBeVisible();
  await page.getByLabel("Nome").fill("Pessoa Teste");
  await page.getByLabel("E-mail").fill("pessoa@exemplo.test");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Solicitar apresentação" }).click();
  await expect(page.getByRole("status")).toContainText("não foram enviados nem guardados");
});

test("QA-LANDING-05: SEO — landing indexável com canonical; demo, login e sistema com noindex; sitemap e robots", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /^index/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://lexsion.com.br");
  for (const r of ["/demonstracao", "/entrar", "/app/inicio", "/admin"]) {
    await page.goto(r);
    // Robôs leem o HTML do servidor (1 tag); após navegação no cliente o head pode repetir a mesma tag — todas devem dizer noindex.
    await expect.poll(() => page.locator('meta[name="robots"]').evaluateAll((ms) => ms.length > 0 && ms.every((m) => /noindex/.test(m.getAttribute("content") ?? ""))), r).toBe(true);
    expect((await (await page.request.get(r)).text()).match(/<meta name="robots"[^>]*>/g), r).toEqual(['<meta name="robots" content="noindex, nofollow"/>']);
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("https://lexsion.com.br/planos");
  expect(sitemap).not.toMatch(/demonstracao|\/app\/|admin/);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/admin/);
});

test("QA-LOGIN-01: login real recusa credencial errada (Supabase Auth), sem revelar se a conta existe e sem criar sessão", async ({ page }) => {
  test.skip(!SUPABASE, "Supabase não configurado neste ambiente");
  await page.goto("/entrar");
  await expect(page.getByRole("radio", { name: /Helena Prado/ })).toHaveCount(0); // perfis fictícios saíram do login
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText(/Informe um e-mail válido/)).toBeVisible();
  await page.getByLabel("E-mail").fill("advogada@escritorio.exemplo");
  await page.getByLabel("Senha", { exact: true }).fill("curta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("A senha tem pelo menos 10 caracteres.")).toBeVisible();
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste-123");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Senha", { exact: true })).toHaveValue("");
  await expect(page).toHaveURL(/\/entrar$/);
  expect(await page.evaluate(() => localStorage.getItem("siwiltec.session"))).toBeNull();
  expect((await page.context().cookies()).filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))).not.toContain("senha-de-teste-123");
  await page.getByRole("link", { name: "Explore a demonstração" }).first().click();
  await expect(page).toHaveURL(/\/demonstracao$/);
  expect(await serious(page)).toEqual([]);
});

test("QA-LOGIN-02: recuperar acesso valida e responde igual exista ou não a conta (anti-enumeração)", async ({ page }) => {
  test.skip(!SUPABASE, "Supabase não configurado neste ambiente");
  await page.goto("/recuperar-acesso");
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await page.getByLabel("E-mail").fill("conta-inexistente@lexsion-teste.invalid"); // domínio .invalid: nunca recebe e-mail
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByRole("status")).toContainText("Se houver uma conta com esse e-mail", { timeout: 15_000 });
});

test("QA-DEMO-01: demonstração agrupada por escritório, com busca e prévia da função", async ({ page }) => {
  await page.goto("/demonstracao");
  await expect(page.getByRole("heading", { level: 1, name: /demonstração interativa/ })).toBeVisible();
  for (const g of ["Aurora Advocacia Previdenciária", "Atlas Jurídico Associados", "Novo Escritório (trial)", "Plataforma LexSion"]) await expect(page.getByRole("group", { name: new RegExp(g.replace(/[()]/g, "\\$&")) })).toBeVisible();
  await page.getByRole("searchbox").fill("financeiro");
  await expect(page.getByRole("radio")).toHaveCount(1);
  await page.getByRole("radio", { name: /Caio Martins/ }).check();
  await expect(page.getByLabel("Perfil escolhido")).toContainText("Honorários");
  await page.getByRole("button", { name: /^Entrar como Financeiro/ }).click();
  await expect(page).toHaveURL(/\/app\/inicio/);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
