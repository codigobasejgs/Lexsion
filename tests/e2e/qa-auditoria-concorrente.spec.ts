import { expect, test, type Page } from "@playwright/test";

// QA-115 (causa raiz): várias abas da MESMA demonstração (mesmo IndexedDB) gravando auditoria ao mesmo tempo.
// Antes: cada aba regravava a coleção "audit" inteira a partir de uma leitura velha e apagava eventos das outras.
// Agora a auditoria é só-acréscimo dentro da transação. Repetido N vezes para pegar falha intermitente.
const ROUNDS = Number(process.env.AUD_ROUNDS ?? 3);
const TENANTS = ["aurora-advocacia", "atlas-juridico", "novo-escritorio"];

async function signInSuperAdmin(page: Page) {
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: /Suporte LexSion/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/admin/);
  await page.waitForLoadState("networkidle");
}
const auditCount = (page: Page, text: string) => page.evaluate(async (t) => {
  const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open("siwiltec-demo"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rows: { detail: string; id: string }[] = await new Promise((res) => { const g = db.transaction("collections").objectStore("collections").get("audit"); g.onsuccess = () => res(g.result ?? []); });
  db.close();
  return { hits: rows.filter((r) => r.detail.includes(t)).length, ids: rows.length, unique: new Set(rows.map((r) => r.id)).size };
}, text);

test.describe.configure({ mode: "serial" });
test("QA-115/AUD: 3 abas suspendem e reativam escritórios ao mesmo tempo; nenhum evento se perde nem duplica", async ({ context, isMobile }) => {
  test.skip(isMobile, "uma execução basta (concorrência é do armazenamento, não da tela)");
  test.setTimeout(ROUNDS * 90_000 + 60_000);
  const tabs = await Promise.all(TENANTS.map(() => context.newPage()));
  await signInSuperAdmin(tabs[0]);
  for (const p of tabs.slice(1)) { await p.goto("/admin/organizacoes"); await p.waitForLoadState("networkidle"); }
  await tabs[0].goto("/admin/organizacoes");
  for (let round = 1; round <= ROUNDS; round++) {
    const reason = (slug: string) => `QA concorrente r${round} ${slug}`;
    // Suspensão simultânea: cada aba suspende um escritório diferente, cliques disparados juntos.
    await Promise.all(tabs.map(async (p, i) => {
      const row = p.getByTestId(`tenant-${TENANTS[i]}`);
      await row.getByRole("button", { name: "Suspender" }).click();
      await p.getByRole("dialog").getByLabel(/Motivo/).fill(reason(TENANTS[i]));
    }));
    await Promise.all(tabs.map((p) => p.getByRole("dialog").getByRole("button", { name: "Suspender" }).click()));
    await Promise.all(tabs.map((p, i) => expect(p.getByTestId(`tenant-${TENANTS[i]}`).getByText("Suspensa")).toBeVisible()));
    // Reativação simultânea.
    await Promise.all(tabs.map((p, i) => p.getByTestId(`tenant-${TENANTS[i]}`).getByRole("button", { name: "Reativar" }).click()));
    await Promise.all(tabs.map((p, i) => expect(p.getByTestId(`tenant-${TENANTS[i]}`).getByText("Ativa")).toBeVisible()));
    // Todas as 3 suspensões desta rodada estão gravadas (exatamente uma vez cada).
    for (const slug of TENANTS) expect((await auditCount(tabs[0], `Suspenso: ${reason(slug)}`)).hits, `${slug} r${round}`).toBe(1);
  }
  const all = await auditCount(tabs[0], "Reativado");
  expect(all.hits).toBe(ROUNDS * TENANTS.length); // 1 reativação por escritório por rodada, nenhuma perdida
  expect(all.unique).toBe(all.ids);              // nenhum evento duplicado
  // A tela de auditoria mostra os eventos (leitura pela interface, não só pelo armazenamento).
  await tabs[0].goto("/admin/auditoria");
  await expect(tabs[0].getByText(`Suspenso: QA concorrente r${ROUNDS} ${TENANTS[2]}`)).toBeVisible();
  await expect(tabs[0].getByText("Reativado").first()).toBeVisible();
});
