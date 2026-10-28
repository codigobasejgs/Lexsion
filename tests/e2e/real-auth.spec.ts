import fs from "node:fs";
import { expect, test } from "@playwright/test";

// Login REAL contra o Supabase do projeto (não é mock). Usa um usuário de QA dedicado (domínio .invalid),
// criado pelo operador e com credenciais só em .env.local. Sem essas variáveis, o teste é PULADO (não "passa").
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }

test("REAL-AUTH-01: senha correta autentica no Supabase, mas conta sem vínculo não entra e a sessão é encerrada", async ({ page }) => {
  test.skip(!env.QA_NOLINK_EMAIL || !env.QA_NOLINK_PASSWORD, "usuário de QA não configurado neste ambiente");
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(env.QA_NOLINK_EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(env.QA_NOLINK_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "ainda não está vinculada a um escritório" })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/entrar/);
  const auth = (await page.context().cookies()).filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token") && c.value);
  expect(auth).toEqual([]); // signOut no servidor removeu a sessão
});
