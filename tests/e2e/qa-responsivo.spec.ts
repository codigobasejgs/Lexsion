import { expect, test, type Page } from "@playwright/test";

// RESP-01/02/03, CALC-04, FIN-09, ADM-03: sem rolagem horizontal global em 7 larguras e com zoom 200%
// (zoom 200% em 1280px equivale a viewport CSS de 640px — critério de reflow WCAG 1.4.10).
const VIEWPORTS = [
  [320, 640], [360, 800], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900],
] as const;
const ROUTES = [
  "/app/inicio", "/app/crm", "/app/atendimento", "/app/clientes", "/app/clientes/c-joao", "/app/casos/k-maria-bpc", "/app/processos", "/app/prazos",
  "/app/tarefas", "/app/agenda", "/app/documentos", "/app/previdenciario/analises/pa-joao", "/app/calculos", "/app/calculos/calc-debito", "/app/minutas/dr-lucia",
  "/app/propostas/nova", "/app/contratos/ct-ronaldo", "/app/financeiro", "/app/financeiro/caixa", "/app/financeiro/conciliacao", "/app/financeiro/recibos",
  "/app/pagamentos", "/app/equipe", "/app/importacoes", "/app/relatorios", "/app/configuracoes", "/app/integracoes/evolution", "/app/academia", "/app/ajuda/baixa-parcial",
];

async function signIn(page: Page) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app\//);
}

async function overflowing(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const extra = document.documentElement.scrollWidth - w;
    if (extra <= 0) return null;
    const culprit = [...document.querySelectorAll("body *")].find((e) => e.getBoundingClientRect().right > w + 1 && getComputedStyle(e).position !== "fixed");
    return `${extra}px · ${culprit?.tagName}.${String((culprit as HTMLElement)?.className).slice(0, 60)}`;
  });
}

test.describe("varredura responsiva", () => {
  test.skip(({ isMobile }) => isMobile, "uma execução (desktop) define os viewports manualmente");
  test.setTimeout(240_000);
  for (const [w, h] of VIEWPORTS) {
    test(`${w}×${h}: nenhuma rota com rolagem horizontal global`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await signIn(page);
      const fails: string[] = [];
      for (const r of ROUTES) {
        await page.goto(r);
        await expect(page.locator("h1").first(), `h1 em ${r}`).toBeVisible();
        const o = await overflowing(page);
        if (o) fails.push(`${r}: ${o}`);
      }
      expect(fails).toEqual([]);
    });
  }

  test("RESP-03: zoom 200% (1280px → 640px CSS) mantém navegação e ações", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await signIn(page);
    for (const r of ["/app/inicio", "/app/financeiro/caixa", "/app/minutas/dr-lucia", "/app/calculos"]) {
      await page.goto(r);
      expect(await overflowing(page), r).toBeNull();
    }
    // Ação essencial continua alcançável: registrar pagamento a partir de A receber
    await page.goto("/app/financeiro/receber");
    await page.getByRole("button", { name: "Registrar pagamento" }).locator("visible=true").first().click();
    await expect(page.getByRole("dialog", { name: "Registrar pagamento" })).toBeVisible();
    const confirm = page.getByRole("button", { name: "Confirmar baixa" });
    await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeInViewport(); // alcançável rolando o corpo do diálogo
    expect(await page.getByRole("dialog").evaluate((d) => d.getBoundingClientRect().bottom <= window.innerHeight + 1)).toBe(true);
  });
});
