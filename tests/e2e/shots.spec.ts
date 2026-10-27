import { test } from "@playwright/test";

// Capturas de revisão visual (não são os prints da academia). Rodar sob demanda: pnpm exec playwright test shots
test("capturas CRM", async ({ page }, info) => {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/inicio/);
  for (const [path, name] of [["/app/crm", "crm"], ["/app/crm/leads/l-maria", "lead"], ["/app/crm/captura", "captura"], ["/app/clientes/novo", "novo-cliente"]] as const) {
    await page.goto(path);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/ref/${info.project.name}_${name}.png`, fullPage: true });
  }
});
