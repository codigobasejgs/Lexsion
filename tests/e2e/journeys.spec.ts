import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Seis jornadas do prompt mestre (seção 11) + isolamento do portal + axe/overflow das rotas E3–E7.
async function signIn(page: Page, who: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/(app|portal|admin)(\/|$)/);
}
const visible = (page: Page, text: string | RegExp) => page.getByText(text).locator("visible=true").first();
async function seriousAxe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

test("1. campanha → proposta → contrato assinado → parcelas → portal", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, /Helena Prado/);
  // Proposta enviada da campanha (fixture pp-quiteria: lead de campanha) → aceite simulado
  await page.goto("/app/propostas/pp-quiteria");
  await page.getByRole("button", { name: "Simular aceite" }).click();
  await expect(page.getByRole("link", { name: "Converter o lead em cliente primeiro" })).toBeVisible(); // não gera contrato sem cliente
  // Usa proposta já aceita de cliente convertido: contrato enviado aguardando assinaturas
  await page.goto("/app/contratos/ct-ronaldo");
  const signers = page.locator('[data-tour="signatarios"]');
  await signers.getByRole("button", { name: "Simular assinatura" }).first().click();
  await expect(page.getByText(/Assinatura registrada|Contrato concluído/)).toBeVisible();
  // Só conclui com todos os obrigatórios
  await expect(page.getByText(/Parcelas geradas/)).toHaveCount(0); // falta a contratada (obrigatória)
  await signers.getByRole("listitem").filter({ hasText: "Helena Prado" }).getByRole("button", { name: "Simular assinatura" }).click();
  // Testemunha opcional não assinou (sem "Reenviar evento"); contrato conclui mesmo assim
  await expect(signers.getByRole("listitem").filter({ hasText: "Testemunha" }).getByRole("button")).toHaveCount(0);
  await expect(page.getByText(/Contrato concluído: \d+ parcela\(s\) criada\(s\)/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Parcelas geradas \(1\)/ })).toBeVisible();
  // Reenvio do evento não duplica
  await signers.getByRole("button", { name: "Reenviar evento" }).first().click();
  await expect(page.getByText("Evento repetido ignorado: nada mudou.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Parcelas geradas \(1\)/ })).toBeVisible();
});

test("2. planejamento previdenciário: pendência invalida resultado e exige revisão", async ({ page }) => {
  await signIn(page, /Rafael Nunes/);
  await page.goto("/app/previdenciario/analises/pa-joao");
  await expect(page.locator('[data-tour="cenarios"]')).toBeVisible();
  await expect(page.getByText(/cálculo jurídico não validado/)).toBeVisible();
  await page.getByRole("checkbox").first().click();
  await expect(visible(page, "Resultado desatualizado")).toBeVisible();
  await page.getByRole("button", { name: "Marcar exemplo como revisado" }).click();
  await expect(page.getByText("Resultado desatualizado")).toHaveCount(0);
  expect(await seriousAxe(page)).toEqual([]);
});

test("3. operação jurídica: prazo proposto → confirmado → agenda e Meu dia", async ({ page }) => {
  await signIn(page, /Rafael Nunes/);
  await page.goto("/app/prazos");
  await page.getByRole("button", { name: "Novo prazo" }).click();
  const dlg = page.getByRole("dialog", { name: "Novo prazo (proposto)" });
  await dlg.getByLabel("Caso").selectOption("k-sonia-incap");
  await dlg.getByLabel("Título").fill("Réplica E2E");
  await dlg.getByLabel("Quantidade de dias").fill("5");
  await expect(dlg.getByText(/Memória de contagem/)).toBeVisible();
  await dlg.getByRole("button", { name: "Registrar prazo proposto" }).click();
  await expect(dlg).toBeHidden();
  const item = page.locator("li").filter({ hasText: "Réplica E2E" });
  await item.getByRole("button", { name: "Conferir e confirmar" }).click();
  const conf = page.getByRole("dialog", { name: /Confirmar prazo: Réplica E2E/ });
  await conf.getByRole("button", { name: "Confirmar prazo" }).click();
  await expect(conf).toBeHidden();
  await expect(item.getByText(/Confirmado:/)).toBeVisible();
  await page.goto("/app/agenda");
  await expect(visible(page, "Prazo: Réplica E2E")).toBeVisible();
  await page.goto("/app/inicio?tipo=juridico");
  await expect(visible(page, "Réplica E2E")).toBeVisible();
});

