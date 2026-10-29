import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signIn(page: Page, role: RegExp) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: role }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "scroll horizontal de página").toBeLessThanOrEqual(0);
}

const SCREENS = [
  { path: "/app/inicio", heading: /Olá, Helena/ },
  { path: "/app/atendimento/cv-maria", heading: /Maria das Graças/ },
  { path: "/app/clientes/c-joao", heading: /João Batista Fictício/ },
  { path: "/app/previdenciario/analises/pa-joao", heading: /Aposentadoria programada/ },
  { path: "/app/financeiro", heading: /Financeiro/ },
];

test.describe("telas de referência", () => {
  for (const s of SCREENS) {
    test(`${s.path} renderiza, sem overflow e sem violações axe sérias`, async ({ page }, info) => {
      await signIn(page, /Helena Prado/);
      await page.goto(s.path);
      await expect(page.getByRole("heading", { name: s.heading }).first()).toBeVisible();
      await expect(page.getByText("Ambiente demonstrativo — dados fictícios").first()).toBeVisible();
      await noHorizontalOverflow(page);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
      const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      await page.screenshot({ path: `test-results/ref/${info.project.name}${s.path.replace(/\//g, "_")}.png`, fullPage: true });
    });
  }

  test("portal do cliente", async ({ page }, info) => {
    await signIn(page, /Cliente \(portal\)/);
    await expect(page).toHaveURL(/\/portal/);
    await expect(page.getByRole("heading", { name: /Olá, Maria/ })).toBeVisible();
    await expect(page.getByText(/Nota interna/)).toHaveCount(0);
    await noHorizontalOverflow(page);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: `test-results/ref/${info.project.name}_portal.png`, fullPage: true });
  });
});

test("assumir atendimento pausa a IA e permite resposta humana (A05)", async ({ page }) => {
  await signIn(page, /Rafael Nunes/);
  await page.goto("/app/atendimento/cv-maria");
  const send = page.getByRole("button", { name: /Enviar|Salvar nota/ });
  await page.getByRole("radio", { name: "Responder ao cliente" }).click();
  await page.getByLabel("Mensagem ao cliente").fill("Olá, Maria! Serve sim, vamos orientar.");
  await expect(send).toBeDisabled();
  await page.getByRole("button", { name: "Assumir atendimento" }).click();
  await expect(page.getByText("Humano no atendimento — assistente pausada")).toBeVisible();
  await page.getByRole("radio", { name: "Responder ao cliente" }).click();
  await page.getByLabel("Mensagem ao cliente").fill("Olá, Maria! Serve sim, vamos orientar.");
  await page.getByRole("button", { name: /Enviar/ }).click();
  const log = page.getByRole("log", { name: "Mensagens" });
  await expect(log.getByText("Olá, Maria! Serve sim, vamos orientar.")).toBeVisible();
  await page.reload();
  await expect(log.getByText("Olá, Maria! Serve sim, vamos orientar.")).toBeVisible(); // persistiu (A02)
});

test("baixa parcial com prévia e estorno reconciliam (A10)", async ({ page, isMobile }) => {
  await signIn(page, /Caio Martins/);
  await page.goto("/app/financeiro?visao=todas");
  const row = isMobile ? page.locator("li").filter({ hasText: "Parcela 4/7" }).first() : page.locator("tr").filter({ hasText: "Parcela 4/7" });
  await row.getByRole("button", { name: "Registrar pagamento" }).click();
  const dlg = page.getByRole("dialog", { name: "Registrar pagamento" });
  await dlg.getByLabel("Valor recebido (R$)").fill("100,00");
  await dlg.getByLabel("Origem / justificativa").fill("Pix recebido no balcão");
  await expect(dlg.getByText(/Novo saldo: R\$\s300,00/)).toBeVisible();
  await dlg.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(dlg).toBeHidden();
  await row.getByText("João Batista Fictício").click();
  const det = page.getByRole("dialog", { name: /Parcela 4\/7/ });
  await expect(det.getByText(/R\$\s100,00/).first()).toBeVisible();
  await det.getByRole("button", { name: "Estornar" }).click();
  await det.getByLabel("Motivo do estorno").fill("Lançado em duplicidade");
  await det.getByRole("button", { name: "Confirmar estorno" }).click();
  await expect(det.getByText("Estornado")).toBeVisible();
  await expect(det.getByText(/-R\$\s100,00/)).toBeVisible();
});

