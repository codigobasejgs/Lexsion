import { expect, test, type Page } from "@playwright/test";

// FLUXO J — falhas e recuperação.
async function signIn(page: Page, who: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app\//);
}

test("ROB-01: localStorage e IndexedDB bloqueados ⇒ entra, opera em memória e avisa", async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => { throw new DOMException("bloqueado (teste)", "SecurityError"); };
    Object.defineProperty(window, "localStorage", { get: deny, configurable: true });
    Object.defineProperty(window, "sessionStorage", { get: deny, configurable: true });
    Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/entrar");
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await expect(page.getByRole("heading", { name: /Olá, Helena/ })).toBeVisible();
  await expect(page.getByTestId("aviso-armazenamento")).toBeVisible();
  // Operação real em memória (navegação client-side mantém a sessão volátil)
  const done = page.getByRole("button", { name: "Concluir" }).first();
  const before = await page.getByRole("button", { name: "Concluir" }).count();
  await done.click();
  await expect(page.getByRole("button", { name: "Concluir" })).toHaveCount(before - 1);
  expect(errors).toEqual([]);
});

test("ROB-02: sessão corrompida e banco de versão antiga não quebram a interface", async ({ page }) => {
  await page.goto("/entrar");
  await page.evaluate(async () => {
    localStorage.setItem("siwiltec.session", "{isto não é json");
    await new Promise<void>((resolve) => {
      const r = indexedDB.open("siwiltec-demo", 1); // versão antiga
      r.onsuccess = () => { r.result.close(); resolve(); };
      r.onerror = () => resolve();
      r.onupgradeneeded = () => r.result.createObjectStore("lixo");
    });
  });
  await page.goto("/app/inicio");
  await expect(page).toHaveURL(/\/entrar/); // sessão inválida ⇒ volta para entrar, sem tela branca
  await signIn(page, /Helena Prado/);
  await expect(page.getByRole("heading", { name: /Olá, Helena/ })).toBeVisible();
  await page.goto("/app/clientes");
  await expect(page.getByText("Maria das Graças Exemplo").locator("visible=true").first()).toBeVisible(); // fixtures recriadas
});

test("ROB-03: duas abas — alteração numa aba aparece na outra", async ({ page, context }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/tarefas?ver=lista");
  const other = await context.newPage();
  await other.goto("/app/tarefas?ver=lista");
  const first = page.getByRole("checkbox", { name: /^Concluir/, checked: false, disabled: false }).first();
  const label = (await first.getAttribute("aria-label"))!;
  const mirror = other.getByRole("checkbox", { name: label, exact: true });
  await expect(mirror.first()).not.toBeChecked(); // outra aba já carregada antes da alteração
  const before = await mirror.evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length);
  const mine = page.getByRole("checkbox", { name: label, exact: true });
  const mineBefore = await mine.evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length);
  await first.click();
  await expect.poll(() => mine.evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length)).toBe(mineBefore + 1);
  await expect.poll(() => mirror.evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length)).toBe(before + 1);
});

test("GEN-03/GEN-04: refresh em rota profunda e voltar/avançar preservam contexto", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/crm?ver=lista&q=Joana");
  await page.reload();
  await expect(page.getByPlaceholder("Nome, telefone ou serviço")).toHaveValue("Joana");
  await page.goto("/app/clientes/c-joao");
  await page.goBack();
  await expect(page).toHaveURL(/q=Joana/);
  await page.goForward();
  await expect(page.getByRole("heading", { name: /João Batista Fictício/ })).toBeVisible();
  await page.goto("/app/nao-existe");
  await expect(page.getByRole("heading", { name: /não encontrada/i })).toBeVisible();
});

test("PWA-03: offline mostra aviso e some ao reconectar", async ({ page, context }) => {
  await signIn(page, /Helena Prado/);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText(/Sem conexão/)).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/Sem conexão/)).toHaveCount(0);
});
