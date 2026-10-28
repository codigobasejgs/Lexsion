import { defineConfig, devices } from "@playwright/test";

// Roda contra build de produção (SW ativo). `pnpm build` antes de `pnpm test:e2e`.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100", locale: "pt-BR", timezoneId: "America/Sao_Paulo", colorScheme: "dark",
    // Rede do operador sem acesso direto ao Supabase: E2E_PROXY=http://127.0.0.1:1081 (localhost fica fora do proxy).
    ...(process.env.E2E_PROXY ? { proxy: { server: process.env.E2E_PROXY, bypass: "localhost,127.0.0.1" }, ignoreHTTPSErrors: true } : {}),
  },
  webServer: { command: "pnpm start -p 3100", url: "http://localhost:3100/offline", reuseExistingServer: true, timeout: 120_000 },
  projects: [
    // shots.spec = capturas de revisão visual, só com SHOTS=1.
    { name: "mobile-360", testIgnore: process.env.SHOTS ? /pwa-update/ : /pwa-update|shots/, use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } } },
    { name: "desktop-1440", testIgnore: process.env.SHOTS ? /pwa-update/ : /pwa-update|shots/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // Altera public/sw.js em disco: roda sozinho, depois dos demais.
    { name: "pwa-update", testMatch: /pwa-update/, dependencies: ["mobile-360", "desktop-1440"], use: { ...devices["Desktop Chrome"] } },
    // Prints da ajuda (pnpm capture:help): só rodam com CAPTURE=1.
    ...(process.env.CAPTURE
      ? [
          { name: "help-desktop", testDir: "tests/capture", testMatch: /help\.capture\.ts$/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
          { name: "help-mobile", testDir: "tests/capture", testMatch: /help\.capture\.ts$/, use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
          { name: "landing-desktop", testDir: "tests/capture", testMatch: /landing\.capture\.ts$/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
          { name: "landing-mobile", testDir: "tests/capture", testMatch: /landing\.capture\.ts$/, use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
          { name: "paridade-desktop", testDir: "tests/capture", testMatch: /paridade\.capture\.ts$/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
          { name: "paridade-mobile", testDir: "tests/capture", testMatch: /paridade\.capture\.ts$/, use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
        ]
      : []),
    // Medição de primeira carga (docs/performance.md): só com PERF=1.
    ...(process.env.PERF
      ? [
          { name: "perf-mobile", testDir: "tests/perf", testMatch: /\.perf\.ts$/, use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } } },
          { name: "perf-desktop", testDir: "tests/perf", testMatch: /\.perf\.ts$/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
        ]
      : []),
  ],
});
