import { expect, test } from "@playwright/test";

// Fumaça contra o ambiente publicado (SMOKE_URL). Só leitura e fluxos demonstrativos; nenhum dado real.
test("PROD-01: entrada LexSion, login demo, Meu dia e Super Admin", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/entrar");
  await expect(page).toHaveTitle(/LexSion/);
  await expect(page.getByRole("img", { name: /LexSion/ }).first()).toBeVisible();
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await expect(page.getByRole("heading", { name: /Olá, Helena/ })).toBeVisible();
  await page.goto("/demo/tenant/atlas-juridico");
  await page.waitForURL(/\/app\/inicio/);
  await expect(page.locator("html")).toHaveAttribute("data-tenant", "atlas-juridico");
  await page.goto("/entrar");
  await page.getByRole("radio", { name: /Suporte LexSion/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await expect(page.getByRole("heading", { name: "Painel geral" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("PROD-02: service worker registra e o app abre offline após visita", async ({ page, context }) => {
  await page.goto("/entrar");
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app\/inicio/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto("/app/inicio");
  await expect(page.getByRole("heading", { name: /Olá, Helena/ })).toBeVisible();
  await context.setOffline(false);
});
