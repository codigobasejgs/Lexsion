import { expect, test, type Page } from "@playwright/test";

// Paridade previdenciária: núcleo CNIS (TI-05/PREV-01/INT-01..04), BPC/LOAS (TI-06/CJ-07), PPP e quesitos (TI-07/08).
async function signIn(page: Page, who: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/(app|portal)/);
}

test("PAR-PREV-01 (E2E-07/10): diagnóstico do CNIS explica lacuna/concomitância e pede prova que aparece no portal", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/previdenciario/analises/pa-joao");
  const diag = page.getByTestId("cnis-diagnostico");
  await expect(diag).toContainText("Lacuna entre vínculos");
  await expect(diag).toContainText("07/1991 a 02/1994 (32 meses)");
  await expect(diag).toContainText("Concomitância");
  await expect(diag).toContainText(/Qualidade \d+\/100/);
  await expect(diag).toContainText(/Tempo coberto .*\d+ ano\(s\)/);
  await diag.getByRole("button", { name: "Pedir documento ao cliente" }).first().click();
  await expect(diag.getByText("Pedido ao cliente").first()).toBeVisible();
  await page.goto("/app/documentos/solicitacoes");
  await expect(page.getByText("Prova: Lacuna entre vínculos").locator("visible=true").first()).toBeVisible();
});

test("PAR-PREV-02 (E2E-06): BPC/LOAS — composição familiar, exclusão de renda, nova versão, revisão e minuta", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/previdenciario");
  await page.getByRole("link", { name: /BPC\/LOAS — Maria/ }).click();
  await expect(page.getByTestId("bpc-per-capita")).toHaveText(/R\$\s200,00/); // (0 + 600) ÷ 3; aposentadoria do cônjuge excluída
  await page.getByLabel("Excluir renda de Cônjuge — aposentadoria de 1 salário mínimo").uncheck();
  await expect(page.getByTestId("bpc-per-capita")).toHaveText(/R\$\s706,00/);
  await page.getByLabel("Excluir renda de Cônjuge — aposentadoria de 1 salário mínimo").check();
  await page.getByLabel("Nome/parentesco").fill("Filha");
  await page.getByLabel("Renda (R$)").fill("300,00");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByTestId("bpc-per-capita")).toHaveText(/R\$\s225,00/);
  await expect(page.getByRole("button", { name: "Gerar minuta para revisão" })).toBeDisabled(); // precisa salvar a versão
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page.getByText(/versão das entradas 2/)).toBeVisible();
  await page.getByRole("button", { name: "Marcar como revisada" }).click();
  await expect(page.getByText(/Revisado por Helena Prado \(v2\)/)).toBeVisible();
  await page.getByRole("button", { name: "Gerar minuta para revisão" }).click();
  await page.waitForURL(/\/app\/minutas\//);
  // Editor da minuta pelo rótulo (sob carga, o 1º textbox ainda podia ser o formulário do BPC durante a transição).
  await expect(page.getByLabel("Texto da minuta")).toHaveValue(/Renda per capita apurada: R\$\s225,00/);
});

test("PAR-PREV-03 (E2E-08): PPP — pendências por período, quesitos selecionados e minuta revisável", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/previdenciario/especializadas/as-ppp-joao");
  await expect(page.getByTestId("ppp-pp1")).toContainText("Sem LTCAT anexo");
  await expect(page.getByTestId("ppp-pp2")).toContainText("PPP declara EPI eficaz");
  await page.getByLabel(/Incluir quesito: Quanto ao período de 01\/02\/1983/).check();
  await expect(page.getByRole("button", { name: "Gerar minuta de quesitos" })).toBeDisabled();
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await page.getByRole("button", { name: "Gerar minuta de quesitos" }).click();
  await page.waitForURL(/\/app\/minutas\//);
  await expect(page.getByRole("textbox").first()).toHaveValue(/1\. Quanto ao período de 01\/02\/1983/);
});

test("PAR-PREV-04 (E2E-20): estagiária não revisa análise; caso lista a análise especializada", async ({ page }) => {
  await signIn(page, /Lia Torres/);
  await page.goto("/app/previdenciario/especializadas/as-bpc-maria");
  await expect(page.getByText("Só advogado(a) ou titular revisa.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar como revisada" })).toHaveCount(0);
  await page.goto("/app/casos/k-maria-bpc?aba=analises");
  await expect(page.getByRole("link", { name: /BPC\/LOAS — Maria \(idosa\)/ }).first()).toBeVisible();
});

test("PAR-PREV-05 (E2E-26): telas novas sem rolagem horizontal e sem violação axe séria", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await signIn(page, /Helena Prado/);
  for (const r of ["/app/previdenciario/especializadas/as-bpc-maria", "/app/previdenciario/especializadas/as-ppp-joao", "/app/previdenciario/analises/pa-joao", "/app/previdenciario", "/app/calculos"]) {
    await page.goto(r);
    await page.locator("h1").first().waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), r).toBeLessThanOrEqual(0);
    const wide = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && getComputedStyle(e).position !== "fixed" && !e.closest(".overflow-x-auto")).map((e) => e.textContent?.slice(0, 40)).slice(0, 3));
    expect(wide, `${r}: elemento além da largura`).toEqual([]);
    const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(ax.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes[0]?.target}`), r).toEqual([]);
  }
});
