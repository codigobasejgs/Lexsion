import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { passMfa } from "./totp";

// Fluxo comercial e operacional REAL, de ponta a ponta, com escritório e pessoas sintéticos (qa-…@lexsion-qa.invalid):
// proposta → revisão → aprovação por advogado(a) → envio registrado → aceite registrado → contrato → assinaturas
// registradas → parcelas no financeiro → baixa manual de pagamento; publicação no portal; exclusão autorizada;
// suspensão e reativação pelo Super Admin. Nenhum dinheiro, mensagem ou assinatura real é movimentado.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const SLOW = Number(process.env.SLOW ?? 30_000);
const tag = crypto.randomBytes(3).toString("hex");
type U = { id: string; email: string; password: string };
let admin: SupabaseClient;
let org = "";
const people: Record<string, U> = {};
let saSecret: string | undefined; // TOTP do Super Admin sintético (MFA obrigatório na plataforma)

test.describe.configure({ mode: "serial", timeout: 8 * SLOW + 60_000 });
test.skip(!ON, "Supabase não configurado neste ambiente");

async function mkUser(key: string, name: string): Promise<U> {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ user_id: data.user.id, full_name: name }).throwOnError();
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U, dest = /\/app\/inicio/) {
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(dest, { timeout: SLOW });
}
const rows = async (coll: string) => ((await admin.from("org_records").select("data").eq("organization_id", org).eq("collection", coll)).data ?? []).map((r) => r.data as Record<string, unknown>);

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  people.adv = await mkUser("cadv", "QA Advogada Comercial");
  people.est = await mkUser("cest", "QA Estagiário Comercial");
  people.fin = await mkUser("cfin", "QA Financeiro Comercial");
  people.sa = await mkUser("csa", "QA Plataforma Comercial");
  await admin.from("platform_members").insert({ user_id: people.sa.id, role: "platform_admin" }).throwOnError();
  const { data } = await admin.from("organizations").insert({ slug: `qa-com-${tag}`, name: `QA Comercial ${tag}`, status: "trial" }).select("id").single().throwOnError();
  org = data!.id;
  await admin.from("organization_memberships").insert([
    { organization_id: org, user_id: people.adv.id, role: "advogado" },
    { organization_id: org, user_id: people.est.id, role: "estagiario" },
    { organization_id: org, user_id: people.fin.id, role: "financeiro" },
  ]).throwOnError();
  const cid = `c-com-${tag}`;
  await admin.from("org_records").insert({ organization_id: org, collection: "clients", id: cid, data: { id: cid, organizationId: org, kind: "PF", name: "Cliente QA Comercial", document: "52998224725", phone: "(71) 90000-0000", city: "Salvador", uf: "BA", ownerId: people.adv.id, origin: "Cadastro manual", status: "ativo", createdAt: new Date().toISOString() } }).throwOnError();
});

