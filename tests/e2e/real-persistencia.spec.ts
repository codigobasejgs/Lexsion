import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { passMfa } from "./totp";

// Persistência REAL por módulo: grava pela tela → sai → entra de novo → confere na tela E no banco.
// Também: Super Admin cria escritório de verdade, white-label e manifesto PWA do escritório real.
// Pessoas e escritórios SINTÉTICOS (qa-…@lexsion-qa.invalid). Tudo é apagado no final. Sem .env.local: pulado.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const tag = crypto.randomBytes(3).toString("hex");
const SLOW = Number(process.env.SLOW ?? 30_000);
type U = { id: string; email: string; password: string };
let admin: SupabaseClient;
let org = "";
const people: Record<string, U> = {};
let saSecret: string | undefined; // TOTP do Super Admin sintético (MFA obrigatório na plataforma)
const createdOrgs: string[] = [];

test.describe.configure({ mode: "serial", timeout: 4 * SLOW + 60_000 });
test.skip(!ON, "Supabase não configurado neste ambiente");

async function mkUser(key: string, name: string): Promise<U> {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ user_id: data.user.id, full_name: name }).throwOnError();
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U, dest = /\/app\/inicio/) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(dest, { timeout: SLOW });
}
async function logout(page: Page) {
  await page.locator("summary", { hasText: "Menu do usuário" }).click();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/entrar/, { timeout: SLOW });
}
const rows = async (coll: string) => ((await admin.from("org_records").select("data").eq("organization_id", org).eq("collection", coll)).data ?? []).map((r) => r.data as Record<string, unknown>);

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  people.tit = await mkUser("ptit", "QA Titular Persistência");
  people.adv = await mkUser("padv", "QA Advogado Persistência");
  people.fin = await mkUser("pfin", "QA Financeiro Persistência");
  const { data } = await admin.from("organizations").insert({ slug: `qa-pers-${tag}`, name: `QA Persistência ${tag}`, status: "trial" }).select("id").single().throwOnError();
  org = data!.id;
  createdOrgs.push(org);
  await admin.from("organization_memberships").insert([
    { organization_id: org, user_id: people.tit.id, role: "admin" },
    { organization_id: org, user_id: people.adv.id, role: "advogado" },
    { organization_id: org, user_id: people.fin.id, role: "financeiro" },
  ]).throwOnError();
});

test.afterAll(async () => {
  if (!admin) return;
  const { data: extra } = await admin.from("organizations").select("id,slug").like("slug", `%${tag}%`);
  for (const o of extra ?? []) if (!createdOrgs.includes(o.id)) createdOrgs.push(o.id);
  for (const o of extra ?? []) {
    const { data: files } = await admin.storage.from("marcas").list(`slug-${o.slug}`);
    if (files?.length) await admin.storage.from("marcas").remove(files.map((f) => `slug-${o.slug}/${f.name}`));
  }
  for (const id of createdOrgs) {
    const { data: dirs } = await admin.storage.from("documentos").list(id);
    for (const d of dirs ?? []) { const { data: fs2 } = await admin.storage.from("documentos").list(`${id}/${d.name}`); if (fs2?.length) await admin.storage.from("documentos").remove(fs2.map((x) => `${id}/${d.name}/${x.name}`)); }
  }
  if (createdOrgs.length) { await admin.from("organizations").delete().in("id", createdOrgs); await admin.from("audit_logs").delete().in("organization_id", createdOrgs); }
  const { data: us } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of us.users.filter((x) => x.email?.includes(`-${tag}@lexsion-qa.invalid`))) await admin.auth.admin.deleteUser(u.id);
});

