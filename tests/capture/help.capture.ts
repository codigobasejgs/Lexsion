import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { HELP_VERSION, SHOTS } from "./help-manifest";

// Prints reais da academia/ajuda: roteiro independente da captura de QA (pnpm capture:help).
// Cada teste começa com IndexedDB limpo: fixtures determinísticas, relógio de demo fixo.
async function signIn(page: Page, profile: string) {
  await page.goto("/demonstracao");
  if (!profile) return;
  await page.getByRole("radio", { name: new RegExp(profile) }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/(app|admin)/);
}

for (const s of SHOTS) {
  test(`${s.article} passo ${s.step}${s.mobile ? " (celular)" : ""}`, async ({ page, isMobile }) => {
    test.skip(s.mobile !== isMobile, "outro viewport");
    await signIn(page, s.profile);
    await page.goto(s.route);
    if (s.article === "tarefas-recorrentes") {
      await page.getByRole("button", { name: "Nova tarefa" }).click();
      const d = page.getByRole("dialog", { name: "Nova tarefa" });
      await d.getByLabel("Título").fill("Conferir publicações do mês");
      await d.getByLabel("Repetir").selectOption("mes");
      await page.waitForTimeout(200);
      await page.screenshot({ path: s.out, fullPage: false, animations: "disabled", caret: "hide" });
      return;
    }
    if (s.article === "importar-csv") {
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByRole("button", { name: "Usar exemplo fictício" }).click();
      await page.getByRole("button", { name: "Validar" }).click();
    }
    const target = page.locator(s.selector).locator("visible=true").first();
    await expect(target).toBeVisible();
    await target.evaluate((el) => el.scrollIntoView({ block: "center" })); // mostra o elemento citado no passo
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: s.out, fullPage: false, animations: "disabled", caret: "hide" });
    expect(fs.existsSync(s.out)).toBe(true);
  });
}

test.afterAll(() => {
  fs.writeFileSync(`public/help/screenshots/${HELP_VERSION}/manifest.json`, JSON.stringify({ version: HELP_VERSION, generatedAt: new Date().toISOString(), shots: SHOTS }, null, 2));
});
