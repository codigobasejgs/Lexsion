import { test } from "@playwright/test";

// Primeira carga da landing (/) sem cache e sem service worker; mesmo método de meu-dia.perf.ts.
test.use({ serviceWorkers: "block" });

for (const throttled of [false, true]) {
  test(`perf landing${throttled ? " (CPU 4× + 4G lenta)" : ""}`, async ({ page }, info) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (throttled) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    }
    let js = 0, img = 0;
    const types = new Map<string, string>();
    cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.response.mimeType));
    cdp.on("Network.loadingFinished", (e) => { const t = types.get(e.requestId) ?? ""; if (t.includes("javascript")) js += e.encodedDataLength; if (t.startsWith("image/")) img += e.encodedDataLength; });
    await page.addInitScript(() => {
      const w = window as unknown as { __lcp: number; __cls: number; __long: number };
      w.__lcp = 0; w.__cls = 0; w.__long = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__long += Math.max(0, e.duration - 50); }).observe({ type: "longtask", buffered: true });
    });
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const w = window as unknown as { __lcp: number; __cls: number; __long: number };
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
      return { fcp: Math.round(fcp), lcp: Math.round(w.__lcp), cls: +w.__cls.toFixed(3), tbt: Math.round(w.__long) };
    });
    console.log(`PERF landing ${info.project.name}${throttled ? " throttled" : ""} js=${Math.round(js / 1024)}KB img=${Math.round(img / 1024)}KB ${JSON.stringify(m)}`);
  });
}