test("trocar de escritório não mistura dados (A12)", async ({ page, isMobile }) => {
  test.skip(isMobile, "seletor de escritório no header é desktop; mobile usa o menu do usuário");
  await signIn(page, /Helena Prado/);
  await page.goto("/app/clientes");
  await expect(page.getByText("Maria das Graças Exemplo").first()).toBeVisible();
  await page.locator("[data-tour=troca-escritorio]").selectOption("org-boreal");
  await expect(page.getByText("Rita de Cássia Exemplar").first()).toBeVisible();
  await expect(page.getByText("Maria das Graças Exemplo")).toHaveCount(0);
});

test("perfil sem permissão vê estado de acesso negado", async ({ page }) => {
  await signIn(page, /Atendimento\/comercial/);
  await page.goto("/app/financeiro");
  await expect(page.getByRole("heading", { name: "Você não tem acesso a esta área" })).toBeVisible();
});

test.describe("PWA", () => {
  test("PWA-013: cada contexto aponta para o próprio manifesto e todos os ícones carregam", async ({ page, request }) => {
    const pairs: [string, string][] = [["/entrar", "/pwa/lexsion/"], ["/admin", "/pwa/admin/"], ["/demo/tenant/atlas-juridico", "/pwa/erp-atlas-juridico/"], ["/app/inicio", "/pwa/lexsion/"]];
    for (const [route, expected] of pairs.slice(0, 3)) {
      await page.goto(route);
      // /admin sem sessão (e /demo/tenant) redirecionam no cliente; durante a transição do App Router o <link> antigo
      // e o novo coexistem por um instante. Asserção do HTML que o SERVIDOR entrega para a rota (fonte de verdade
      // do manifesto) + página estável com exatamente 1 manifesto.
      const html = await (await request.get(route, { maxRedirects: 0 })).text();
      expect(html.match(/<link rel="manifest" href="([^"]+)"/)?.[1] ?? "", route).toMatch(new RegExp(expected));
      await page.waitForLoadState("networkidle");
      await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    }
    const ids = new Set<string>();
    for (const key of ["lexsion", "admin", "erp-aurora-advocacia", "erp-atlas-juridico", "portal-aurora-advocacia"]) {
      const res = await request.get(`/pwa/${key}/manifest.webmanifest`);
      expect(res.ok(), key).toBe(true);
      expect(res.headers()["content-type"]).toContain("application/manifest+json");
      const m = await res.json();
      expect(m).toMatchObject({ lang: "pt-BR", display: "standalone" });
      ids.add(m.id);
      for (const i of m.icons) expect((await request.get(i.src)).ok(), i.src).toBe(true);
    }
    expect(ids.size).toBe(5);
    expect((await request.get("/pwa/erp-desconhecido/manifest.webmanifest")).status()).toBe(404);
  });

  test("service worker controla a página e serve offline após visita; não cacheia /api", async ({ page, context, isMobile, browserName }) => {
    test.skip(isMobile, "uma execução basta");
    // context.setOffline do Playwright no Firefox não roteia navegações pelo service worker (limitação da ferramenta).
    test.skip(browserName === "firefox", "modo offline do Playwright não passa pelo SW no Firefox");
    await signIn(page, /Helena Prado/);
    await page.goto("/app/inicio");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // passa a ser controlada pelo SW
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.goto("/app/agenda");
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();

    await context.setOffline(true);
    await page.goto("/app/inicio");
    await expect(page.getByRole("heading", { name: /Olá, Helena/ })).toBeVisible(); // shell + IndexedDB
    await page.goto("/app/nunca-visitada");
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
    await context.setOffline(false);

    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
      return urls;
    });
    expect(cached.some((u) => u.startsWith("/api/"))).toBe(false);
    expect(cached.some((u) => u.includes("_rsc"))).toBe(false);
  });
});