test("4. financeiro: entrada + 7 parcelas, parcial, renegociação, recibo e conciliação", async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await signIn(page, /Caio Martins/);
  await page.goto("/app/financeiro/receber?visao=todas&cliente=c-joao");
  for (const l of ["Entrada", "Parcela 1/7", "Parcela 7/7"]) await expect(visible(page, l)).toBeVisible();
  const row = isMobile ? page.locator("li").filter({ hasText: "Parcela 5/7" }).first() : page.locator("tr").filter({ hasText: "Parcela 5/7" });
  await row.getByRole("button", { name: "Registrar pagamento" }).click();
  const pay = page.getByRole("dialog", { name: "Registrar pagamento" });
  await pay.getByLabel("Valor recebido (R$)").fill("150,00");
  await pay.getByLabel("Origem / justificativa").fill("Pix parcial");
  await pay.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(pay).toBeHidden();
  await row.getByText("João Batista Fictício").click();
  const det = page.getByRole("dialog", { name: /Parcela 5\/7/ });
  await det.getByRole("button", { name: "Renegociar saldo" }).click();
  await det.getByLabel("Descrição do acordo").fill("Acordo E2E");
  await det.getByRole("button", { name: "Confirmar renegociação" }).click();
  await expect(det).toBeHidden();
  await expect(visible(page, /Parcela 1\/2 \(acordo\)/)).toBeVisible(); // saldo migrou para o acordo; original preservada
  // Recibo do pagamento parcial
  await row.getByText("João Batista Fictício").click();
  await page.getByRole("dialog", { name: /Parcela 5\/7/ }).getByRole("button", { name: "Recibo" }).click();
  await expect(page).toHaveURL(/\/app\/financeiro\/recibos\?id=/);
  await expect(visible(page, /cento e cinquenta reais/i)).toBeVisible();
  // Conciliação: linha duplicada ignorada com justificativa
  await page.goto("/app/financeiro/conciliacao");
  const line = page.locator('[data-tour="extrato"] li').filter({ hasText: "REMETENTE DESCONHECIDO" });
  await line.getByRole("button", { name: "Decidir" }).click();
  const dec = page.getByRole("dialog", { name: /Conciliar/ });
  await dec.getByLabel(/Ignorar/).check();
  await expect(dec.getByRole("button", { name: "Concluir conciliação" })).toBeDisabled();
  await dec.getByLabel("Justificativa").fill("Repasse, não é honorário");
  await dec.getByRole("button", { name: "Concluir conciliação" }).click();
  await expect(line.getByText("Ignorado")).toBeVisible();
});

test("5. falha de integração: desconecta, fila, reconecta e reenvia sem duplicar", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/integracoes/evolution");
  await page.getByRole("button", { name: "Simular desconexão" }).click();
  await expect(page.getByText(/WhatsApp desconectado \(simulação\)/)).toBeVisible();
  await page.goto("/app/atendimento/cv-maria");
  await expect(page.getByText(/Suas respostas ficam na fila/)).toBeVisible();
  await page.getByRole("button", { name: "Assumir atendimento" }).click();
  await page.getByRole("radio", { name: "Responder ao cliente" }).click();
  await page.getByLabel("Mensagem ao cliente").fill("Mensagem durante a queda");
  await page.getByRole("button", { name: /Enviar/ }).click();
  const log = page.getByRole("log", { name: "Mensagens" });
  await expect(log.getByText("Na fila (simulada)").last()).toBeVisible();
  await page.goto("/app/integracoes/evolution");
  await expect(page.getByText(/Fila de saída: 1/)).toBeVisible();
  await page.getByRole("button", { name: "Simular reconexão" }).click();
  await expect(page.getByText("Reconectado. 1 mensagem(ns) reenviada(s), sem duplicar.")).toBeVisible();
  await expect(page.getByText(/Fila de saída: 0/)).toBeVisible();
  await page.goto("/app/atendimento/cv-maria");
  await expect(log.getByText("Mensagem durante a queda")).toHaveCount(1);
});

