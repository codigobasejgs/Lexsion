import { expect, test } from "@playwright/test";

// Contratação pública. O comportamento depende do estado do banco e da liberação no servidor:
//  * planos aprovados + SAAS_CHECKOUT_ENABLED=1 (produção desde 30/10/2026): preço e "Contratar" visíveis;
//  * sem liberação (CI/local sem chave): nada é vendido e a API responde 503.
// Nenhum teste aqui cria pedido, conta ou link de pagamento: só validações que recusam antes de gravar.
test("CONTR-01: /planos lista Solo, Profissional e Elite do banco; preço só com aprovação; recurso sem integração aparece 'em breve'", async ({ page }) => {
  await page.goto("/planos");
  const solo = page.getByTestId("plano-solo");
  test.skip((await solo.count()) === 0, "planos do banco indisponíveis neste ambiente (sem chave do servidor)");
  await expect(solo).toContainText("até 1 usuário");
  await expect(page.getByTestId("plano-elite")).toContainText("até 15 usuários");
  await expect(solo).toContainText("Cobrança online de honorários (em breve)");
  const priced = await solo.getByText("R$ 99,90").count();
  if (priced) {
    await expect(page.getByTestId("plano-profissional")).toContainText("R$ 249,90");
    await expect(page.getByTestId("plano-elite")).toContainText("R$ 499,90");
  } else await expect(solo).toContainText("Valores em breve");
});

test("CONTR-02: cadastro inválido é recusado pelo servidor ANTES de criar pedido (campo apontado)", async ({ request }) => {
  const base = { plan: "solo", cycle: "mensal", name: "QA Teste", email: "qa@lexsion-qa.invalid", office: "QA Escritório", slug: "qa-contr-invalido", document: "52998224725", accept: true, contractVersion: "2026-10-30" };
  const post = (d: Record<string, unknown>) => request.post("/api/contratar", { data: { ...base, ...d } });
  const first = await post({ document: "11111111111" });
  if (first.status() === 503) { test.skip(true, "contratação não liberada neste ambiente"); return; }
  expect(first.status()).toBe(400);
  expect((await first.json()).error.field).toBe("document");
  expect((await (await post({ email: "sem-arroba" })).json()).error.field).toBe("email");
  expect((await (await post({ slug: "admin" })).json()).error.field).toBe("slug");
  expect((await (await post({ accept: false })).json()).error.field).toBe("accept");
  expect((await (await post({ contractVersion: "antiga" })).json()).error.field).toBe("accept");
  expect((await post({ plan: "inexistente" })).status()).toBe(409);
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

test("CONTR-05: termos de contratação publicados com versão, teste grátis, renovação, atraso, cancelamento e arrependimento", async ({ page }) => {
  await page.goto("/termos#contratacao");
  const t = page.locator("article");
  for (const s of ["Versão 2026-10-30", "Teste grátis.", "Renovação.", "Atraso.", "Cancelamento.", "Direito de arrependimento."]) await expect(t).toContainText(s);
});

test("CONTR-06: formulário de contratação mostra o teste grátis e não pede cartão (quando liberado)", async ({ page }) => {
  await page.goto("/contratar?plano=profissional");
  const btn = page.getByRole("button", { name: /Começar o teste grátis|Ir para o pagamento/ });
  if (!(await btn.count())) { await expect(page.getByRole("status")).toContainText("ainda não foi liberada"); return; }
  await expect(page.getByLabel("Plano")).toHaveValue("profissional");
  await expect(page.getByText(/dias grátis, depois R\$\s249,90/)).toBeVisible(); // \s: o Intl usa espaço não separável
  await expect(page.getByText(/não pedimos cartão/)).toBeVisible();
});
