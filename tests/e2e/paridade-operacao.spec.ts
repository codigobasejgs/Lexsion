import { expect, test, type Page } from "@playwright/test";

// Paridade operacional: workflows (TI-02/03/04, E2E-24), follow-up com opt-out (E2E-23), cancelamento de assinatura (E2E-19).
async function signIn(page: Page, who: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app/);
}

test("PAR-OP-01 (E2E-24): workflow aplicado ao caso cria tarefas encadeadas, sem duplicar; a 2ª fica bloqueada até a 1ª concluir", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/workflows");
  await page.getByRole("button", { name: /Aposentadoria com tempo especial/ }).click();
  await page.getByLabel("Aplicar ao caso").selectOption({ label: "Planejamento de aposentadoria" });
  await page.getByRole("button", { name: "Aplicar workflow" }).click();
  await expect(page.getByText("4 tarefa(s) criada(s) no caso, encadeadas.")).toBeVisible();
  await page.getByRole("button", { name: "Aplicar workflow" }).click();
  await expect(page.getByText("Este workflow já foi aplicado a este caso: nada duplicado.")).toBeVisible();
  await page.getByRole("link", { name: "Ver tarefas do caso" }).click();
  await expect(page.getByText(/1\/4 · Pedir PPP e LTCAT/).first()).toBeVisible();
  await expect(page.getByText(/4\/4 · Requerimento ou petição/).first()).toBeVisible();
  await page.goto("/app/tarefas");
  const c2 = page.getByRole("checkbox", { name: /Concluir 2\/4 · Conferir PPP por período/ }).locator("visible=true").first();
  await expect(c2).toBeDisabled(); // aguarda a 1ª etapa
  const c1 = page.getByRole("checkbox", { name: /Concluir 1\/4 · Pedir PPP e LTCAT/ }).locator("visible=true").first();
  await c1.click(); // checkbox controlado: marca depois de gravar
  await expect(c1).toBeChecked();
  await expect(c2).toBeEnabled();
});

test("PAR-OP-02 (E2E-23): follow-up simulado respeita opt-out — depois do opt-out nada mais é registrado como enviado", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-26T10:00:00-03:00"));
  await signIn(page, /Helena Prado/);
  await page.goto("/app/crm/leads/l-01");
  const fu = page.getByTestId("follow-up");
  await expect(fu).toContainText("Pode receber lembrete");
  await fu.getByRole("button", { name: "Simular follow-up" }).click();
  await expect(fu).toContainText("registrado — Lembrete simulado registrado (nada foi enviado)");
  await fu.getByRole("button", { name: "Registrar opt-out" }).click();
  await expect(fu).toContainText("Opt-out em");
  await fu.getByRole("button", { name: "Simular follow-up" }).click();
  await expect(fu).toContainText("bloqueado — Pediu para não receber mensagens (opt-out): nenhum envio.");
  await expect(fu.getByRole("listitem").filter({ hasText: "registrado —" })).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("follow-up")).toContainText("Opt-out em"); // persiste
});

test("PAR-OP-03 (E2E-19): cancelar envio exige motivo, entra na trilha, não gera parcelas e permite nova versão", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/contratos/ct-ronaldo");
  await page.getByRole("button", { name: "Cancelar envio" }).click();
  const d = page.getByRole("dialog", { name: "Cancelar envio para assinatura?" });
  await expect(d.getByRole("button", { name: "Cancelar envio" })).toBeDisabled();
  await d.getByLabel("Motivo (vai para a trilha)").fill("Cliente pediu ajuste no valor");
  await d.getByRole("button", { name: "Cancelar envio" }).click();
  await expect(page.getByText("Envio cancelado (simulação).")).toBeVisible();
  await expect(page.getByText(/Envio cancelado \(simulação\): Cliente pediu ajuste no valor/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Simular assinatura" })).toHaveCount(0);
  await page.getByRole("button", { name: "Corrigir e gerar nova versão" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/ct-ronaldo"));
  await expect(page.getByRole("button", { name: "Enviar para assinatura (simulação)" })).toBeVisible();
});
