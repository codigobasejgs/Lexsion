import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";

// LexSion SaaS: dados que não se perdem, Super Admin, isolamento de marca e suspensão. IDs: DATA-*, QA-1xx, BRAND-*.
async function signIn(page: Page, who: RegExp, url = /\/app\//) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: who }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(url);
  await page.waitForLoadState("networkidle"); // WebKit: idem journeys.signIn
}
// Movimento reduzido antes da análise: as cores dos botões têm transição de 150 ms e, ao trocar o tema do escritório,
// o WebKit era medido no meio da transição (contraste "intermediário" falso). O contraste final é o que importa.
const serious = async (page: Page) => (await page.emulateMedia({ reducedMotion: "reduce" }), await page.waitForTimeout(250), await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

test("DATA-02: sair e entrar de novo NÃO apaga cadastro feito na demo", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/tarefas?ver=lista");
  const first = page.getByRole("checkbox", { name: /^Concluir/, checked: false, disabled: false }).first();
  const label = (await first.getAttribute("aria-label"))!;
  const mine = page.getByRole("checkbox", { name: label, exact: true });
  const checkedCount = () => mine.evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length);
  const before = await checkedCount();
  await first.click();
  await expect.poll(checkedCount).toBe(before + 1);
  await page.goto("/app/inicio");
  await page.locator("summary", { hasText: "Menu do usuário" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/demonstracao/);
  await signIn(page, /Helena Prado/);
  await page.goto("/app/tarefas?ver=lista");
  await expect.poll(checkedCount).toBe(before + 1); // a conclusão sobreviveu ao sair/entrar
});

test("DATA-03: ao sair, nenhum cache de shell de sessão sobra no navegador", async ({ page, isMobile }) => {
  test.skip(isMobile, "uma execução basta");
  await signIn(page, /Helena Prado/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.goto("/app/agenda");
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => /-shell-/.test(k)))).toBe(true);
  await page.locator("summary", { hasText: "Menu do usuário" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/demonstracao/);
  expect(await page.evaluate(async () => (await caches.keys()).filter((k) => /-shell-/.test(k)))).toEqual([]);
});