test.afterAll(async () => {
  if (!admin) return;
  // Storage não cai em cascata com o escritório: remove os objetos sintéticos explicitamente.
  for (const [bucket, prefix] of [["marcas", `slug-qa-com-${tag}`], ["documentos", org]] as const) {
    const { data: dirs } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
    for (const d of dirs ?? []) {
      const { data: inner } = await admin.storage.from(bucket).list(`${prefix}/${d.name}`, { limit: 100 });
      const paths = inner?.length ? inner.map((x) => `${prefix}/${d.name}/${x.name}`) : [`${prefix}/${d.name}`];
      await admin.storage.from(bucket).remove(paths);
    }
  }
  await admin.from("organizations").delete().eq("id", org);
  await admin.from("audit_logs").delete().eq("organization_id", org);
  await admin.from("platform_members").delete().eq("user_id", people.sa?.id ?? "");
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("COM-01: proposta → aprovação → aceite → contrato → assinaturas → parcelas no financeiro → baixa manual", async ({ page }) => {
  // Financeiro cria a proposta e envia para revisão; não consegue aprovar. Estagiário nem enxerga propostas.
  await login(page, people.fin);
  await page.goto("/app/propostas/nova");
  await page.getByLabel("Título").fill("Proposta QA Comercial");
  await page.getByLabel("Serviço").fill("Aposentadoria por idade");
  await page.getByLabel("Cliente (se já convertido)").selectOption({ label: "Cliente QA Comercial" });
  await page.getByLabel("Total (R$)").fill("3.000,00");
  await page.getByLabel("Parcelas").fill("3");
  await page.getByRole("button", { name: "Gerar" }).click();
  await page.getByRole("button", { name: "Criar proposta" }).click();
  await page.waitForURL(/\/app\/propostas\/(?!nova)/, { timeout: SLOW });
  await page.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect.poll(async () => (await rows("proposals"))[0]?.status, { timeout: SLOW }).toBe("em_revisao");
  await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
  const propId = String((await rows("proposals"))[0].id);
  // Tentativa direta pelo banco: financeiro não aprova (trigger); estagiário não lê nem grava propostas (RLS).
  const fin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await fin.auth.signInWithPassword({ email: people.fin.email, password: people.fin.password });
  const est = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await est.auth.signInWithPassword({ email: people.est.email, password: people.est.password });
  expect((await est.from("org_records").select("id").eq("organization_id", org).eq("collection", "proposals")).data ?? []).toEqual([]);
  const [p0] = await rows("proposals");
  const forced = await fin.from("org_records").update({ data: { ...p0, status: "aprovada" } }).eq("organization_id", org).eq("collection", "proposals").eq("id", propId);
  expect(forced.error?.message ?? "").toMatch(/somente advogado/);

  // Advogada aprova, registra envio e aceite, gera contrato.
  await login(page, people.adv);
  await page.goto(`/app/propostas/${propId}`);
  await page.getByRole("button", { name: "Aprovar" }).click();
  await page.getByRole("button", { name: "Marcar como enviada ao cliente" }).click();
  await page.getByRole("button", { name: "Cliente aceitou" }).click();
  await expect.poll(async () => (await rows("proposals"))[0]?.status, { timeout: SLOW }).toBe("aceita");
  await page.getByRole("button", { name: "Gerar contrato" }).click();
  await page.waitForURL(/\/app\/contratos\//, { timeout: SLOW });
  await expect(page.getByText(/ZapSign\) ainda não está ativa/)).toBeVisible({ timeout: SLOW });
  await expect(page.getByRole("button", { name: /Simular/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Liberar para coleta de assinaturas" }).click();
  const signBtn = page.getByRole("button", { name: "Registrar assinatura" });
  await expect(signBtn).toHaveCount(2, { timeout: SLOW }); // contratante + contratada
  await signBtn.first().click();
  await expect(signBtn).toHaveCount(1, { timeout: SLOW });
  await signBtn.first().click();
  await expect(signBtn).toHaveCount(0, { timeout: SLOW });
  await expect.poll(async () => (await rows("contracts"))[0]?.status, { timeout: SLOW }).toBe("concluido");
  const insts = await rows("installments");
  expect(insts.length).toBe(3);
  expect(insts.reduce((s, i) => s + Number(i.amount), 0)).toBe(300000); // centavos, soma exata
  const [ct] = await rows("contracts");
  expect((ct.snapshot as { clientName: string }).clientName).toBe("Cliente QA Comercial"); // dados congelados

  // Financeiro registra baixa manual de uma parcela; saldo recalculado; persiste após sair e entrar.
  await login(page, people.fin);
  await page.goto("/app/financeiro/receber");
  await page.getByRole("button", { name: "Registrar pagamento" }).first().click();
  await page.getByLabel("Valor recebido (R$)").fill("1.000,00");
  await page.getByLabel("Origem / justificativa").fill("Pix recebido (teste QA, sem movimentação real)");
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect.poll(async () => (await rows("payments")).length, { timeout: SLOW }).toBe(1);
  await expect.poll(async () => (await rows("installments")).filter((i) => i.status === "paga").length, { timeout: SLOW }).toBe(1);
  await login(page, people.fin);
  await page.goto("/app/financeiro/receber");
  await expect(page.getByText(/Cliente QA Comercial/).locator("visible=true").first()).toBeVisible({ timeout: SLOW });
});

test("COM-02: atualização de portal — estagiário escreve rascunho, só advogado(a) publica; cliente vê só o publicado", async ({ page }) => {
  const kid = `k-com-${tag}`;
  await admin.from("org_records").insert({ organization_id: org, collection: "cases", id: kid, data: { id: kid, organizationId: org, clientId: `c-com-${tag}`, title: "Caso QA Portal", area: "Previdenciário", service: "Aposentadoria", kind: "administrativo", phase: "documentacao", priority: "normal", ownerId: people.adv.id, confidential: false, portalStatus: "Recebemos seu caso.", portalNextStep: "Aguarde." } }).throwOnError();
  await login(page, people.est);
  await page.goto(`/app/casos/${kid}?aba=geral`);
  await page.getByText("Escrever atualização para o cliente").click();
  await page.getByLabel(/O que aconteceu/).fill("Seu pedido foi protocolado no INSS (teste QA).");
  await page.getByLabel("Próximo passo para o cliente").fill("Aguardar a perícia");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByRole("button", { name: "Publicar no portal" })).toHaveCount(0);
  await expect.poll(async () => ((await rows("cases"))[0].portalUpdates as unknown[] | undefined)?.length ?? 0, { timeout: SLOW }).toBe(1);
  await login(page, people.adv);
  await page.goto(`/app/casos/${kid}?aba=geral`);
  await page.getByRole("button", { name: "Publicar no portal" }).click();
  await expect.poll(async () => (await rows("cases"))[0].portalStatus, { timeout: SLOW }).toBe("Seu pedido foi protocolado no INSS (teste QA).");
});

test("COM-03: exclusão autorizada — advogada exclui tarefa; financeiro não exclui cliente; a auditoria registra", async () => {
  const adv = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await adv.auth.signInWithPassword({ email: people.adv.email, password: people.adv.password });
  const tid = `t-com-${tag}`;
  await admin.from("org_records").insert({ organization_id: org, collection: "tasks", id: tid, data: { id: tid, organizationId: org, title: "Tarefa QA", assigneeId: people.adv.id, due: "2026-11-30", priority: "normal", done: false } }).throwOnError();
  const del = await adv.from("org_records").delete().eq("organization_id", org).eq("collection", "tasks").eq("id", tid).select("id");
  expect((del.data ?? []).length).toBe(1);
  const fin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await fin.auth.signInWithPassword({ email: people.fin.email, password: people.fin.password });
  const delC = await fin.from("org_records").delete().eq("organization_id", org).eq("collection", "clients").eq("id", `c-com-${tag}`).select("id");
  expect(delC.data ?? []).toEqual([]);
  expect((await rows("clients")).length).toBe(1);
  const { data: au } = await admin.from("audit_logs").select("action,actor_id").eq("organization_id", org).eq("entity", "tasks").eq("entity_id", tid);
  expect(au?.some((a) => a.action === "delete" && a.actor_id === people.adv.id)).toBe(true);
});

test("COM-04: Super Admin suspende e reativa; equipe perde e recupera o acesso com os dados intactos", async ({ page }) => {
  const before = (await rows("clients")).length;
  await login(page, people.sa, /\/admin/);
  saSecret = await passMfa(page, saSecret);
  await page.goto("/admin/organizacoes");
  await page.getByTestId(`tenant-qa-com-${tag}`).getByRole("button", { name: "Suspender" }).click();
  await page.getByLabel("Motivo (registrado na auditoria)").fill("Teste QA de suspensão");
  await page.getByRole("dialog").getByRole("button", { name: "Suspender" }).click();
  await expect.poll(async () => (await admin.from("organizations").select("status").eq("id", org).single()).data?.status, { timeout: SLOW }).toBe("suspensa");
  const adv = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await adv.auth.signInWithPassword({ email: people.adv.email, password: people.adv.password });
  expect((await adv.from("org_records").select("id").eq("organization_id", org)).data ?? []).toEqual([]);
  await page.reload();
  await page.getByTestId(`tenant-qa-com-${tag}`).getByRole("button", { name: "Reativar" }).click();
  await expect.poll(async () => (await admin.from("organizations").select("status").eq("id", org).single()).data?.status, { timeout: SLOW }).toBe("ativa");
  expect(((await adv.from("org_records").select("id").eq("organization_id", org).eq("collection", "clients")).data ?? []).length).toBe(before);
});

test("COM-05: lead atualizado pela tela (etapa + motivo da perda) persiste depois de sair e entrar; nada é apagado", async ({ page }) => {
  const lid = `l-com-${tag}`, now = new Date().toISOString();
  const touch = { at: now, evidence: "declarada", origin: "Indicação" };
  await admin.from("org_records").insert({ organization_id: org, collection: "leads", id: lid, data: { id: lid, organizationId: org, name: "Lead QA Comercial", phone: "5571977770002", area: "Previdenciário", service: "BPC", stage: "novo", ownerId: people.adv.id, consentContact: true, tags: [], firstTouch: touch, lastTouch: touch, history: [{ at: now, to: "novo", actorId: people.adv.id }], createdAt: now, stageEnteredAt: now } }).throwOnError();
  await login(page, people.adv);
  await page.goto(`/app/crm/leads/${lid}`);
  await page.getByRole("button", { name: "Mover etapa" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Nova etapa").selectOption("perdido");
  await d.getByLabel("Motivo da perda").selectOption({ index: 1 });
  await d.getByRole("button", { name: /^Mover para/ }).click();
  await expect.poll(async () => (await rows("leads"))[0]?.stage, { timeout: SLOW }).toBe("perdido");
  const [l] = await rows("leads");
  expect((l.history as { to: string; note?: string }[]).at(-1)).toMatchObject({ to: "perdido" });
  expect((l.history as { note?: string }[]).at(-1)?.note).toBeTruthy();
  await login(page, people.adv);
  await page.goto(`/app/crm/leads/${lid}`);
  await expect(page.getByText("Perdido").locator("visible=true").first()).toBeVisible({ timeout: SLOW });
  expect((await rows("leads")).length).toBe(1); // perda arquiva com histórico, não exclui
});

test("COM-06: documento enviado ao Storage privado e excluído pela tela some do banco e do Storage", async ({ page }) => {
  await login(page, people.adv);
  await page.goto("/app/documentos");
  await page.getByRole("button", { name: "Enviar documento" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Enviar documento" });
  await dlg.getByLabel("Cliente").selectOption({ label: "Cliente QA Comercial" });
  await dlg.locator('input[type="file"][aria-label="Arquivo"]').setInputFiles({ name: "rg-qa.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") });
  await dlg.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect.poll(async () => (await rows("documents")).map((x) => x.name), { timeout: SLOW }).toContain("rg-qa.pdf");
  const [file] = await rows("files");
  const dir = String(file.path).split("/").slice(0, 2).join("/");
  expect((await admin.storage.from("documentos").list(dir)).data?.length).toBe(1);
  await dlg.getByRole("button", { name: "Concluir" }).click();
  const doc = (await rows("documents")).find((x) => x.name === "rg-qa.pdf")!;
  await page.goto(`/app/documentos/${doc.id}`);
  await page.getByRole("button", { name: "Excluir" }).first().click();
  await expect(page.getByRole("dialog").getByText(/armazenamento do escritório/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
  await page.waitForURL(/\/app\/documentos$/, { timeout: SLOW });
  await expect.poll(async () => (await rows("documents")).length, { timeout: SLOW }).toBe(0);
  expect((await rows("files")).length).toBe(0);
  await expect.poll(async () => (await admin.storage.from("documentos").list(dir)).data?.length ?? 0, { timeout: SLOW }).toBe(0);
});

test("COM-07: logotipo enviado pela tela vira PNG público no bucket marcas; manifesto PWA do escritório usa o ícone próprio", async ({ page, request }) => {
  await admin.from("organization_memberships").update({ role: "admin" }).eq("organization_id", org).eq("user_id", people.adv.id).throwOnError();
  await login(page, people.adv);
  await page.goto("/app/configuracoes/branding");
  const b64 = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d")!; x.fillStyle = "#1d4ed8"; x.fillRect(0, 0, 256, 256); x.fillStyle = "#fff"; x.fillRect(64, 64, 128, 128); return c.toDataURL("image/png").split(",")[1]; });
  await page.getByTestId("logo-input").setInputFiles({ name: "logo-qa.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") });
  await expect(page.getByText(/Logotipo aceito/)).toBeVisible({ timeout: SLOW });
  await page.getByRole("button", { name: "Salvar identidade" }).click();
  await expect(page.getByText(/Identidade salva/)).toBeVisible({ timeout: SLOW });
  // Trocar o logotipo (sobrescreve o arquivo no bucket): antes da correção de 29/10 a 2ª publicação era recusada.
  await page.getByTestId("logo-input").setInputFiles({ name: "logo-qa-2.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") });
  await page.getByLabel("Nome curto do aplicativo").fill("QA Logo 2");
  await page.getByRole("button", { name: "Salvar identidade" }).click();
  await expect(page.getByText(/Identidade salva/)).toBeVisible({ timeout: SLOW });
  await expect(page.getByText(/Não foi possível publicar o logotipo/)).toHaveCount(0);
  const { data: o } = await admin.from("organizations").select("branding").eq("id", org).single();
  const br = o!.branding as { hasPublicIcon: boolean; pwaIcon512: string; logoLight: string };
  expect(br.hasPublicIcon).toBe(true);
  expect(br.pwaIcon512).toMatch(new RegExp(`/storage/v1/object/public/marcas/slug-qa-com-${tag}/icon-512\\.png`));
  expect(JSON.stringify(o!.branding)).not.toMatch(/data:image/); // nada de base64 no banco
  const m = await (await request.get(`/pwa/erp-qa-com-${tag}/manifest.webmanifest`)).json();
  const icon = (m.icons as { src: string }[]).find((i) => /icon-512/.test(i.src))!;
  expect(icon.src).toMatch(/marcas\/slug-qa-com-/);
  const img = await request.get(icon.src);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toMatch(/image\/png/);
  // Outro papel não sobrescreve o ícone no bucket (política de Storage por escritório).
  const fin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await fin.auth.signInWithPassword({ email: people.fin.email, password: people.fin.password });
  const up = await fin.storage.from("marcas").upload(`slug-qa-com-${tag}/icon-512.png`, Buffer.from("x"), { contentType: "image/png", upsert: true });
  expect(up.error).not.toBeNull();
});