test("PERS-01: cliente, caso, tarefa e compromisso gravados pela tela sobrevivem a sair e entrar", async ({ page }) => {
  await login(page, people.adv);
  // Cliente
  await page.goto("/app/clientes/novo");
  await page.getByLabel("Nome completo").fill("João QA Persistente");
  await page.getByLabel("CPF").fill("111.444.777-35");
  await page.getByLabel("Telefone (WhatsApp)").fill("(71) 98888-0001");
  await page.getByLabel("Cidade").fill("Feira de Santana");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await page.waitForURL(/\/app\/clientes\/c-/, { timeout: SLOW });
  // Caso
  await page.getByRole("button", { name: "Abrir caso" }).click();
  await page.getByLabel("Título do caso").fill("BPC QA Persistente");
  await page.getByLabel("Serviço").fill("BPC/LOAS");
  await page.getByRole("dialog").getByRole("button", { name: /Abrir caso|Salvar|Criar/ }).last().click();
  await expect.poll(async () => (await rows("cases")).map((k) => k.title), { timeout: SLOW }).toContain("BPC QA Persistente");
  // Tarefa
  await page.goto("/app/tarefas");
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  await page.getByRole("dialog").getByLabel("Título").fill("Juntar laudo QA");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect.poll(async () => (await rows("tasks")).map((t) => t.title), { timeout: SLOW }).toContain("Juntar laudo QA");
  // Compromisso
  await page.goto("/app/agenda");
  await page.getByRole("button", { name: /Novo compromisso/ }).first().click();
  await page.getByRole("dialog").getByLabel("Título").fill("Reunião QA Persistente");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect.poll(async () => (await rows("events")).map((e) => e.title), { timeout: SLOW }).toContain("Reunião QA Persistente");

  await logout(page);
  await login(page, people.adv);
  await page.goto("/app/clientes");
  await expect(page.getByText("João QA Persistente").locator("visible=true").first()).toBeVisible({ timeout: SLOW });
  await page.goto("/app/casos");
  await expect(page.getByText("BPC QA Persistente").locator("visible=true").first()).toBeVisible({ timeout: SLOW });
  await page.goto("/app/tarefas?ver=lista");
  await expect(page.getByText("Juntar laudo QA").locator("visible=true").first()).toBeVisible({ timeout: SLOW });
  // Autoria real (não perfil fictício)
  const [k] = await rows("cases");
  expect(k.ownerId).toBe(people.adv.id);
  const { data: audit } = await admin.from("audit_logs").select("actor_id").eq("organization_id", org).eq("entity", "cases");
  expect(audit?.some((a) => a.actor_id === people.adv.id)).toBe(true);
});

test("PERS-02: CRM (lead) e financeiro (despesa) persistem; financeiro não vê o CRM", async ({ page }) => {
  await login(page, people.adv);
  await page.goto("/app/crm?novo=1");
  const d = page.getByRole("dialog", { name: "Novo lead" });
  await d.getByLabel("Nome").fill("Lead QA Persistente");
  await d.getByLabel("Telefone (WhatsApp)").fill("(71) 97777-0001");
  await d.getByLabel("Serviço de interesse").fill("Aposentadoria");
  await d.getByRole("checkbox").first().check().catch(() => {});
  await d.getByRole("button", { name: /Salvar|Cadastrar|Criar/ }).last().click();
  await expect.poll(async () => (await rows("leads")).map((l) => l.name), { timeout: SLOW }).toContain("Lead QA Persistente");
  await logout(page);

  await login(page, people.fin);
  await page.goto("/app/financeiro/pagar");
  await page.getByRole("button", { name: /Nova despesa/ }).click();
  const e = page.getByRole("dialog", { name: "Nova despesa" });
  await e.getByLabel("Descrição").fill("Custas QA Persistente");
  await e.getByLabel("Valor (R$)").fill("123,45");
  await e.getByRole("button", { name: /Salvar|Registrar|Criar/ }).last().click();
  await expect.poll(async () => (await rows("expenses")).map((x) => x.description), { timeout: SLOW }).toContain("Custas QA Persistente");
  expect((await rows("expenses"))[0].amount).toBe(12345); // centavos, sem arredondamento
  await page.goto("/app/crm");
  await expect(page.getByText("Lead QA Persistente")).toHaveCount(0);
  await logout(page);
  await login(page, people.fin);
  await page.goto("/app/financeiro/pagar");
  await expect(page.getByText("Custas QA Persistente").locator("visible=true").first()).toBeVisible({ timeout: SLOW });
});

