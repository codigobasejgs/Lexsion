import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integração REAL com o Supabase do projeto (RUN_REAL=1). Cria e remove dados de QA. `pnpm test:real`.
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }, test: { include: ["tests/real/**/*.real.test.ts"], testTimeout: 60_000, hookTimeout: 180_000, fileParallelism: false } });
