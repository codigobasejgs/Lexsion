import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

// U09: build A instalado → edição em andamento → versão B disponível → adiar/bloquear → salvar → atualizar.
// Simula o build B trocando a VERSION do sw.js servido (mesma origem, bytes diferentes).
const SW = "public/sw.js";
const pristine = readFileSync(SW, "utf8");
test.afterAll(() => writeFileSync(SW, pristine)); // também cobre timeout do teste

test("atualização do service worker respeita edição não salva e não entra em loop", async ({ page }) => {
  const original = readFileSync(SW, "utf8");
  try {
    await page.goto("/entrar");
    await page.getByRole("radio", { name: /Rafael Nunes/ }).check();
    await page.getByRole("button", { name: /^Entrar como/ }).click();
    await page.waitForURL(/inicio/);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await page.goto("/app/atendimento/cv-pedro");
    const composer = page.getByLabel("Mensagem ao cliente");
    await composer.fill("rascunho em andamento");

    // "Deploy" da versão B (next start serve public/ do disco).
    writeFileSync(SW, original.replace(/^const VERSION = ".*";$/m, 'const VERSION = "build-b";'));
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());

    const banner = page.getByText("Nova versão disponível.");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Atualizar agora" }).click();
    await expect(page.getByText("Há uma edição não salva. Salve ou descarte antes de atualizar.")).toBeVisible();
    await expect(composer).toHaveValue("rascunho em andamento"); // nada descartado

    await composer.fill(""); // usuário descarta o rascunho
    let reloads = 0;
    page.on("load", () => reloads++);
    await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Atualizar agora" }).click()]);
    await expect.poll(() => page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.some((k) => k.endsWith("build-b")) && !keys.some((k) => k.endsWith("build-a"));
    }).catch(() => false), { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(1500);
    expect(reloads).toBe(1); // sem loop de recarga
    await expect(page).toHaveURL(/\/app\/atendimento\/cv-pedro/); // rota preservada
    await expect(page.getByRole("heading", { name: "Pedro Henrique Amostra" })).toBeVisible();
  } finally {
    writeFileSync(SW, original);
  }
});
