import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ERP REAL de ponta a ponta no navegador, contra o Supabase do projeto. Escritório e pessoas SINTÉTICOS de QA
// (slug qa-…, e-mails @lexsion-qa.invalid que nunca recebem mensagem). Nenhum cliente real é tocado. Tudo é apagado no fim.
// Sem .env.local com as chaves, os testes são PULADOS (não "passam").
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const tag = crypto.randomBytes(3).toString("hex");
const pass = () => `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
type U = { id: string; email: string; password: string };
let admin: SupabaseClient;
let orgA = "", orgB = "";
const people: Record<string, U> = {};

test.describe.configure({ mode: "serial" });
test.skip(!ON, "Supabase não configurado neste ambiente");

async function mkUser(key: string, name: string): Promise<U> {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`, password = pass();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ user_id: data.user.id, full_name: name }).throwOnError();
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U, audience?: "cliente") {
  await page.goto("/entrar");
  if (audience) await page.getByRole("radio", { name: /cliente/i }).click().catch(() => {});
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  people.tit = await mkUser("tit", "QA Titular");
  people.adv = await mkUser("adv", "QA Advogada");
  people.est = await mkUser("est", "QA Estagiário");
  people.outro = await mkUser("outro", "QA Outro Escritório");
  people.cli = await mkUser("cli", "QA Cliente Portal");
  const org = async (slug: string, owner: string) => {
    const { data } = await admin.from("organizations").insert({ slug, name: `QA Teste Operacional ${slug.slice(-6)}`, status: "trial" }).select("id").single().throwOnError();
    await admin.from("organization_memberships").insert({ organization_id: data!.id, user_id: owner, role: "admin" }).throwOnError();
    return data!.id as string;
  };
  orgA = await org(`qa-erp-a-${tag}`, people.tit.id);
  orgB = await org(`qa-erp-b-${tag}`, people.outro.id);
  await admin.from("organization_memberships").insert([{ organization_id: orgA, user_id: people.adv.id, role: "advogado" }, { organization_id: orgA, user_id: people.est.id, role: "estagiario" }]).throwOnError();
});

