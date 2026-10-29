import type { Page } from "@playwright/test";
import { serverNow, totp } from "../shared/totp";
export { totp };

/** No /admin real: cadastra o TOTP pela tela (QR + chave) e confirma; devolve o segredo para logins seguintes. */
export async function passMfa(page: Page, known?: string): Promise<string> {
  await page.getByRole("heading", { name: "Verificação em duas etapas" }).waitFor({ timeout: 60_000 });
  let secret = known;
  if (!secret) {
    await page.getByText("Não consigo escanear").click();
    secret = (await page.locator("details code").innerText()).trim();
  }
  // Hora do servidor de Auth (relógio local pode divergir); evita a virada da janela de 30 s.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (await import("node:fs")).readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1] ?? "";
  let now = await serverNow(url);
  if (now % 30_000 > 26_000) { await page.waitForTimeout(30_000 - (now % 30_000) + 500); now = await serverNow(url); }
  await page.getByLabel("Código do autenticador").fill(totp(secret, now));
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByRole("heading", { name: "Verificação em duas etapas" }).waitFor({ state: "detached", timeout: 60_000 });
  return secret;
}
