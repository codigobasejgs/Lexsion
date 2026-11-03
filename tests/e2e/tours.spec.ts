import { expect, test, type Page } from "@playwright/test";
import { TOURS } from "../../src/tours/tours";

// QA28: todo passo de tour encontra o alvo na tela real (demonstração), no computador e no celular.
// Alvo com alternativas: basta uma visível (sidebar no desktop × conteúdo no celular).
async function signIn(page: Page, role: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: role }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/(app|admin|portal)/);
}
const PROFILE: Record<string, RegExp> = { portal: /Cliente \(portal\)/, "super-admin": /Suporte LexSion/, "financeiro-perfil": /Caio Martins/, cobranca: /Caio Martins/, conciliacao: /Caio Martins/ };

for (const t of TOURS) {
  test(`tour ${t.id}: todos os alvos existem`, async ({ page }) => {
    await signIn(page, PROFILE[t.id] ?? /Helena Prado/);
    for (const s of t.steps) {
      await page.goto(s.route);
      const targets = Array.isArray(s.target) ? s.target : [s.target];
      const sel = targets.map((x) => `[data-tour="${x}"]`).join(", ");
      await expect(page.locator(sel).locator("visible=true").first(), `${t.id} › ${s.title} (${s.route})`).toBeVisible({ timeout: 15_000 });
    }
  });
}