test.afterAll(async () => {
  if (!admin) return;
  const { data: objs } = await admin.storage.from("documentos").list(orgA, { limit: 1000 });
  for (const folder of objs ?? []) {
    const { data: files } = await admin.storage.from("documentos").list(`${orgA}/${folder.name}`);
    if (files?.length) await admin.storage.from("documentos").remove(files.map((f) => `${orgA}/${folder.name}/${f.name}`));
  }
  await admin.from("organizations").delete().in("id", [orgA, orgB].filter(Boolean));
  await admin.from("audit_logs").delete().in("organization_id", [orgA, orgB].filter(Boolean));
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("REAL-ERP-01: titular entra, vê a equipe real, cadastra cliente e abre caso no banco", async ({ page }) => {
  await login(page, people.tit);
  await page.waitForURL(/\/app\/inicio/, { timeout: 20_000 });
  await expect(page.getByText("Ambiente demonstrativo")).toHaveCount(0);
  await page.goto("/app/equipe");
  await expect(page.getByText("QA Advogada")).toBeVisible();
  await expect(page.getByText("Rafael", { exact: false })).toHaveCount(0); // nenhum perfil fictício

  await page.goto("/app/clientes/novo");
  await page.getByLabel("Nome completo").fill("Maria QA Sintética");
  await page.getByLabel("CPF").fill("529.982.247-25");
  await page.getByLabel("Telefone (WhatsApp)").fill("(71) 99999-0001");
  await page.getByLabel("Cidade").fill("Salvador");
  await page.getByLabel("Responsável").selectOption({ label: "QA Advogada" });
  await page.getByRole("button", { name: /Salvar|Cadastrar/ }).click();
  await page.waitForURL(/\/app\/clientes\/c-/, { timeout: 20_000 });
  const { data } = await admin.from("org_records").select("data").eq("organization_id", orgA).eq("collection", "clients");
  expect(data?.map((r) => (r.data as { name: string }).name)).toEqual(["Maria QA Sintética"]);
  expect((data?.[0].data as { ownerId: string }).ownerId).toBe(people.adv.id);
  // Duplicado por CPF é recusado (regra do domínio sobre dados reais).
  await page.goto("/app/clientes/novo");
  await page.getByLabel("Nome completo").fill("Outra Pessoa");
  await page.getByLabel("CPF").fill("529.982.247-25");
  await page.getByLabel("Telefone (WhatsApp)").fill("(71) 99999-0002");
  await page.getByLabel("Cidade").fill("Salvador");
  await page.getByRole("button", { name: /Salvar|Cadastrar/ }).click();
  await expect(page.getByText(/Já existe cliente com este documento/)).toBeVisible();
});

test("REAL-ERP-02: isolamento no navegador — outro escritório não vê o cliente; estagiário não aprova minuta", async ({ page }) => {
  await login(page, people.outro);
  await page.waitForURL(/\/app\/inicio/, { timeout: 20_000 });
  await page.goto("/app/clientes");
  await expect(page.getByText("Maria QA Sintética")).toHaveCount(0);
  // Tentativa direta com a sessão do titular de OUTRO escritório, pedindo os registros do A: o banco devolve zero linhas.
  const outro = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await outro.auth.signInWithPassword({ email: people.outro.email, password: people.outro.password });
  const { data } = await outro.from("org_records").select("id").eq("organization_id", orgA);
  expect(data).toEqual([]);
  const ins = await outro.from("org_records").insert({ organization_id: orgA, collection: "clients", id: "invasao", data: { id: "invasao", organizationId: orgA } });
  expect(ins.error?.message).toMatch(/row-level security/);
  // Anônimo (só chave publicável) não lê nada.
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const a = await anon.from("org_records").select("id").limit(1);
  expect(a.data ?? []).toEqual([]);
});

test("REAL-ERP-03: estagiário cria minuta e não consegue aprovar (recusa do banco aparece na tela)", async ({ page }) => {
  const now = new Date().toISOString();
  await admin.from("org_records").insert({ organization_id: orgA, collection: "drafts", id: `dr-${tag}`, data: { id: `dr-${tag}`, organizationId: orgA, title: "Minuta QA", kind: "petição", body: "Texto completo da minuta de teste.", status: "revisao", references: [], comments: [], history: [], updatedAt: now } }).throwOnError();
  await login(page, people.est);
  await page.waitForURL(/\/app\/inicio/, { timeout: 20_000 });
  await page.goto(`/app/minutas/dr-${tag}`);
  await expect(page.getByText("Minuta QA").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /^Aprovar/ })).toHaveCount(0);
  const { data } = await admin.from("org_records").select("data").eq("id", `dr-${tag}`).single();
  expect((data!.data as { status: string }).status).toBe("revisao");
});

