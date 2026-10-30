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

test("CONTR-02: cadastro inválido é recusado pelo servidor ANTES de criar contrato ou pedido (campo apontado)", async ({ request }) => {
  const party = { kind: "PF", name: "QA Teste Exemplo", cpf: "11111111111", email: "sem-arroba", phone: "1", address: { cep: "1", street: "", number: "", district: "", city: "", uf: "XX" } };
  const r = await request.post("/api/contrato", { data: { action: "save", plan: "solo", cycle: "mensal", slug: "admin", party } });
  if (r.status() === 503) { test.skip(true, "contratação não liberada neste ambiente"); return; }
  expect(r.status()).toBe(400);
  expect(Object.keys((await r.json()).error.fields)).toEqual(expect.arrayContaining(["cpf", "email", "phone", "address.cep", "address.uf", "slug"]));
  expect((await request.post("/api/contrato", { data: { action: "save", plan: "inexistente", party } })).status()).toBe(409);
  // Rota antiga (pedido sem contrato) não existe mais: nenhuma resposta JSON de API (local 404; produção pode servir a página HTML).
  const old = await request.post("/api/contratar", { data: {} });
  expect(old.headers()["content-type"] ?? "").not.toContain("application/json");
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

test("CONTR-06: resumo da contratação mostra o teste grátis e que não pede cartão (quando liberado)", async ({ page }) => {
  await page.goto("/contratar?plano=profissional");
  const go = page.getByRole("button", { name: "Continuar" });
  if (!(await go.count())) { await expect(page.getByRole("status")).toContainText("ainda não foi liberada"); return; }
  const resumo = page.getByLabel("Resumo da contratação");
  await expect(resumo).toContainText(/dias grátis, depois R\$\s249,90/); // \s: o Intl usa espaço não separável
  await expect(resumo).toContainText("Sem cartão no cadastro");
});
