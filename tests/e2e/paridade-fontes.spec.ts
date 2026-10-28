import { expect, test, type Page } from "@playwright/test";

// Paridade JUS-06/07/08, TI-14/15 (E2E-13/14): citação sem fonte verificada bloqueia aprovação, na tela e no serviço.
async function signIn(page: Page, who: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app/);
}

test("PAR-FONTE-01 (E2E-13/14): citação inventada bloqueia; lei conferida em endereço oficial libera a aprovação", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/minutas/dr-lucia");
  const editor = page.getByLabel("Texto da minuta");
  await editor.fill(`${await editor.inputValue()}\n\nFundamentos: art. 74 da Lei 8.213/1991 e Súmula 999 do STJ.`);
  await page.getByRole("button", { name: "Salvar" }).click();
  const panel = page.getByTestId("painel-fontes");
  await expect(panel).toContainText("Lei 8.213/1991");
  await expect(panel).toContainText("Não verificado");
  await expect(panel).toContainText("Súmula 999 do STJ");
  await expect(panel).toContainText("Não disponível");
  await expect(page.getByRole("button", { name: "Aprovar" })).toBeDisabled();
  await expect(page.getByText(/Citação sem fonte verificada: Lei 8.213\/1991, Súmula 999 do STJ/)).toBeVisible();

  // Endereço que não é oficial é recusado.
  const lei = panel.getByRole("listitem").filter({ hasText: "Lei 8.213/1991" });
  await lei.getByRole("button", { name: "Conferir fonte" }).click();
  await lei.getByLabel(/Endereço oficial/).fill("https://exemplo.com/lei");
  await lei.getByLabel("Trecho conferido na fonte").fill("Art. 74. A pensão por morte será devida ao conjunto dos dependentes...");
  await expect(lei.getByRole("button", { name: "Marcar como verificada" })).toBeDisabled();
  await lei.getByLabel(/Endereço oficial/).fill("https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm");
  await lei.getByRole("button", { name: "Marcar como verificada" }).click();
  await expect(lei).toContainText("Verificado");
  await expect(lei).toContainText("Conferido por Helena Prado");

  // A súmula inexistente continua bloqueando: remove do texto.
  await editor.fill((await editor.inputValue()).replace(" e Súmula 999 do STJ", ""));
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(panel).not.toContainText("Súmula 999");
  await expect(page.getByRole("button", { name: "Aprovar" })).toBeEnabled();
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByText("Aprovada.")).toBeVisible();
});

test("PAR-FONTE-02 (E2E-02): verificação de fonte é do escritório — no B a mesma lei continua não verificada", async ({ page, isMobile }) => {
  test.skip(isMobile, "troca de escritório pelo seletor do cabeçalho (desktop)");
  await signIn(page, /Helena Prado/);
  await page.goto("/app/minutas/dr-lucia");
  const editor = page.getByLabel("Texto da minuta");
  await editor.fill(`${await editor.inputValue()}\n\nArt. 74 da Lei 8.213/1991.`);
  await page.getByRole("button", { name: "Salvar" }).click();
  const lei = page.getByTestId("painel-fontes").getByRole("listitem").filter({ hasText: "Lei 8.213/1991" });
  await lei.getByRole("button", { name: "Conferir fonte" }).click();
  await lei.getByLabel("Trecho conferido na fonte").fill("Art. 74. A pensão por morte será devida ao conjunto dos dependentes...");
  await lei.getByRole("button", { name: "Marcar como verificada" }).click();
  await expect(lei).toContainText("Verificado");

  await page.locator("[data-tour=troca-escritorio]").selectOption("org-boreal");
  await page.goto("/app/minutas");
  await page.getByRole("button", { name: /Nova minuta/ }).first().click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Título").fill("Teste de isolamento de fontes");
  await d.getByRole("button", { name: /Criar/ }).click();
  await page.waitForURL(/\/app\/minutas\/drafts-/);
  const ed2 = page.getByLabel("Texto da minuta");
  await ed2.fill("Art. 74 da Lei 8.213/1991.");
  await page.getByRole("button", { name: "Salvar" }).click();
  const lei2 = page.getByTestId("painel-fontes").getByRole("listitem").filter({ hasText: "Lei 8.213/1991" });
  await expect(lei2).toContainText("Não disponível"); // fonte do A não vaza para o B
  await expect(lei2).not.toContainText("Conferido por Helena");
});
