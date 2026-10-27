import { test } from "@playwright/test";

// Lista os scripts carregados na primeira visita a /app/inicio (para análise de bundle).
test.use({ serviceWorkers: "block" });
test("chunks do Meu dia", async ({ page }, info) => {
  test.skip(info.project.name !== "perf-desktop");
  await page.goto("/entrar");
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/inicio/);
  const urls: string[] = [];
  page.on("response", (r) => { if (r.url().endsWith(".js")) urls.push(r.url().split("/").pop()!); });
  await page.reload({ waitUntil: "networkidle" });
  console.log("CHUNKS " + urls.join(" "));
});
