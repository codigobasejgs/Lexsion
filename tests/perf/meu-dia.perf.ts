import { test } from "@playwright/test";

// Medição de laboratório (não substitui Lighthouse nem dados de campo).
// Primeira carga de /app/inicio sem service worker e sem cache, com e sem limitação (CPU 4× + rede "4G lenta").
test.use({ serviceWorkers: "block" });

for (const throttled of [false, true]) {
  test(`perf meu dia${throttled ? " (CPU 4× + 4G lenta)" : ""}`, async ({ page }, info) => {
    await page.goto("/entrar");
    await page.getByRole("radio", { name: /Helena Prado/ }).check();
    await page.getByRole("button", { name: /^Entrar como/ }).click();
    await page.waitForURL(/inicio/);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (throttled) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    }
    let js = 0, css = 0;
    const types = new Map<string, string>();
    cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.response.mimeType));
    cdp.on("Network.loadingFinished", (e) => { const t = types.get(e.requestId) ?? ""; if (t.includes("javascript")) js += e.encodedDataLength; if (t.includes("css")) css += e.encodedDataLength; });
    await page.addInitScript(() => {
      const w = window as unknown as { __lcp: number; __cls: number; __long: number };
      w.__lcp = 0; w.__cls = 0; w.__long = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__long += Math.max(0, e.duration - 50); }).observe({ type: "longtask", buffered: true });
    });
    await page.goto("/app/inicio", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Olá, Helena/ }).waitFor();
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const w = window as unknown as { __lcp: number; __cls: number; __long: number };
      const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
      return { fcp: Math.round(fcp), lcp: Math.round(w.__lcp), cls: +w.__cls.toFixed(3), tbt: Math.round(w.__long), load: Math.round(n.loadEventEnd) };
    });
    console.log(`PERF ${info.project.name}${throttled ? " throttled" : ""} js=${Math.round(js / 1024)}KB css=${Math.round(css / 1024)}KB ${JSON.stringify(m)}`);
  });
}
