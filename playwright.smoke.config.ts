import { defineConfig, devices } from "@playwright/test";

// Fumaça contra o ambiente PUBLICADO: SMOKE_URL=https://lexsion.vercel.app pnpm test:smoke
// SMOKE_PROXY opcional (rede com túnel). Só fluxos demonstrativos; nenhum dado real.
const proxy = process.env.SMOKE_PROXY ? { server: process.env.SMOKE_PROXY } : undefined;
export default defineConfig({
  testDir: "tests/smoke",
  testMatch: /\.smoke\.ts$/,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL: process.env.SMOKE_URL ?? "https://lexsion.vercel.app", locale: "pt-BR", proxy },
  projects: [
    { name: "prod-desktop", use: { ...devices["Desktop Chrome"], proxy } },
    { name: "prod-mobile", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 }, proxy } },
  ],
});
