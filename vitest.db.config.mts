import { defineConfig } from "vitest/config";

// Testes de banco (migrations + RLS) em Postgres embutido (PGlite). `pnpm test:db`.
export default defineConfig({ test: { include: ["tests/db/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 120_000 } });