test("QA-115/120: Super Admin cria escritório, suspende com motivo, ERP bloqueia, reativa, auditoria registra", async ({ page, context }) => {
  await signIn(page, /Suporte LexSion/, /\/admin/);
  await expect(page.getByRole("heading", { name: "Painel geral" })).toBeVisible();
  await expect(page.getByText(/Receita recorrente mensal/)).toBeVisible();
  await page.goto("/admin/organizacoes");
  await page.getByRole("button", { name: "Novo escritório" }).click();
  const dlg = page.getByRole("dialog", { name: "Novo escritório" });
  await dlg.getByLabel("Nome do escritório").fill("Silva Teste Advocacia");
  await expect(dlg.getByLabel("Endereço (slug)")).toHaveValue("silva-teste-advocacia"); // gerado do nome
  await dlg.getByLabel("Endereço (slug)").fill("admin");
  await dlg.getByRole("button", { name: "Continuar" }).click();
  await expect(dlg.getByRole("alert")).toHaveText(/reservado/);
  await dlg.getByLabel("Endereço (slug)").fill("silva-teste-advocacia");
  await dlg.getByRole("button", { name: "Continuar" }).click();
  await dlg.getByLabel("Nome do responsável").fill("Joana Silva");
  await dlg.getByLabel("E-mail do responsável").fill("joana@exemplo.test");
  for (let i = 0; i < 3; i++) await dlg.getByRole("button", { name: "Continuar" }).click();
  await dlg.getByRole("button", { name: "Criar escritório" }).click();
  await expect(page.getByTestId("tenant-silva-teste-advocacia")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("tenant-silva-teste-advocacia")).toBeVisible(); // persistiu

  const atlas = page.getByTestId("tenant-atlas-juridico");
  await atlas.getByRole("button", { name: "Suspender" }).click();
  const sd = page.getByRole("dialog", { name: /Suspender/ });
  await sd.getByRole("button", { name: "Suspender" }).click();
  await expect(sd.getByRole("alert").filter({ hasText: /motivo/ })).toBeVisible();
  await sd.getByLabel(/Motivo/).fill("Inadimplência de teste");
  await sd.getByRole("button", { name: "Suspender" }).click();
  await expect(atlas.getByText("Suspensa")).toBeVisible();

  // Mesmo navegador (mesmo banco local): o escritório suspenso não abre.
  const office = await context.newPage();
  await office.goto("/demo/tenant/atlas-juridico");
  await expect(office.getByRole("heading", { name: "Acesso suspenso" })).toBeVisible();
  await expect(office.getByText("Rita de Cássia Exemplar")).toHaveCount(0);
  // Demonstração: as duas abas compartilham o mesmo IndexedDB e a gravação é "ler-modificar-gravar" da coleção.
  // No Safari a aba do escritório ainda gravava ao carregar e sobrescrevia o evento da outra. Fecha antes de reativar.
  // (A operação real grava no banco por linha, sem essa corrida.)
  await office.close();

  await atlas.getByRole("button", { name: "Reativar" }).click();
  await expect(atlas.getByText("Ativa")).toBeVisible();
  await page.goto("/admin/auditoria");
  await expect(page.getByText("Suspenso: Inadimplência de teste")).toBeVisible();
  await expect(page.getByText("Reativado").first()).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test("QA-165/166: webhook simulado repetido não altera a fatura duas vezes; honorários fora do MRR", async ({ page, isMobile }) => {
  test.skip(isMobile, "tabela larga; uma execução basta");
  await signIn(page, /Suporte LexSion/, /\/admin/);
  await page.goto("/admin/faturamento");
  const row = page.getByTestId("fatura-fs-atlas-2026-10");
  await row.getByRole("button", { name: "Pagamento confirmado" }).click();
  await expect(row.getByText("Paga", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Reenviar último evento" }).click();
  await expect(page.getByTestId("webhook-log")).toHaveText(/ignorado: já processado/);
  await page.goto("/admin/planos");
  await expect(page.getByTestId("prorata")).toContainText("simulação");
});

test("BRAND-010: marca do escritório A não vaza para B; plataforma continua LexSion", async ({ page }) => {
  await page.goto("/demo/tenant/aurora-advocacia");
  await page.waitForURL(/\/app\/inicio/);
  await expect(page.locator("html")).toHaveAttribute("data-tenant", "aurora-advocacia");
  await expect(page.getByRole("link", { name: /Aurora Advocacia — ir para Meu dia/ }).locator("visible=true").first()).toBeVisible();
  await page.goto("/demo/tenant/atlas-juridico");
  await page.waitForURL(/\/app\/inicio/);
  await expect(page.locator("html")).toHaveAttribute("data-tenant", "atlas-juridico");
  await expect(page.getByText("Maria das Graças Exemplo")).toHaveCount(0);
  const css = await page.getByTestId("tenant-theme").textContent();
  expect(css).toContain("atlas-juridico");
  expect(css).not.toContain("aurora");
  await page.goto("/demonstracao");
  await expect(page.locator("html")).not.toHaveAttribute("data-tenant", /.+/);
  await expect(page.getByRole("img", { name: /LexSion/ }).first()).toBeVisible();
  await expect(page.getByText("SIWILTEC")).toHaveCount(0);
});

test("QA-050/058: identidade visual — SVG recusado, PNG aceito, cor ilegível ajustada, salva só no escritório", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/configuracoes/branding");
  await page.getByTestId("logo-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByRole("alert").filter({ hasText: "SVG não é aceito" })).toBeVisible();
  const png = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#1d4ed8" } }).png().toBuffer();
  await page.getByTestId("logo-input").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Logotipo aceito \(64 × 64 px\)/)).toBeVisible();
  await page.getByLabel("Cor principal (botões) — código hexadecimal").fill("#f6f6f6");
  await expect(page.getByText(/Contraste insuficiente/)).toBeVisible();
  await page.getByRole("button", { name: "Salvar identidade" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Identidade salva" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("img", { name: /Logotipo de Aurora Advocacia/ }).first()).toBeVisible();
  // Outro escritório não recebe nada.
  await page.goto("/demo/tenant/atlas-juridico");
  await page.waitForURL(/\/app\/inicio/);
  expect(await page.getByTestId("tenant-theme").textContent()).not.toContain("#f6f6f6");
  expect(await serious(page)).toEqual([]);
});

test("QA-059: QR do aplicativo aponta para o endereço do próprio escritório e avisa sobre rede local", async ({ page }) => {
  await signIn(page, /Helena Prado/);
  await page.goto("/app/configuracoes/branding");
  await expect(page.getByRole("img", { name: /QR Code para http:\/\/localhost:3100\/demo\/tenant\/aurora-advocacia/ })).toBeVisible();
  await expect(page.getByText(/Endereço local/)).toBeVisible();
});
