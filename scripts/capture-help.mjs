// pnpm capture:help — gera os prints reais da central de ajuda contra o build de produção.
// Pré-requisito: `pnpm build`. Saída: public/help/screenshots/<versao>/<slug>-<passo>[-mobile].png + manifest.json
import { spawnSync } from "node:child_process";

const r = spawnSync("pnpm", ["exec", "playwright", "test", "--project=help-desktop", "--project=help-mobile", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CAPTURE: "1" },
});
process.exit(r.status ?? 1);
