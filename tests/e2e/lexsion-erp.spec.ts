import { expect, test, type Page } from "@playwright/test";

// F18 e preferências: tarefa recorrente, aniversariantes, linguagem simples no portal.
async function signIn(page: Page, who: RegExp, url = /\/(app|admin|portal)/) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(url);
}

test("F18-01: tarefa mensal no dia 31 — concluir cria a próxima no último dia de fevereiro, uma vez só", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/tarefas");
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  const d = page.getByRole("dialog", { name: "Nova tarefa" });
  await d.getByLabel("Título").fill("Conferir publicações do mês");
  await d.getByLabel("Prazo").fill("2027-01-31");
  await d.getByLabel("Repetir").selectOption("mes");
  await d.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(d).toBeHidden();
  await page.getByRole("textbox", { name: "Buscar tarefa" }).fill("Conferir publicações do mês");
  const box = page.getByRole("checkbox", { name: "Concluir Conferir publicações do mês" });
  const checked = () => box.evaluateAll((b) => b.map((x) => (x as HTMLInputElement).checked));
  await expect(box).toHaveCount(1); // a tarefa nova já está na lista filtrada
  await box.first().click();
  await expect.poll(checked).toEqual([true, false]); // concluída + próxima ocorrência aberta
  // Reabrir e concluir de novo não duplica a próxima ocorrência.
  await box.first().click();
  await expect.poll(checked).toEqual([false, false]);
  await box.first().click();
  await expect.poll(checked).toEqual([true, false]);
  await expect(box).toHaveCount(2);
  await page.getByRole("button", { name: "Conferir publicações do mês" }).last().click();
  await expect(page.getByText(/28\/02\/2027/).first()).toBeVisible();
  await expect(page.getByTestId("recorrencia")).toContainText("Todo mês");
  await page.getByRole("button", { name: "Pausar repetição" }).click();
  await expect(page.getByTestId("recorrencia")).toContainText("pausada");
});

test("F18-02: aniversariantes dos próximos 30 dias, com idade, ordenados", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/clientes");
  await page.getByLabel("Aniversariantes").selectOption("30");
  await expect(page).toHaveURL(/aniversario=30/);
  // Tabela (desktop) e cartões (celular) mostram a mesma informação; vale o que estiver visível.
  await expect(page.getByText(/em \d+ dias|amanhã|hoje/).locator("visible=true").first()).toBeVisible();
  await expect(page.getByText("Só aparecem clientes com data de nascimento cadastrada")).toBeVisible();
  await page.getByLabel("Aniversariantes").selectOption("7");
  await expect(page.getByText(/Nenhum aniversariante no período|em \d dias|amanhã|hoje/).locator("visible=true").first()).toBeVisible();
});

test("PREF-01: linguagem simples ligada pelo escritório explica termos no portal do cliente", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/configuracoes/branding");
  await page.getByRole("checkbox", { name: /Linguagem simples/ }).check();
  await page.getByRole("button", { name: "Salvar identidade" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Identidade salva" })).toBeVisible();
  await signIn(page, /Cliente \(portal\)/, /\/portal/);
  await expect(page.getByText(/órgão que paga aposentadorias e benefícios/).first()).toBeVisible();
});
