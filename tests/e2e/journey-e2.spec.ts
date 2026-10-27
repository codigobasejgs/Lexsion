import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signIn(page: Page, who: RegExp) {
  await page.goto("/entrar");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app\//);
}

async function seriousAxe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.length}`);
}

// CPF de teste válido pelo algoritmo, gerado só para testes (não pertence a fixtures).
const CPF = "529.982.247-25";

test("jornada E2: campanha → lead → conversa → cliente → caso, sem duplicar (A03/A04/A05)", async ({ page }, info) => {
  await signIn(page, /Helena Prado/);

  // 1. Formulário de campanha com UTM
  await page.goto("/app/crm/captura");
  await page.getByLabel("Seu nome").fill("Rosa Maria Jornada");
  await page.getByLabel("WhatsApp com DDD").fill("(71) 97777-1234");
  await page.getByRole("button", { name: "Quero ser atendido" }).click();
  await expect(page.getByText("É preciso autorizar o contato para enviar.")).toBeVisible(); // consentimento obrigatório
  await page.getByLabel(/Autorizo o escritório/).check();
  await page.getByRole("button", { name: "Quero ser atendido" }).click();
  await expect(page.getByText("Lead criado no funil")).toBeVisible();
  await expect(page.getByText(/Origem: Meta Ads · BPC Idoso/)).toBeVisible();

  // 2. Conversa criada com assistente; humano assume
  await page.getByRole("link", { name: "Ver conversa" }).click();
  await expect(page.getByRole("heading", { name: "Rosa Maria Jornada" })).toBeVisible();
  await page.getByRole("button", { name: "Assumir atendimento" }).click();
  await expect(page.getByText("Humano no atendimento — assistente pausada")).toBeVisible();

  // 3. Lead no funil com atribuição confirmada
  await page.goto("/app/crm?ver=lista&q=Rosa");
  await page.getByRole("link", { name: "Rosa Maria Jornada" }).click();
  await expect(page.getByText("Vínculo confirmado (UTM/clique)").first()).toBeVisible();
  expect(await seriousAxe(page)).toEqual([]);

  // 4. Converter em cliente
  await page.getByRole("button", { name: "Converter em cliente" }).click();
  const dlg = page.getByRole("dialog", { name: "Converter em cliente" });
  await dlg.getByLabel("CPF").fill("123.456.789-00");
  await dlg.getByLabel("Cidade").fill("Salvador");
  await dlg.getByRole("button", { name: "Criar cliente e vincular" }).click();
  await expect(dlg.getByText("CPF inválido (confira os dígitos).")).toBeVisible();
  await expect(dlg.getByLabel("CPF")).toBeFocused(); // foco vai ao erro
  await dlg.getByLabel("CPF").fill(CPF);
  await dlg.getByRole("button", { name: "Criar cliente e vincular" }).click();
  await expect(page.getByRole("heading", { name: "Convertido em cliente" })).toBeVisible();

  // 5. Abrir caso
  await page.getByRole("button", { name: "Abrir caso" }).click();
  const caseDlg = page.getByRole("dialog", { name: /Abrir caso para Rosa/ });
  await caseDlg.getByRole("button", { name: "Abrir caso" }).click();
  await expect(page.getByText("BPC/LOAS — Rosa")).toBeVisible();
  await page.screenshot({ path: `test-results/ref/${info.project.name}_lead-convertido.png`, fullPage: true });

  // 6. Cliente aparece uma única vez, com origem da campanha preservada
  await page.goto("/app/clientes?q=Rosa");
  const rosa = page.getByText("Rosa Maria Jornada").locator("visible=true");
  await expect(rosa).toHaveCount(1); // tabela e cartões coexistem no DOM; só um layout fica visível
  await rosa.click();
  await expect(page.getByText(/Origem: Meta Ads — BPC Idoso/)).toBeVisible();
  await expect(page.getByRole("link", { name: "ver lead de origem" })).toBeVisible();

  // 7. Mesmo CPF em novo cadastro é bloqueado
  await page.goto("/app/clientes/novo");
  await page.getByLabel("Nome completo").fill("Outra Pessoa Teste");
  await page.getByLabel("CPF").fill(CPF);
  await page.getByLabel("Telefone (WhatsApp)").fill("(71) 96666-0000");
  await page.getByLabel("Cidade").fill("Salvador");
  await expect(page.getByText("Possível cadastro existente")).toBeVisible();
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.getByText(/Já existe cliente com este documento: Rosa Maria Jornada/)).toBeVisible();

  // 8. Reenvio do mesmo telefone pela campanha não cria outro lead
  await page.goto("/app/crm/captura");
  await page.getByLabel("Visitante chega por").selectOption("rural");
  await page.getByLabel("Seu nome").fill("Rosa M. J.");
  await page.getByLabel("WhatsApp com DDD").fill("71 97777 1234");
  await page.getByLabel(/Autorizo o escritório/).check();
  await page.getByRole("button", { name: "Quero ser atendido" }).click();
  await expect(page.getByText("Contato já existia: só o último contato foi atualizado")).toBeVisible();
  await page.getByRole("link", { name: "Ver lead" }).click();
  await expect(page.getByText("Aposentadoria Rural — Google").first()).toBeVisible(); // last touch
  await expect(page.getByText("BPC Idoso — Meta (out/2026)").first()).toBeVisible(); // first touch preservado
});

test("funil: mover sem arrastar, perda exige motivo, contratado exige cliente", async ({ page }) => {
  await signIn(page, /Beatriz Lima/);
  await page.goto("/app/crm");
  expect(await seriousAxe(page)).toEqual([]);
  const card = page.getByRole("listitem").filter({ hasText: "Joana Batista Teste" });
  await card.getByRole("button", { name: /Mover Joana/ }).click();
  const dlg = page.getByRole("dialog", { name: /Mover Joana/ });
  await dlg.getByLabel("Nova etapa").selectOption("contratado");
  await expect(dlg.getByText(/converta o lead em cliente primeiro/)).toBeVisible();
  await dlg.getByRole("button", { name: /Mover para Contratado/ }).click();
  await expect(dlg.getByText("Converta o lead em cliente antes de marcá-lo como contratado.")).toBeVisible();
  await dlg.getByLabel("Nova etapa").selectOption("triagem");
  await dlg.getByRole("button", { name: "Mover para Triagem" }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByRole("listitem", { name: /^Triagem/ }).getByText("Joana Batista Teste")).toBeVisible();

  await page.getByRole("listitem").filter({ hasText: "Joana Batista Teste" }).getByRole("button", { name: /Mover Joana/ }).click();
  await dlg.getByLabel("Nova etapa").selectOption("perdido");
  await dlg.getByLabel("Motivo da perda").selectOption("Sem retorno do contato");
  await dlg.getByRole("button", { name: /Mover para Perdido/ }).click();
  await page.getByLabel("Mostrar perdidos").click();
  await expect(page).toHaveURL(/perdidos=1/);
  await expect(page.getByRole("listitem", { name: /^Perdido/ }).getByText("Joana Batista Teste")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("listitem", { name: /^Perdido/ }).getByText("Joana Batista Teste")).toBeVisible(); // persistiu, filtro na URL
});

test("novo cliente: validação no campo e cadastro persistido", async ({ page, isMobile }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/clientes");
  await page.getByRole("link", { name: "Novo cliente" }).first().click();
  await expect(page).toHaveURL(/\/app\/clientes\/novo/);
  expect(await seriousAxe(page)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.getByText("Informe o nome completo ou razão social.")).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeFocused();
  await page.getByLabel("Nome completo").fill(isMobile ? "Cliente Mobile Teste" : "Cliente Desktop Teste");
  await page.getByLabel("CPF").fill(isMobile ? "111.444.777-35" : "390.533.447-05");
  await page.getByLabel("Telefone (WhatsApp)").fill(isMobile ? "(71) 95555-1111" : "(71) 95555-2222");
  await page.getByLabel("Cidade").fill("Lauro de Freitas");
  await page.getByLabel(/Data de nascimento/).fill("31/02/1970");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.getByText("Data inválida.")).toBeVisible();
  await page.getByLabel(/Data de nascimento/).fill("15/03/1970");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(page.getByText("Cliente cadastrado. Próximo passo: abrir o primeiro caso.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: isMobile ? "Cliente Mobile Teste" : "Cliente Desktop Teste" })).toBeVisible();
});