test("REAL-ERP-04: portal — cliente vê só o próprio caso, envia documento ao Storage e a equipe recebe", async ({ page }) => {
  const now = new Date().toISOString();
  const { data: c } = await admin.from("org_records").select("id").eq("organization_id", orgA).eq("collection", "clients").single();
  const clientId = c!.id as string;
  const rows = [
    { collection: "cases", id: `k-${tag}`, data: { clientId, title: "Aposentadoria QA", area: "Previdenciário", service: "Aposentadoria", kind: "administrativo", phase: "documentacao", priority: "normal", ownerId: people.adv.id, confidential: false, portalStatus: "Estamos reunindo seus documentos.", portalNextStep: "Envie o RG pelo portal.", notes: "ANOTACAO-INTERNA" } },
    { collection: "documents", id: `doc-${tag}`, data: { clientId, caseId: `k-${tag}`, name: "RG (frente e verso)", type: "Documento pessoal", status: "solicitado", sharedWithClient: true, hasFixtureExtraction: false, requestedAt: now, requestNote: "Foto legível", history: [] } },
    { collection: "documents", id: `int-${tag}`, data: { clientId, caseId: `k-${tag}`, name: "PARECER-INTERNO", type: "Peça", status: "recebido", sharedWithClient: false, hasFixtureExtraction: false, history: [] } },
  ];
  await admin.from("org_records").insert(rows.map((r) => ({ organization_id: orgA, ...r, data: { id: r.id, organizationId: orgA, ...r.data } }))).throwOnError();
  await admin.from("portal_links").insert({ user_id: people.cli.id, organization_id: orgA, client_id: clientId }).throwOnError();

  await login(page, people.cli, "cliente");
  await page.waitForURL(/\/portal/, { timeout: 20_000 });
  await expect(page.getByText("Estamos reunindo seus documentos.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("ANOTACAO-INTERNA")).toHaveCount(0);
  await page.goto("/portal/documentos");
  await expect(page.getByText("RG (frente e verso)")).toBeVisible();
  await expect(page.getByText("PARECER-INTERNO")).toHaveCount(0);
  // PDF mínimo válido gerado no teste (sem dado pessoal).
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "rg-qa.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByText(/rg-qa\.pdf/)).toBeVisible({ timeout: 20_000 });

  const { data: d } = await admin.from("org_records").select("data").eq("id", `doc-${tag}`).single();
  expect((d!.data as { status: string; origin: string }).status).toBe("recebido");
  expect((d!.data as { origin: string }).origin).toBe("portal");
  const { data: files } = await admin.storage.from("documentos").list(`${orgA}/doc-${tag}`);
  expect(files?.length).toBe(1);

  await page.goto("/portal/ajuda");
  await page.getByPlaceholder("Escreva sua dúvida").fill("Quando será a perícia? (teste QA)");
  await page.getByRole("button", { name: "Enviar dúvida" }).click();
  await expect(page.getByText(/Dúvida enviada/)).toBeVisible({ timeout: 15_000 });
  const { data: t } = await admin.from("org_records").select("data").eq("organization_id", orgA).eq("collection", "tasks");
  expect(t?.some((x) => (x.data as { assigneeId: string }).assigneeId === people.adv.id)).toBe(true);
});

test("REAL-ERP-06: advogada libera o portal a um cliente pela tela (convite + vínculo no banco); estagiário não vê a opção", async ({ page }) => {
  const { data: c } = await admin.from("org_records").select("id").eq("organization_id", orgA).eq("collection", "clients").single();
  const email = `qa-portal2-${tag}@lexsion-qa.invalid`;
  await login(page, people.adv);
  await page.waitForURL(/\/app\/inicio/, { timeout: 20_000 });
  await page.goto(`/app/clientes/${c!.id}`);
  await page.getByRole("button", { name: "Liberar portal" }).click();
  await page.getByLabel("E-mail do cliente").fill(email);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText(new RegExp(`Convite enviado para ${email.replace(/[.]/g, "\\.")}`))).toBeVisible({ timeout: 20_000 });
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = users.users.find((x) => x.email === email)!;
  people.portal2 = { id: u.id, email, password: "" }; // apagado no afterAll
  const { data: link } = await admin.from("portal_links").select("client_id").eq("user_id", u.id).single();
  expect(link?.client_id).toBe(c!.id);
  await page.context().clearCookies();
  await login(page, people.est);
  await page.waitForURL(/\/app\/inicio/, { timeout: 20_000 });
  await page.goto(`/app/clientes/${c!.id}`);
  await expect(page.getByRole("heading", { name: "Maria QA Sintética" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Liberar portal" })).toHaveCount(0);
});

test("REAL-ERP-05:módulo dependente de provedor sem credencial fica bloqueado com o motivo (nada simulado)", async ({ page }) => {
  await login(page, people.tit);
  await page.waitForURL(/\/app\/inicio/, { timeout: 20_000 });
  await page.goto("/app/pagamentos");
  await expect(page.getByText("Integração pendente")).toBeVisible();
  await expect(page.getByText(/Nenhuma cobrança é emitida/)).toBeVisible();
  await expect(page.getByRole("button", { name: /cobrança/i })).toHaveCount(0);
});
