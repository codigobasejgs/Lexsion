import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { LANDING_SHOTS } from "../../src/content/landing-shots";

// Prints REAIS do app para a landing (dataset fictício padrão, sem dado real). Gera public/landing/<id>-{desktop|mobile}.png.
// Rodar: pnpm build && pnpm capture:landing
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, who: string) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: new RegExp(who) }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/(app|admin|portal)/);
}

for (const s of LANDING_SHOTS) {
  test(`landing:${s.id}`, async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await signIn(page, s.profile);
    await page.goto(s.route);
    await expect(page.locator(s.waitFor).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    fs.mkdirSync("public/landing", { recursive: true });
    await page.screenshot({ path: `public/landing/${s.id}-${isMobile ? "mobile" : "desktop"}.png` /* convertido para .webp por scripts/capture-landing.mjs */, fullPage: false });
  });
}
