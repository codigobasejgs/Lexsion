import { expect, test } from "@playwright/test";

// Contratação pública com os planos NÃO aprovados (estado atual): nada é vendido, nenhum link de pagamento é
// criado e nenhuma conta nasce. Roda contra local ou produção. Fluxo pago completo fica para quando o dono
// aprovar preços e autorizar uma compra de teste real (a InfinitePay não tem sandbox).
test("CONTR-01: /planos lista Solo, Profissional e Elite do banco; sem preço aprovado não há botão Contratar", async ({ page }) => {
  await page.goto("/planos");
  for (const id of ["solo", "profissional", "elite"]) {
    const card = page.getByTestId(`plano-${id}`);
    test.skip((await card.count()) === 0, "planos do banco indisponíveis neste ambiente (sem chave do servidor)");
    await expect(card).toContainText("Valores em breve");
    await expect(card.getByRole("link", { name: /^Contratar/ })).toHaveCount(0);
  }
  await expect(page.getByTestId("plano-solo")).toContainText("até 1 usuário");
  await expect(page.getByTestId("plano-elite")).toContainText("até 15 usuários");
  await expect(page.getByTestId("plano-solo")).toContainText("Cobrança online de honorários (em breve)"); // recurso sem integração não é vendido como pronto
});

test("CONTR-02: /contratar e a API recusam enquanto a contratação não foi liberada; nenhum pedido nasce", async ({ page, request }) => {
  await page.goto("/contratar?plano=solo");
  await expect(page.getByRole("status")).toContainText("ainda não foi liberada");
  await expect(page.getByRole("button", { name: "Ir para o pagamento" })).toHaveCount(0);
  const r = await request.post("/api/contratar", { data: { plan: "solo", cycle: "mensal", name: "QA Teste", email: "qa@lexsion-qa.invalid", office: "QA", slug: "qa-contr", document: "52998224725", accept: true, contractVersion: "2026-10-30" } });
  expect([503]).toContain(r.status());
});

test("CONTR-03: retorno do checkout com parâmetros forjados não confirma nada", async ({ page, request }) => {
  const r = await request.post("/api/contratar/status", { data: { order_nsu: "lx-forjado", transaction_nsu: "x", slug: "y" } });
  expect(r.status()).toBeGreaterThanOrEqual(400);
  await page.goto("/contratar/retorno?order_nsu=lx-forjado&transaction_nsu=x&slug=y&capture_method=pix");
  await expect(page.getByRole("heading", { name: /Pedido não encontrado|Verificando/ })).toBeVisible();
  await expect(page.getByText("escritório ativo")).toHaveCount(0);
});

test("CONTR-04: webhook não assinado com pedido inexistente é aceito sem efeito; corpo inválido pede reenvio", async ({ request }) => {
  const ok = await request.post("/api/infinitepay/webhook", { data: { order_nsu: "pedido-de-outra-loja", transaction_nsu: "t", invoice_slug: "s", amount: 100 } });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).ignored).toBeTruthy();
  const bad = await request.post("/api/infinitepay/webhook", { headers: { "Content-Type": "application/json" }, data: Buffer.from("{não é json") });
  expect(bad.status()).toBe(400);
  expect((await request.post("/api/infinitepay/webhook", { data: ["lista"] })).status()).toBe(400);
});

test("CONTR-05: termos de contratação publicados com versão, renovação, atraso, cancelamento e arrependimento", async ({ page }) => {
  await page.goto("/termos#contratacao");
  const t = page.locator("article");
  for (const s of ["Versão 2026-10-30", "Renovação.", "Atraso.", "Cancelamento.", "Direito de arrependimento."]) await expect(t).toContainText(s);
});