test("PERS-03: documento enviado pela equipe vai ao Storage privado e reabre depois de sair e entrar", async ({ page }) => {
  await login(page, people.adv);
  await page.goto("/app/documentos");
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  await page.getByRole("button", { name: "Enviar documento" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Enviar documento" });
  await dlg.getByLabel("Cliente").selectOption({ label: "João QA Persistente" });
  await dlg.locator('input[type="file"][aria-label="Arquivo"]').setInputFiles({ name: "procuracao-qa.pdf", mimeType: "application/pdf", buffer: pdf });
  await dlg.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect.poll(async () => (await rows("documents")).map((x) => x.name), { timeout: SLOW }).toContain("procuracao-qa.pdf");
  const files = await rows("files");
  expect(files.length).toBe(1);
  expect(String(files[0].path)).toMatch(new RegExp(`^${org}/`));
  expect(files[0].blob).toBeUndefined(); // arquivo não fica no banco, só no Storage
  const { data: obj } = await admin.storage.from("documentos").list(`${org}/${files[0].id}`);
  expect(obj?.length).toBe(1);
  await dlg.getByRole("button", { name: "Concluir" }).click();
  await logout(page);
  await login(page, people.adv);
  const doc = (await rows("documents")).find((x) => x.name === "procuracao-qa.pdf")!;
  await page.goto(`/app/documentos/${doc.id}`);
  await expect(page.getByText("procuracao-qa.pdf").locator("visible=true").first()).toBeVisible({ timeout: SLOW });
});

test("SA-01: Super Admin cria escritório real (convite ao titular) e o escritório nasce vazio, sem dado de demonstração", async ({ page }) => {
  const { data: owner } = await admin.from("platform_members").select("user_id").eq("role", "superadmin").limit(1).single();
  test.skip(!owner, "sem superadmin");
  // Super Admin sintético temporário (não usa a conta do dono).
  people.sa = await mkUser("psa", "QA Super Admin");
  await admin.from("platform_members").insert({ user_id: people.sa.id, role: "platform_admin" }).throwOnError();
  await login(page, people.sa, /\/admin/);
  saSecret = await passMfa(page, saSecret);
  await page.goto("/admin/organizacoes");
  await page.getByRole("button", { name: "Novo escritório" }).click();
  const d = page.getByRole("dialog", { name: "Novo escritório" });
  await d.getByLabel("Nome do escritório").fill(`QA Criado ${tag}`);
  await d.getByLabel("Endereço (slug)").fill(`qa-criado-${tag}`);
  await d.getByRole("button", { name: "Continuar" }).click();
  await d.getByLabel("Nome do responsável").fill("QA Novo Titular");
  await d.getByLabel("E-mail do responsável").fill(`qa-novotit-${tag}@lexsion-qa.invalid`);
  for (let i = 0; i < 3; i++) await d.getByRole("button", { name: "Continuar" }).click();
  await d.getByRole("button", { name: "Criar escritório" }).click();
  await expect(page.getByText(/criado\. Convite enviado/)).toBeVisible({ timeout: SLOW });
  const { data: o } = await admin.from("organizations").select("id,status,plan,meta").eq("slug", `qa-criado-${tag}`).single();
  createdOrgs.push(o!.id);
  expect(o!.status).toBe("trial");
  expect((o!.meta as { ownerEmail: string }).ownerEmail).toBe(`qa-novotit-${tag}@lexsion-qa.invalid`);
  const { data: m } = await admin.from("organization_memberships").select("role").eq("organization_id", o!.id);
  expect(m?.map((x) => x.role)).toEqual(["admin"]);
  const { count } = await admin.from("org_records").select("id", { count: "exact", head: true }).eq("organization_id", o!.id);
  expect(count).toBe(0); // nenhum dado de demonstração entra em escritório real
  // Plano e suspensão pela tela, com motivo e auditoria
  await page.getByTestId(`tenant-qa-criado-${tag}`).getByRole("button", { name: "Suspender" }).click();
  await page.getByLabel("Motivo (registrado na auditoria)").fill("Teste QA de suspensão");
  await page.getByRole("dialog").getByRole("button", { name: "Suspender" }).click();
  await expect.poll(async () => (await admin.from("organizations").select("status").eq("id", o!.id).single()).data?.status, { timeout: SLOW }).toBe("suspensa");
  const { data: au } = await admin.from("audit_logs").select("detail").eq("organization_id", o!.id).eq("action", "status");
  expect(au?.[0]?.detail).toMatch(/Teste QA de suspensão/);
});

test("WL-01: titular muda a marca; outro escritório não é afetado; manifesto PWA do escritório real reflete a marca", async ({ page, request }) => {
  await login(page, people.tit);
  await page.goto("/app/configuracoes/branding");
  await page.getByLabel("Nome exibido").fill(`Marca QA ${tag}`);
  await page.getByLabel("Nome curto do aplicativo").fill("MarcaQA");
  await page.getByRole("button", { name: /^Salvar/ }).first().click();
  await expect(page.getByText(/Identidade salva/)).toBeVisible({ timeout: SLOW });
  const { data: o } = await admin.from("organizations").select("branding").eq("id", org).single();
  expect((o!.branding as { brandName: string }).brandName).toBe(`Marca QA ${tag}`);
  const r = await request.get(`/pwa/erp-qa-pers-${tag}/manifest.webmanifest`);
  expect(r.status()).toBe(200);
  const m = await r.json();
  expect(m.name).toBe(`Marca QA ${tag}`);
  expect(m.start_url).toMatch(/^\/entrar\?escritorio=/);
  const p = await (await request.get(`/pwa/portal-qa-pers-${tag}/manifest.webmanifest`)).json();
  expect(p.id).not.toBe(m.id);
  expect(p.start_url).toMatch(/perfil=cliente/);
  expect((await request.get(`/pwa/erp-qa-inexistente-${tag}/manifest.webmanifest`)).status()).toBe(404);
  // Advogado(a) não altera a marca (banco recusa mesmo pela API)
  const adv = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await adv.auth.signInWithPassword({ email: people.adv.email, password: people.adv.password });
  const { data: upd } = await adv.from("organizations").update({ branding: { brandName: "invadido" } }).eq("id", org).select("id");
  expect(upd ?? []).toEqual([]);
});

test("DEMO-ISO-01: usar a demonstração na mesma aba não grava nada no banco real", async ({ page }) => {
  const before = (await admin.from("org_records").select("id", { count: "exact", head: true }).eq("organization_id", org)).count;
  // Mesma aba: primeiro uma sessão REAL, depois a demonstração (pior caso de mistura).
  await login(page, people.adv);
  await page.goto("/demonstracao");
  await page.getByRole("radio", { name: /Helena Prado/ }).check();
  await page.getByRole("button", { name: /^Entrar como/ }).click();
  await page.waitForURL(/\/app\/inicio/, { timeout: SLOW });
  await expect(page.getByText("Ambiente demonstrativo").first()).toBeVisible();
  await page.goto("/app/clientes/novo");
  await page.getByLabel("Nome completo").fill("Fictício Demo QA");
  await page.getByLabel("CPF").fill("390.533.447-05");
  await page.getByLabel("Telefone (WhatsApp)").fill("(71) 96666-0001");
  await page.getByLabel("Cidade").fill("Salvador");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await page.waitForURL(/\/app\/clientes\/c-/, { timeout: SLOW });
  const after = (await admin.from("org_records").select("id", { count: "exact", head: true }).eq("organization_id", org)).count;
  expect(after).toBe(before);
  const { data } = await admin.from("org_records").select("id").filter("data->>name", "eq", "Fictício Demo QA");
  expect(data ?? []).toEqual([]);
});
