import { expect, test, type Page } from "@playwright/test";

// Fluxos A–J complementares aos de journeys.spec.ts (que cobre A, C, D, J parcial e I).
async function signIn(page: Page, who: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/(app|portal|admin)(\/|$)/);
}

test("FLUXO G / PORT-02: rascunho não vaza ao portal; publicado aparece só para o cliente certo", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/casos/k-maria-bpc");
  const portal = page.locator('[data-tour="portal-atualizacao"]');
  await portal.getByText("Escrever atualização para o cliente").click();
  await portal.getByLabel(/O que aconteceu/).fill("Recebemos o comprovante e o pedido seguirá ao INSS.");
  await portal.getByLabel("Próximo passo para o cliente").fill("Aguardar o agendamento.");
  await portal.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(portal.getByText("Rascunho interno — o cliente NÃO vê")).toBeVisible();

  // Cliente ainda não vê
  await page.goto("/entrar");
  await signIn(page, /Cliente \(portal\)/);
  await page.goto("/portal/casos/k-maria-bpc");
  await expect(page.getByText("Recebemos o comprovante e o pedido seguirá ao INSS.")).toHaveCount(0);

  // Advogada publica
  await signIn(page, /Helena Prado/);
  await page.goto("/app/casos/k-maria-bpc");
  await page.getByRole("button", { name: "Publicar no portal" }).click();
  await expect(page.getByText("Publicado no portal do cliente.")).toBeVisible();

  await signIn(page, /Cliente \(portal\)/);
  await page.goto("/portal/casos/k-maria-bpc");
  await expect(page.getByText("Recebemos o comprovante e o pedido seguirá ao INSS.").first()).toBeVisible();
  await expect(page.getByText("Próximo passo: Aguardar o agendamento.")).toBeVisible();
  // PORT-01: caso de outro cliente não abre
  await page.goto("/portal/casos/k-joao-apos");
  await expect(page.getByText("Caso não encontrado")).toBeVisible();
});

test("FLUXO E: notícia → caso → tarefa de revisão, sem duplicar no clique repetido", async ({ page }) => {
  await signIn(page, /Rafael Nunes/);
  await page.goto("/app/jornal");
  await page.locator('main a[href^="/app/jornal/"]').filter({ hasNotText: "Alertas" }).first().click();
  const btn = page.getByRole("button", { name: "Criar tarefa de revisão" }).first();
  await btn.click();
  await btn.click();
  await expect(page.getByText("Tarefa de revisão criada.")).toBeVisible();
  await page.goto("/app/tarefas?ver=lista");
  await expect(page.getByText(/^Revisar impacto de notícia/).locator("visible=true")).toHaveCount(1);
});

test("HELP: “Como usar esta tela?” abre artigo e tour; artigo tem botões de ação", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/minutas/dr-lucia");
  await page.getByLabel("Como usar esta tela?").click();
  await page.getByRole("button", { name: "Fazer o tour guiado desta tela" }).click();
  const pop = page.getByTestId("tour-popover");
  await expect(pop.getByText("Texto da minuta")).toBeVisible();
  await page.keyboard.press("Escape"); // A11Y: fecha por teclado
  await expect(pop).toBeHidden();
  await page.getByLabel("Como usar esta tela?").click();
  await page.getByRole("link", { name: /Ler: Revisar e aprovar minuta/ }).click();
  await expect(page.getByRole("link", { name: "Abrir esta funcionalidade" })).toBeVisible();
  await page.getByRole("button", { name: "Iniciar tour guiado" }).click();
  await expect(page).toHaveURL(/\/app\/minutas\/dr-lucia/);
  await expect(pop).toBeVisible();
});