test("6. aprendizagem: tour pausado e retomado; artigo abre", async ({ page }) => {
  await signIn(page, /Beatriz Lima/);
  await page.goto("/app/academia");
  await page.getByTestId("tour-primeiro-acesso").getByRole("button", { name: "Iniciar tour" }).click();
  const pop = page.getByTestId("tour-popover");
  await expect(pop.getByText("passo 1 de 3")).toBeVisible();
  await pop.getByRole("button", { name: "Avançar" }).click();
  await expect(pop.getByText("passo 2 de 3")).toBeVisible();
  await pop.getByRole("button", { name: "Pausar" }).click();
  await expect(pop).toBeHidden();
  await page.goto("/app/academia");
  const card = page.getByTestId("tour-primeiro-acesso");
  await expect(card.getByText("Pausado no passo 2")).toBeVisible();
  await card.getByRole("button", { name: "Retomar" }).click();
  await expect(pop.getByText("passo 2 de 3")).toBeVisible();
  await pop.getByRole("button", { name: "Avançar" }).click();
  await pop.getByRole("button", { name: "Concluir" }).click();
  await page.goto("/app/academia");
  await expect(page.getByTestId("tour-primeiro-acesso").getByText("Concluído")).toBeVisible();
  await page.goto("/app/ajuda");
  await page.getByRole("searchbox", { name: "Buscar na ajuda" }).fill("cadastrar cliente");
  await page.getByRole("link", { name: /Cadastrar cliente/ }).click();
  await expect(page.getByRole("heading", { name: "Cadastrar cliente" })).toBeVisible();
  await expect(page.getByText("Passo a passo")).toBeVisible();
});

test("tour não fica preso quando o alvo não existe para o perfil (A15)", async ({ page }) => {
  await signIn(page, /Lia Torres/);
  await page.goto("/app/academia");
  await page.getByTestId("tour-caso").getByRole("button", { name: "Iniciar tour" }).click();
  const pop = page.getByTestId("tour-popover");
  await pop.getByRole("button", { name: "Avançar" }).click(); // passo 2: confirmar prazo — estagiário não confirma, mas botão existe; garante navegação de rota
  await expect(page).toHaveURL(/\/app\/prazos/);
  await expect(pop).toBeVisible();
  await pop.getByRole("button", { name: /Concluir/ }).click();
  await expect(pop).toBeHidden();
});

test("portal: cliente só vê o próprio caso e não acessa o painel interno", async ({ page }) => {
  await signIn(page, /Cliente \(portal\)/);
  await expect(page.getByRole("heading", { name: /Olá, Maria/ })).toBeVisible();
  await expect(page.getByText("João Batista Fictício")).toHaveCount(0);
  await page.goto("/app/financeiro");
  await expect(page).toHaveURL(/\/portal/);
  await page.goto("/portal/pagamentos");
  await expect(page.getByText(/Parcela 1\/4|Entrada/).first()).toBeVisible();
  await expect(page.getByText("Parcela 1/7")).toHaveCount(0);
});

test("superadmin vê só organizações agregadas", async ({ page }) => {
  await signIn(page, /Suporte LexSion/);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/organizacoes");
  await expect(page.getByRole("heading", { name: "Contratantes" })).toBeVisible();
  await expect(page.getByText("Maria das Graças Exemplo")).toHaveCount(0);
  expect(await seriousAxe(page)).toEqual([]);
});

