import { test, type Page } from "@playwright/test";

// Prints das telas NOVAS da paridade (docs/PARIDADE_5_PLATAFORMAS/08-PRINTS-REVISADOS). Dados fictícios.
// Rodar: pnpm build && CAPTURE=1 pnpm exec playwright test tests/capture/paridade.capture.ts --project=landing-desktop --project=landing-mobile
const OUT = "docs/PARIDADE_5_PLATAFORMAS/08-PRINTS-REVISADOS";
const SHOTS: { id: string; who: RegExp; route: string; scroll?: string }[] = [
  { id: "cnis-diagnostico", who: /Helena Prado/, route: "/app/previdenciario/analises/pa-joao", scroll: '[data-testid="cnis-diagnostico"]' },
  { id: "bpc-loas", who: /Helena Prado/, route: "/app/previdenciario/especializadas/as-bpc-maria" },
  { id: "ppp-quesitos", who: /Helena Prado/, route: "/app/previdenciario/especializadas/as-ppp-joao" },
  { id: "central-calculos", who: /Helena Prado/, route: "/app/calculos" },
];

async function signIn(page: Page, who: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/(app|portal|admin)/);
}

for (const s of SHOTS) {
  test(`print ${s.id}`, async ({ page, isMobile }) => {
    await signIn(page, s.who);
    await page.goto(s.route);
    await page.locator("h1").first().waitFor();
    if (s.scroll) await page.locator(s.scroll).first().scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${s.id}-${isMobile ? "mobile" : "desktop"}.png`, fullPage: !s.scroll, animations: "disabled", caret: "hide" });
  });
}
