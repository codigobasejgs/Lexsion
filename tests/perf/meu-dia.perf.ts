import { test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

// Medição local: bytes transferidos de JS/CSS na primeira carga e métricas de navegação.
test("perf meu dia", async ({ page }, info) => {
  await page.goto("/entrar");
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/inicio/);
  await page.context().clearCookies();
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  let js = 0, css = 0;
  const types = new Map<string, string>();
  client.on("Network.responseReceived", (e) => types.set(e.requestId, e.response.mimeType));
  client.on("Network.loadingFinished", (e) => { const t = types.get(e.requestId) ?? ""; if (t.includes("javascript")) js += e.encodedDataLength; if (t.includes("css")) css += e.encodedDataLength; });
  await page.goto("/app/inicio", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Olá, Helena/ }).waitFor();
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
    return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: fcp ? Math.round(fcp) : null };
  });
  console.log(`PERF ${info.project.name} js=${Math.round(js / 1024)}KB css=${Math.round(css / 1024)}KB ${JSON.stringify(nav)}`);
});
