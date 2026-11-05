import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

// Inteligência Jurídica na operação REAL: CNIS SINTÉTICO em PDF enviado ao Storage privado, lido pelo servidor
// (pdfjs, sem IA), revisão humana, contagem, relatório em PDF e isolamento entre escritórios. Nada de documento real.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const tag = crypto.randomBytes(3).toString("hex");
const SLOW = Number(process.env.SLOW ?? 20_000);
type U = { id: string; email: string; password: string };
let admin: SupabaseClient;
let orgA = "", orgB = "";
const people: Record<string, U> = {};
const CLIENT = `c-qa-intel-${tag}`;

test.describe.configure({ mode: "serial", timeout: 4 * SLOW });
test.skip(!ON, "Supabase não configurado neste ambiente");

async function mkUser(key: string): Promise<U> {
  const email = `qa-jur${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\//, { timeout: SLOW });
}
async function pdf(lines: string[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([595, 842]);
  lines.forEach((l, i) => p.drawText(l, { x: 40, y: 800 - i * 16, size: 9, font }));
  return Buffer.from(await doc.save());
}
const intel = async (org: string) => ((await admin.from("org_records").select("id,data").eq("organization_id", org).eq("collection", "assessments")).data ?? []) as { id: string; data: { kind: string; data: { bonds: { status: string; origin: string; evidence: { page: number } | null }[] } } }[];

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  [people.adv, people.titB] = [await mkUser("adv"), await mkUser("titb")];
  for (const [slug, owner] of [[`qa-jur-a-${tag}`, people.adv.id], [`qa-jur-b-${tag}`, people.titB.id]] as const) {
    const { data } = await admin.from("organizations").insert({ slug, name: `QA Jurídica ${slug.slice(-8)}`, status: "trial" }).select("id").single().throwOnError();
    await admin.from("organization_memberships").insert({ organization_id: data!.id, user_id: owner, role: "admin" }).throwOnError();
    if (owner === people.adv.id) orgA = data!.id; else orgB = data!.id;
  }
  await admin.from("org_records").insert({ organization_id: orgA, collection: "clients", id: CLIENT, data: { id: CLIENT, organizationId: orgA, kind: "PF", name: "Cliente QA Jurídica", document: "000.000.000-00", phone: "(71) 90000-0000", city: "Salvador", uf: "BA", ownerId: people.adv.id, origin: "QA", status: "ativo", createdAt: new Date().toISOString() } }).throwOnError();
});
test.afterAll(async () => {
  if (!admin) return;
  for (const org of [orgA, orgB].filter(Boolean)) {
    const { data: dirs } = await admin.storage.from("documentos").list(org, { limit: 100 });
    for (const d of dirs ?? []) {
      const { data: inner } = await admin.storage.from("documentos").list(`${org}/${d.name}`, { limit: 100 });
      await admin.storage.from("documentos").remove((inner ?? []).map((x) => `${org}/${d.name}/${x.name}`));
    }
  }
  await admin.from("organizations").delete().in("id", [orgA, orgB].filter(Boolean));
  await admin.from("audit_logs").delete().in("organization_id", [orgA, orgB].filter(Boolean));
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("JUR-01: CNIS em PDF é lido no servidor com página de origem; só o revisado conta; relatório em PDF", async ({ page, isMobile }) => {
  await login(page, people.adv);
  await page.goto(`/app/clientes/${CLIENT}`);
  await expect(page.getByRole("heading", { name: "Cliente QA Jurídica" })).toBeVisible({ timeout: SLOW });
  await page.goto("/app/inteligencia");
  await expect(page.getByText("Ambiente demonstrativo")).toHaveCount(0);
  await page.getByRole("button", { name: "Nova análise" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Nova análise" });
  await dlg.getByLabel("Cliente").selectOption({ label: "Cliente QA Jurídica" });
  await dlg.getByRole("button", { name: "Criar análise" }).click();
  await page.waitForURL(/\/app\/inteligencia\/assessments-/, { timeout: SLOW });

  // Envio do CNIS sintético pela própria tela.
  await page.getByRole("button", { name: "Enviar CNIS" }).click();
  const up = page.getByRole("dialog", { name: "Enviar documento" });
  await up.locator('input[type="file"][aria-label="Arquivo"]').setInputFiles({ name: "cnis-sintetico.pdf", mimeType: "application/pdf", buffer: await pdf([
    "Nome: JOSE SINTETICO DE TESTE", "NIT: 123.45678.90-1", "Data de Nascimento: 05/05/1962",
    "1 123.45678.90-1 12.345.678/0001-90 EMPRESA ALFA LTDA Empregado 01/02/1990 30/06/1998",
    "2 123.45678.90-1 98.765.432/0001-10 EMPRESA BETA ME Empregado 01/03/1999 31/12/2005 PEXT",
  ]) });
  await up.getByRole("button", { name: "Enviar", exact: true }).click();
  await up.getByRole("button", { name: "Concluir" }).click();
  await page.getByRole("button", { name: "Ler documento" }).click();
  await expect(page.getByText(/CNIS lido: 2 registro\(s\)/)).toBeVisible({ timeout: SLOW });

  // Leitura gravada como pendente, com página de origem; nada contado ainda.
  await expect.poll(async () => (await intel(orgA))[0]?.data.data.bonds.map((b) => [b.status, b.evidence?.page]), { timeout: SLOW }).toEqual([["pendente", 1], ["pendente", 1]]);
  if (isMobile) await page.getByLabel("Seção").selectOption("vinculos"); else await page.getByRole("tab", { name: "Vínculos" }).click();
  await expect(page.getByText("EMPRESA ALFA LTDA").first()).toBeVisible();
  await expect(page.getByText(/PEXT/).first()).toBeVisible();
  await page.getByRole("button", { name: "Confirmar os de alta confiança" }).click();
  await expect.poll(async () => (await intel(orgA))[0]?.data.data.bonds.map((b) => b.status), { timeout: SLOW }).toEqual(["confirmado", "confirmado"]);
  // 01/02/1990–30/06/1998 (3072 dias) + 01/03/1999–31/12/2005 (2498 dias) = 5570 dias = 15 anos, 3 meses e 5 dias
  await expect(page.getByText("15 ano(s), 3 mes(es) e 5 dia(s)").first()).toBeVisible({ timeout: SLOW });

  if (isMobile) await page.getByLabel("Seção").selectOption("relatorio"); else await page.getByRole("tab", { name: "Relatório" }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar relatório em PDF" }).click();
  const file = await dl;
  const bytes = fs.readFileSync((await file.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const parsed = await PDFDocument.load(bytes);
  expect(parsed.getPageCount()).toBeGreaterThan(0);
});

test("JUR-02: outro escritório não lê o documento nem a análise; PDF sem texto não é inventado", async ({ browser }) => {
  const [a] = await intel(orgA);
  const docs = (await admin.from("org_records").select("id").eq("organization_id", orgA).eq("collection", "documents")).data ?? [];
  expect(a && docs.length).toBeTruthy();
  // Titular do escritório B, logado de verdade, tenta ler o documento do A pela rota.
  const ctxB = await browser.newContext(); const pb = await ctxB.newPage();
  await login(pb, people.titB);
  const r = await pb.request.post("/api/inteligencia/extrair", { data: { organizationId: orgA, documentId: docs[0].id, kind: "CNIS" } });
  expect(r.status()).toBe(403);
  await pb.goto(`/app/inteligencia/${a.id}`);
  await expect(pb.getByText("Análise não encontrada")).toBeVisible({ timeout: SLOW });
  await ctxB.close();

  // PDF sem texto (página em branco) no escritório A: a rota recusa pedindo OCR e não devolve conteúdo nem caminho.
  const blank = await PDFDocument.create(); blank.addPage([595, 842]);
  const fid = `file-qa-${tag}`, did = `doc-qa-${tag}`, path = `${orgA}/${fid}/branco.pdf`;
  await admin.storage.from("documentos").upload(path, Buffer.from(await blank.save()), { contentType: "application/pdf" });
  await admin.from("org_records").insert([
    { organization_id: orgA, collection: "files", id: fid, data: { id: fid, organizationId: orgA, name: "branco.pdf", mime: "application/pdf", size: 900, path, createdAt: new Date().toISOString() } },
    { organization_id: orgA, collection: "documents", id: did, data: { id: did, organizationId: orgA, clientId: CLIENT, name: "branco.pdf", type: "CNIS", status: "recebido", sharedWithClient: false, hasFixtureExtraction: false, versions: [{ id: "v1", at: new Date().toISOString(), actorId: people.adv.id, fileId: fid, note: "QA" }] } },
  ]).throwOnError();
  const ctxA = await browser.newContext(); const pa = await ctxA.newPage();
  await login(pa, people.adv);
  const r2 = await pa.request.post("/api/inteligencia/extrair", { data: { organizationId: orgA, documentId: did, kind: "CNIS" } });
  expect(r2.status()).toBe(422);
  const j = await r2.json();
  expect(j.error.code).toBe("needs_ocr");
  expect(JSON.stringify(j)).not.toContain(path);
  await ctxA.close();
});

test("JUR-03: planejamento com salários informados calcula datas e RMI com índices oficiais", async ({ page, isMobile }) => {
  const [a] = await intel(orgA);
  await login(page, people.adv);
  await page.goto(`/app/inteligencia/${a.id}`);
  const go = async (v: string, name: string) => { if (isMobile) await page.getByLabel("Seção").selectOption(v); else await page.getByRole("tab", { name }).click(); };
  await go("beneficios", "Possibilidades");
  await page.getByLabel("Sexo").selectOption("M");
  await page.getByRole("button", { name: "Salvar dados" }).click();
  await expect.poll(async () => ((await intel(orgA))[0].data.data as unknown as { sex: string }).sex, { timeout: SLOW }).toBe("M");
  await go("planejamento", "Planejamento e RMI");
  await expect(page.getByText(/Sem salários de contribuição/)).toBeVisible({ timeout: SLOW });
  await page.getByText(/Salários informados manualmente/).click();
  for (const m of ["01/2005", "06/2005", "12/2005"]) {
    await page.getByLabel("Competência").fill(m);
    await page.getByLabel("Valor (R$)").fill("2.000,00");
    await page.getByRole("button", { name: "Incluir salário" }).click();
  }
  await page.getByRole("button", { name: "Salvar e recalcular" }).click();
  await expect(page.getByTestId("planejamento-hoje")).toBeVisible({ timeout: SLOW });
  await expect(page.getByText("Datas em que cumprirá cada regra")).toBeVisible();
  await expect(page.locator("[data-testid^='plano-']").first()).toContainText("RMI R$");
  await expect(page.getByText(/tábua IBGE 2024/).first()).toBeVisible();
});

test("JUR-04: pesquisa traz precedentes reais do STJ com link oficial; cálculo usa índice oficial", async ({ page }) => {
  await login(page, people.adv);
  await page.goto("/app/pesquisa?q=aposentadoria%20especial");
  await expect(page.getByRole("heading", { name: "Precedentes qualificados do STJ" })).toBeVisible({ timeout: SLOW });
  const first = page.getByTestId("precedentes").locator("li").first();
  await expect(first).toContainText("STJ ·", { timeout: SLOW });
  await expect(first.getByRole("link", { name: "Abrir no STJ" })).toHaveAttribute("href", /^https:\/\/processo\.stj\.jus\.br/);
  await expect(page.getByText("Referência fictícia")).toHaveCount(0);
  await page.goto("/app/calculos");
  await page.getByRole("button", { name: "Novo cálculo: Atualização de débito judicial (índices oficiais)" }).click();
  await page.getByRole("dialog", { name: "Novo cálculo" }).getByRole("button", { name: "Criar" }).click();
  await page.waitForURL(/\/app\/calculos\/calculations-/, { timeout: SLOW });
  for (const [label, v] of [["Valor devido (R$)", "1.000,00"], ["Vencimento (mm/aaaa)", "01/2024"], ["Data do cálculo (mm/aaaa)", "06/2024"]]) {
    await page.getByLabel(label).fill(v);
    await page.getByLabel(label).blur();
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: "Calcular" }).click();
  await expect(page.getByText(/Correção IPCA-E de 02\/2024 a 06\/2024: fator 1\.0/)).toBeVisible({ timeout: SLOW });
});