test("HELP-05: busca por sinônimo leigo encontra o artigo certo", async ({ page }) => {
  await signIn(page, /Beatriz Lima/);
  await page.goto("/app/ajuda");
  await page.getByRole("searchbox", { name: "Buscar na ajuda" }).fill("boleto");
  await expect(page.getByRole("link", { name: /pagamento parcial/i })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar na ajuda" }).fill("xyzinexistente");
  await expect(page.getByText(/Nenhum artigo encontrado/)).toBeVisible();
});

test("ADM-09: livros da autora sem conteúdo fabricado", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/academia");
  await expect(page.getByText("Aguardando material da autora")).toHaveCount(2);
});

test("FIN-10 / ADM-08: provedores de pagamento e assinatura não aparecem como conectados; sem credenciais na página", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  for (const p of ["asaas", "mercadopago", "infinitepay", "zapsign"]) {
    await page.goto(`/app/integracoes/${p}`);
    await expect(page.getByText(/Operacional \(demo\)/)).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toMatch(/(api[_-]?key|secret|token)["']?\s*[:=]\s*["'][A-Za-z0-9_-]{12,}/i);
  }
});

test("GEN-01: cada perfil entra no painel adequado", async ({ page }) => {
  const cases: [RegExp, RegExp][] = [[/Helena Prado/, /\/app\/inicio/], [/Caio Martins/, /\/app\/inicio/], [/Cliente \(portal\)/, /\/portal$/], [/Suporte SIWILTEC/, /\/admin\/organizacoes/]];
  for (const [who, url] of cases) {
    await signIn(page, who);
    await expect(page).toHaveURL(url);
    await expect(page.locator("h1").first()).toBeVisible();
  }
});

test("GEN-09: restaurar demonstração apaga alterações e recria fixtures", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/clientes/novo");
  await page.getByLabel("Nome completo").fill("Cliente Para Apagar");
  await page.getByLabel("CPF").fill("111.444.777-35");
  await page.getByLabel("Telefone (WhatsApp)").fill("(71) 95555-9999");
  await page.getByLabel("Cidade").fill("Salvador");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.getByRole("heading", { name: "Cliente Para Apagar" })).toBeVisible();
  await page.goto("/app/configuracoes?aba=dados");
  await page.getByRole("button", { name: "Restaurar demonstração" }).click();
  await page.getByRole("button", { name: "Restaurar agora" }).click();
  await expect(page.getByText("Demonstração restaurada.")).toBeVisible();
  await page.goto("/app/clientes");
  await expect(page.getByText("Cliente Para Apagar")).toHaveCount(0);
  await expect(page.getByText("Maria das Graças Exemplo").locator("visible=true").first()).toBeVisible();
});

test("A11Y-04: prefers-reduced-motion zera animações", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, /Helena Prado/);
  const d = await page.evaluate(() => getComputedStyle(document.querySelector(".btn")!).transitionDuration);
  expect(parseFloat(d)).toBeLessThan(0.02);
});

test("SEC-03: exportação CSV do caixa neutraliza fórmula vinda de dado digitado", async ({ page, isMobile }) => {
  test.skip(isMobile, "uma execução basta");
  await signIn(page, /Caio Martins/);
  await page.goto("/app/financeiro/receber?visao=todas&cliente=c-joao");
  await page.locator("tr").filter({ hasText: "Parcela 6/7" }).getByRole("button", { name: "Registrar pagamento" }).click();
  const dlg = page.getByRole("dialog", { name: "Registrar pagamento" });
  await dlg.getByLabel("Valor recebido (R$)").fill("10,00");
  await dlg.getByLabel("Origem / justificativa").fill("=1+1");
  await dlg.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(dlg).toBeHidden();
  await page.goto("/app/financeiro/caixa");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar CSV" }).click()]);
  const text = (await import("node:fs")).readFileSync(await dl.path(), "utf8");
  const cells = text.split(/[;,\r\n]/).map((c) => c.replace(/^"|"$/g, "").trim());
  expect(cells.some((c) => /^[=+@]/.test(c))).toBe(false);
});