const ROUTES = [
  "/app/casos", "/app/casos/k-maria-bpc", "/app/processos", "/app/publicacoes", "/app/prazos", "/app/tarefas", "/app/agenda", "/app/audiencias", "/app/pericias",
  "/app/documentos", "/app/documentos/doc-cnis-joao", "/app/previdenciario", "/app/calculos", "/app/requisitorios", "/app/pesquisa", "/app/minutas", "/app/modelos",
  "/app/propostas", "/app/propostas/pp-paulo", "/app/contratos/ct-ronaldo", "/app/financeiro/receber", "/app/financeiro/caixa", "/app/financeiro/conciliacao", "/app/financeiro/recibos", "/app/pagamentos",
  "/app/ia/agentes", "/app/ia/simulador", "/app/automacoes", "/app/marketing/campanhas", "/app/jornal", "/app/integracoes", "/app/integracoes/evolution", "/app/importacoes",
  "/app/relatorios", "/app/equipe", "/app/configuracoes", "/app/academia", "/app/ajuda", "/app/ajuda/baixa-parcial", "/app/boas-vindas",
  "/app/assinaturas", "/app/automacoes/execucoes", "/app/financeiro/pagar", "/app/ia/execucoes", "/app/ia/objecoes", "/app/integracoes/eventos",
  "/app/jornal/alertas", "/app/marketing/conteudos", "/app/marketing/paginas", "/design-system",
];
test.describe("rotas E3–E7: render, sem overflow, sem violação axe séria", () => {
  for (const r of ROUTES) {
    test(r, async ({ page }) => {
      await signIn(page, /Helena Prado/);
      await page.goto(r);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.getByText(/não encontrad/i)).toHaveCount(0);
      await noOverflow(page);
      expect(await seriousAxe(page)).toEqual([]);
    });
  }
  test("tema claro: telas principais sem violação séria de contraste", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("siwiltec.theme", "light"));
    await signIn(page, /Helena Prado/);
    for (const r of ["/app/inicio", "/app/crm", "/app/clientes/c-joao", "/app/previdenciario/analises/pa-joao", "/app/financeiro", "/app/minutas/dr-lucia", "/app/marketing/paginas", "/app/academia", "/app/ajuda/baixa-parcial", "/app/configuracoes"]) {
      await page.goto(r);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      expect(await seriousAxe(page), r).toEqual([]);
    }
  });
  test("/portal/ajuda e /portal/documentos (cliente)", async ({ page }) => {
    await signIn(page, /Cliente \(portal\)/);
    for (const r of ["/portal/ajuda", "/portal/documentos"]) {
      await page.goto(r);
      await expect(page.locator("h1").first()).toBeVisible();
      await noOverflow(page);
      expect(await seriousAxe(page)).toEqual([]);
    }
  });
  test("/offline e / (públicas)", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /sem conexão/i })).toBeVisible();
    expect(await seriousAxe(page)).toEqual([]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/); // raiz agora é a landing comercial (antes redirecionava para a entrada)
    await expect(page.locator("h1")).toBeVisible();
  });
  test("/recuperar-acesso (público)", async ({ page }) => {
    await page.goto("/recuperar-acesso");
    await page.getByLabel("E-mail").fill("pessoa@exemplo.test");
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByText(/Nenhum e-mail foi enviado/)).toBeVisible();
    await noOverflow(page);
    expect(await seriousAxe(page)).toEqual([]);
  });
});

// Rotas de detalhe alcançadas pelo clique na lista (sem ID fixo): renderizam, sem "não encontrado", overflow ou axe sério.
test("detalhes via lista: contratos, agentes, importações, requisitórios, planejamento e suporte", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page, /Helena Prado/);
  for (const [list, detail] of [["/app/contratos", /\/app\/contratos\/[\w-]+$/], ["/app/ia/agentes", /\/app\/ia\/agentes\/[\w-]+$/], ["/app/importacoes", /\/app\/importacoes\/[\w-]+$/], ["/app/requisitorios", /\/app\/requisitorios\/[\w-]+$/], ["/app/previdenciario", /\/app\/previdenciario\/analises\/[\w-]+$/]] as const) {
    await page.goto(list);
    await expect(page.locator("h1").first()).toBeVisible();
    await noOverflow(page);
    if (list === "/app/importacoes") { // a fixture não tem lote: importa o CSV fictício de exemplo
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByRole("button", { name: "Usar exemplo fictício" }).click();
      await page.getByRole("button", { name: "Validar" }).click();
      await page.getByRole("button", { name: "Revisar conflitos e confirmar" }).click();
      await page.getByRole("button", { name: "Confirmar importação" }).click(); // abre o lote criado
    } else {
      const prefix = list === "/app/previdenciario" ? "/app/previdenciario/planejamentos/" : `${list}/`;
      await page.locator(`a[href^="${prefix}"]`).locator("visible=true").first().click();
    }
    await expect(page).toHaveURL(detail); // planejamento redireciona para a análise
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(/não encontrad/i)).toHaveCount(0);
    await noOverflow(page);
    expect(await seriousAxe(page), page.url()).toEqual([]);
  }
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: /Sérgio Atendimento LexSion/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/admin/);
  await page.goto("/admin/suporte");
  await expect(page.locator("h1").first()).toBeVisible();
  await noOverflow(page);
  expect(await seriousAxe(page)).toEqual([]);
});
