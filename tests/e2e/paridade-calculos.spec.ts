import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Paridade: central de cálculos (CJ-11/13/14/15/16, E2E-11/12/31). Aritmética determinística, sempre rotulada.
async function signIn(page: Page, who: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app/);
}
const fill = async (page: Page, label: string | RegExp, value: string) => {
  const f = page.getByLabel(label);
  await f.fill(value);
  await f.blur();
  await expect(f).toHaveValue(value);
};

test("PAR-CALC-01 (E2E-11/31): correção monetária vinculada ao caso, memória, CSV e resultado desatualizado ao mudar premissa", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/calculos");
  await page.getByRole("button", { name: "Novo cálculo: Correção monetária e juros" }).click();
  const d = page.getByRole("dialog", { name: "Novo cálculo" });
  await d.getByLabel("Vincular ao caso (opcional)").selectOption({ label: "Cobrança indevida em conta de energia" });
  await d.getByRole("button", { name: "Criar" }).click();
  await page.waitForURL(/\/app\/calculos\/calculations-/);
  await expect(page.getByText("Aguarda tabela oficial").first()).toBeVisible();

  await fill(page, "Valor original (R$)", "1.000,00");
  await fill(page, /Índice mensal informado/, "2025-01;1\n2025-03;2");
  await page.getByRole("button", { name: "Calcular" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Mês ausente" })).toBeVisible(); // série incompleta não calcula

  await fill(page, /Índice mensal informado/, "2025-01;1\n2025-02;2");
  await fill(page, "Juros simples (% ao mês)", "1");
  await fill(page, "Multa (%)", "2");
  await page.getByRole("button", { name: "Calcular" }).click();
  await expect(page.getByText("R$ 1.071,40", { exact: true })).toBeVisible();
  await expect(page.getByText(/Premissa: Série de 2025-01 a 2025-02 INFORMADA/)).toBeVisible();

  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar CSV" }).click()]);
  const csv = fs.readFileSync((await dl.path())!, "utf8");
  expect(csv).toContain("Total atualizado");
  expect(csv).toContain("Demonstrativo — não validado");

  await fill(page, "Multa (%)", "5");
  await expect(page.getByRole("alert").filter({ hasText: "Resultado desatualizado" })).toBeVisible();

  await page.getByRole("link", { name: "Abrir caso" }).click();
  await expect(page).toHaveURL(/aba=calculos/);
  await expect(page.getByRole("link", { name: /Correção monetária e juros/ }).locator("visible=true").first()).toBeVisible(); // lista tem versão celular e desktop
});

test("PAR-CALC-02 (E2E-12): verbas rescisórias com regras parciais, rótulo explícito e validação de entrada", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/calculos");
  await page.getByRole("button", { name: "Novo cálculo: Verbas rescisórias (simplificado)" }).click();
  await page.getByRole("dialog", { name: "Novo cálculo" }).getByRole("button", { name: "Criar" }).click();
  await page.waitForURL(/\/app\/calculos\/calculations-/);
  await expect(page.getByText("Regras parciais").first()).toBeVisible();
  await fill(page, "Último salário (R$)", "3.000,00");
  await fill(page, "Dias trabalhados no mês da saída", "40");
  await fill(page, "Avos de 13º (0–12)", "6");
  await fill(page, "Avos de férias proporcionais (0–12)", "6");
  await page.getByRole("button", { name: "Calcular" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "0 a 31" })).toBeVisible();
  await fill(page, "Dias trabalhados no mês da saída", "15");
  await fill(page, "Anos completos de serviço", "2");
  await fill(page, "Saldo do FGTS para fins rescisórios (R$)", "10.000,00");
  await page.getByRole("button", { name: "Calcular" }).click();
  await expect(page.getByText("R$ 12.600,00", { exact: true })).toBeVisible();
  await expect(page.getByText(/Premissa: Sem descontos/)).toBeVisible();
});

test("PAR-CALC-03: modelos antigos continuam iguais (horas extras e parcelamento)", async ({ page }) => {
  await signIn(page, /Otávio Reis/);
  await page.goto("/app/calculos/calc-rescisao");
  await page.getByRole("button", { name: "Calcular" }).click();
  await expect(page.getByText("Horas extras (bruto, sem reflexos)")).toBeVisible();
  await expect(page.getByText("Cálculo demonstrativo", { exact: true }).locator("visible=true").first()).toBeVisible();
});