test("FLUXO A: atendimento → triagem → atribuição → conversão → caso → indicador do funil", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, /Beatriz Lima/);
  const count = async () => { await page.goto("/app/crm"); return Number((await page.getByRole("listitem", { name: /^Triagem, \d+ lead/ }).getAttribute("aria-label"))!.match(/(\d+)/)![1]); };
  const triagemAntes = await count();
  await page.goto("/app/crm/leads/l-novo");
  const tri = page.locator('[data-tour="triagem"]');
  await tri.getByLabel("Área do Direito").selectOption("Previdenciário");
  await tri.getByRole("button", { name: "Registrar triagem e encaminhar" }).click();
  await expect(tri.getByText(/Responda antes de encaminhar/)).toBeVisible(); // CRM-02: falta resposta
  for (const q of ["Já teve pedido negado pelo INSS?", "Trabalhou exposto a ruído, calor ou agentes nocivos?", "Há doença ou incapacidade envolvida?"]) await tri.getByRole("group", { name: q }).getByLabel("Não").check();
  await tri.getByRole("group", { name: "Trabalhou no campo em algum período?" }).getByLabel("Sim").check();
  await expect(tri.getByText("Provas de atividade rural (sindicato, notas, ITR)")).toBeVisible();
  await tri.getByLabel("Encaminhar para").selectOption({ label: "Rafael Nunes" });
  await tri.getByRole("button", { name: "Registrar triagem e encaminhar" }).click();
  await expect(page.getByText("Triagem registrada e encaminhada para revisão profissional.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Triagem" }).and(page.locator('[aria-current="step"]'))).toBeVisible();
  await expect(page.getByLabel("Responsável", { exact: true })).toHaveValue("u-rafael");
  // Indicador do funil reflete a mudança
  expect(await count()).toBe(triagemAntes + 1);
});

test("ADM-01: perfil Controladoria vê prazos e agenda, não vê financeiro nem CRM", async ({ page }) => {
  await signIn(page, /Dora Sampaio/);
  await page.goto("/app/prazos");
  await expect(page.getByRole("heading", { name: "Prazos" })).toBeVisible();
  for (const r of ["/app/financeiro", "/app/crm"]) {
    await page.goto(r);
    await expect(page.getByRole("heading", { name: "Você não tem acesso a esta área" })).toBeVisible();
  }
});

test("FIN-06: filtro por mês no caixa recalcula totais e saldo inicial", async ({ page }) => {
  await signIn(page, /Caio Martins/);
  await page.goto("/app/financeiro/caixa");
  const total = await page.getByText("Resultado do período").locator("..").locator(".num").innerText();
  await page.getByLabel("Período").selectOption("2026-09");
  await expect(page).toHaveURL(/mes=2026-09/);
  await expect(page.getByText(/Saldo inicial R\$\s1\.200,00/)).toBeVisible(); // ago/2026: 800 + 400
  const sep = await page.getByText("Resultado do período").locator("..").locator(".num").innerText();
  expect(sep).not.toBe(total);
  await page.reload();
  await expect(page.getByLabel("Período")).toHaveValue("2026-09");
});

test("CRM-05: lista com paginação, filtro volta à página 1 e limpar filtro restaura", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/crm?ver=lista");
  await expect(page.getByRole("status").filter({ hasText: /^1–10 de \d+/ })).toBeVisible();
  await page.getByRole("button", { name: "Próxima" }).click();
  await expect(page).toHaveURL(/pagina=2/);
  await expect(page.getByRole("status").filter({ hasText: /^11–/ })).toBeVisible();
  await page.getByPlaceholder("Nome, telefone ou serviço").fill("Joana");
  await expect(page).not.toHaveURL(/pagina=/);
  await expect(page.getByRole("link", { name: "Joana Batista Teste" })).toBeVisible();
  await page.getByPlaceholder("Nome, telefone ou serviço").fill("");
  await expect(page.getByRole("status").filter({ hasText: /^1–10 de/ })).toBeVisible();
});
