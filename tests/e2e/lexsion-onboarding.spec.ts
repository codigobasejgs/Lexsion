import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// E2E-12 (onboarding do escritório em teste) e telas novas de Configurações.
async function signIn(page: Page, who: RegExp, url = /\/(app|admin|portal)/) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(url);
}
const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);

test("E2E-12: escritório em teste completa primeiros passos, que persistem; o vazio é educativo", async ({ page }) => {
  await signIn(page, /Carlos Exemplo/);
  await page.goto("/app/boas-vindas");
  await expect(page.getByRole("heading", { name: /Boas-vindas, Carlos/ })).toBeVisible();
  await expect(page.getByText(/0 de 9 concluídos/)).toBeVisible();
  await page.getByRole("checkbox", { name: "Colocar o logotipo e as cores do escritório" }).click();
  await expect(page.getByText(/1 de 9 concluídos/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/1 de 9 concluídos/)).toBeVisible();
  await page.goto("/app/clientes");
  await expect(page.getByText("Cadastre o primeiro cliente para começar.")).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test("WL-EMAIL-01: modelos de e-mail com a marca do escritório e envio só simulado", async ({ page }) => {
  await signIn(page, /Otávio Reis/);
  await page.goto("/app/configuracoes/emails");
  await page.getByRole("button", { name: "Parcela vencendo" }).click();
  await expect(page.getByTestId("assunto")).toContainText("10/11/2026");
  const frame = page.frameLocator('iframe[title="Prévia do e-mail"]');
  await expect(frame.getByText("Atlas Jurídico").first()).toBeVisible();
  await expect(frame.getByText(/Aurora/)).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar teste (simulado)" }).click();
  await expect(page.getByText("Envio simulado — nenhum e-mail real foi enviado.")).toBeVisible();
  // A prévia é HTML de e-mail isolado em iframe sandbox (sem scripts): o axe não entra nele; o resto da tela é auditado.
  await expect(page.locator('iframe[title="Prévia do e-mail"]')).toHaveAttribute("sandbox", "");
  const v = (await new AxeBuilder({ page }).exclude('iframe[title="Prévia do e-mail"]').analyze()).violations.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => x.id);
  expect(v).toEqual([]);
});

test("E2E-21: integrações da plataforma nunca aparecem como ativas", async ({ page }) => {
  await signIn(page, /Suporte LexSion/, /\/admin/);
  await page.goto("/admin/integracoes");
  await expect(page.getByTestId("provedor-supabase")).toContainText("Requer credenciais");
  await expect(page.getByText("Ativo", { exact: true })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/sb_secret|re_[A-Za-z0-9]{8}|vcp_|cfat_/);
  expect(await serious(page)).toEqual([]);
});
