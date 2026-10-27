import { expect, test, type Page } from "@playwright/test";

// QA-RBAC (UX demonstrativa): perfis novos, matriz na Equipe, negação de rota e de ação.
async function signIn(page: Page, who: RegExp, url = /\/(app|admin|portal)/) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(url);
}

test("QA-RBAC-01: equipe mostra a matriz de 9 funções do escritório × módulos × ações", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/equipe");
  const m = page.getByTestId("matriz-acesso");
  await expect(m.getByRole("columnheader")).toHaveCount(10); // 1 coluna de rótulo + 9 funções
  await expect(m.getByRole("rowheader", { name: "Aprovar peças" })).toBeVisible();
});

test("QA-RBAC-02: correspondente externo não acessa financeiro nem CRM", async ({ page }) => {
  await signIn(page, /Renan Correspondente/);
  for (const r of ["/app/financeiro", "/app/crm", "/app/equipe"]) {
    await page.goto(r);
    await expect(page.getByRole("heading", { name: "Você não tem acesso a esta área" }), r).toBeVisible();
  }
  await page.goto("/app/casos");
  await expect(page.getByRole("heading", { name: "Você não tem acesso a esta área" })).toHaveCount(0);
});

test("QA-RBAC-03: gestor(a) operacional vê a identidade visual só para leitura", async ({ page }) => {
  await signIn(page, /Gilberto Andrade/);
  await page.goto("/app/configuracoes/branding");
  await expect(page.getByText("Somente o administrador do escritório altera a identidade")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar identidade" })).toHaveCount(0);
});

test("QA-RBAC-04: administrador e suporte da plataforma entram no Super Admin, nunca no ERP", async ({ page }) => {
  for (const who of [/Paula Operações/, /Sérgio Atendimento LexSion/]) {
    await signIn(page, who, /\/admin/);
    await expect(page.getByRole("heading", { name: "Painel geral" })).toBeVisible();
    await page.goto("/app/inicio");
    await expect(page).toHaveURL(/\/admin/);
  }
});

test("QA-RBAC-05: cliente do portal digitando a rota do Super Admin é recusado", async ({ page }) => {
  await signIn(page, /Cliente \(portal\)/, /\/portal/);
  await page.goto("/admin/organizacoes");
  await expect(page).toHaveURL(/\/demonstracao/);
  await expect(page.getByText("Contratantes")).toHaveCount(0);
});

test("QA-RBAC-06: administrador vê a assinatura do escritório só para leitura; advogado não vê a aba", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/configuracoes?aba=assinatura");
  const sub = page.getByTestId("minha-assinatura");
  await expect(sub).toContainText(/Plano/);
  await expect(sub.getByRole("table", { name: "Faturas da assinatura LexSion" })).toBeVisible();
  await expect(sub.getByRole("button")).toHaveCount(0); // nada editável
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: /Rafael Nunes/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app/);
  await page.goto("/app/configuracoes");
  await expect(page.getByRole("tab", { name: "Assinatura LexSion" })).toHaveCount(0);
});

test("QA-RBAC-07: tour guiado do Super Admin percorre painel, escritórios e faturas sem passo perdido", async ({ page, isMobile }) => {
  await signIn(page, /Paula Operações/, /\/admin/);
  if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Tour guiado" }).click();
  const pop = page.getByTestId("tour-popover");
  for (const [title, url] of [["Indicadores", /\/admin$/], ["Novo escritório", /organizacoes/], ["Faturas da assinatura", /faturamento/]] as const) {
    await expect(pop.getByRole("heading", { name: title })).toBeVisible();
    await expect(page).toHaveURL(url);
    await expect(pop).not.toContainText("não está visível");
    await pop.getByRole("button", { name: /Avançar|Concluir/ }).click();
  }
  await expect(pop).toHaveCount(0);
});
