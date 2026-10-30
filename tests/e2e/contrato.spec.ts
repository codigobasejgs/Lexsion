import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Jornada do contrato SaaS em /contratar. Dados SINTÉTICOS. Com o modelo ainda em revisão jurídica (estado atual),
// a prévia e a minuta funcionam, mas NÃO há aceite, código nem pagamento — e a tela diz isso.
// Cria só rascunhos (READY_FOR_REVIEW) com e-mail @lexsion-qa.invalid, apagados ao final; sem conta, pedido ou e-mail.
// E-mail próprio deste worker: a limpeza apaga só os rascunhos DELE (projetos rodam em paralelo).
const EMAIL = `qa-contrato-${process.pid}-${Date.now().toString(36)}@lexsion-qa.invalid`;
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
test.afterAll(async () => {
  if (!env.SUPABASE_SECRET_KEY) return;
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  await db.from("saas_contracts").delete().eq("party->>email", EMAIL).is("accepted_at", null).eq("status", "READY_FOR_REVIEW");
});
// Origem distinta por teste: o limite de 8 rascunhos/hora por origem é da proteção real, não do teste.
test.use({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250)}` } });
async function open(page: Page, plano = "profissional") {
  await page.goto(`/contratar?plano=${plano}`);
  const go = page.getByRole("button", { name: "Continuar" });
  test.skip((await go.count()) === 0, "contratação indisponível neste ambiente (sem chave do servidor ou planos não aprovados)");
  await page.evaluate(() => sessionStorage.clear());
  return go;
}
async function fillPF(page: Page, name = "Ana Exemplo Teste") {
  await page.getByLabel("Nome completo", { exact: true }).fill(name);
  await page.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
  await page.getByLabel(/^E-mail/).fill(EMAIL);
  await page.getByLabel(/Celular/).fill("11912345678");
  await page.getByLabel("CEP").fill("01310-100");
  await page.getByLabel("Logradouro").fill("Avenida Exemplo");
  await page.getByLabel("Número", { exact: true }).fill("100");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo");
  await page.getByLabel("UF", { exact: true }).fill("SP");
}

test("CTR-01: todos os planos levam ao contrato do plano certo; slug inválido oferece os planos sem criar nada", async ({ page }) => {
  for (const [id, label] of [["solo", "Solo"], ["profissional", "Profissional"], ["elite", "Elite"]]) {
    await open(page, id);
    await expect(page.getByRole("radio", { name: new RegExp(label) })).toBeChecked();
    await expect(page.getByLabel("Resumo da contratação")).toContainText(label);
  }
  await page.goto("/contratar?plano=nao-existe");
  await expect(page.getByRole("status").first()).toContainText("não está disponível");
});

test("CTR-02: prévia ao vivo com dados da contratada do comprovante; muda ao digitar; tarja de minuta", async ({ page }) => {
  await (await open(page)).click();
  const paper = page.getByTestId("contrato-texto");
  await expect(paper).toContainText("59.760.458 MARCO ANTONIO BOGGIAN");
  await expect(paper).toContainText("59.760.458/0001-91");
  await expect(paper).toContainText("MINUTA PARA REVISÃO — AINDA NÃO ACEITA");
  await expect(paper).toContainText("R$ 249,90");
  await page.getByLabel("Nome completo", { exact: true }).fill("Carla Prévia Viva");
  await expect(paper).toContainText("Carla Prévia Viva");
  await expect(paper).not.toContainText("APP GROUP");
});

test("CTR-03: validação por campo (CPF, PJ sem poderes) no navegador; nada é enviado com erro", async ({ page }) => {
  await (await open(page)).click();
  await fillPF(page);
  await page.getByLabel("CPF", { exact: true }).fill("111.111.111-11");
  await page.getByRole("button", { name: "Revisar contrato" }).click();
  await expect(page.getByText("CPF inválido.")).toBeVisible();
  await page.getByRole("radio", { name: /pessoa jurídica/ }).click();
  await page.getByLabel("Razão social").fill("Exemplo Advogados");
  await page.getByLabel("CNPJ", { exact: true }).fill("11.222.333/0001-81");
  await page.getByRole("button", { name: "Revisar contrato" }).click();
  await expect(page.getByText("Confirme que o(a) responsável tem poderes para contratar.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /poderes para contratar/ })).not.toBeChecked(); // não vem marcado
});

test("CTR-04: revisão traz o texto do SERVIDOR com nº e hash; sem aprovação jurídica não há aceite nem pagamento", async ({ page }) => {
  await (await open(page)).click();
  await fillPF(page);
  await expect(page.getByRole("checkbox", { name: /novidades/ })).not.toBeChecked(); // marketing opcional, desmarcado
  await page.getByRole("button", { name: "Revisar contrato" }).click();
  const paper = page.getByTestId("contrato-texto");
  await expect(paper).toContainText(/Nº LX-\d{4}-[0-9A-F]{10}/);
  await expect(paper).toContainText(/SHA-256 do texto: [0-9a-f]{64}/);
  await expect(paper).toContainText("CPF sob o nº 529.982.247-25");
  await expect(page.getByText("Pendente de aprovação jurídica.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar para o aceite" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aceitar eletronicamente" })).toHaveCount(0);
  // Minuta em PDF real (A4, com tarja) antes do aceite
  const dl = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar minuta em PDF/ }).click();
  expect((await dl).suggestedFilename()).toMatch(/^minuta-lexsion-LX-/);
  // Voltar preserva os dados
  await page.getByRole("button", { name: "Corrigir dados" }).click();
  await expect(page.getByLabel("Nome completo", { exact: true })).toHaveValue("Ana Exemplo Teste");
});

test("CTR-05: API recusa aceite sem modelo aprovado e token forjado; preço não vem do navegador", async ({ request }) => {
  const forged = await request.post("/api/contrato", { data: { action: "accept", token: "x".repeat(32), hash: "h", read: true, agree: true, otp: "123456" } });
  expect([404, 503]).toContain(forged.status());
  const r = await request.post("/api/contrato", { data: { action: "save", plan: "profissional", cycle: "mensal", amount: 100, party: { kind: "PF" }, slug: "x" } });
  if (r.status() === 503) return;
  expect(r.status()).toBe(400);
  expect((await r.json()).error.fields).toMatchObject({ name: expect.any(String), cpf: expect.any(String) });
});

test("CTR-06: contrato legível no celular estreito (320 px) e sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await (await open(page)).click();
  await expect(page.getByTestId("contrato-texto")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
