import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Contratação SaaS de PONTA A PONTA (servidor de teste com SAAS_CONFIG_NS=qa: modelo e contratada de TESTE, e-mail
// sintético nunca enviado): cadastro → contrato automático → aceite único → teste grátis de 30 dias → login.
// Sem aprovação manual. Duplo envio, refresh e repetição não duplicam contrato, pedido nem teste. Limpeza total.
// Só roda contra o servidor local de teste (QA_SAAS=1); em produção o namespace QA não existe.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && process.env.QA_SAAS === "1";
const SLOW = Number(process.env.SLOW ?? 45_000);
const tag = crypto.randomBytes(3).toString("hex");
const EMAIL = `qa-flow-${tag}@lexsion-qa.invalid`;
const SLUG = `qa-flow-${tag}`;
let admin: SupabaseClient;
test.describe.configure({ mode: "serial", timeout: 6 * SLOW });
test.skip(!ON, "fluxo completo só no servidor de teste (QA_SAAS=1, SAAS_CONFIG_NS=qa)");
test.use({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250)}` } });

const contracts = async () => ((await admin.from("saas_contracts").select("id,number,status,accepted_at,order_id,organization_id,template_status_at_render,body_text").eq("party->>email", EMAIL)).data ?? []);
async function fill(page: Page) {
  await page.getByLabel("Nome completo", { exact: true }).fill("Ana Fluxo Teste");
  await page.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
  await page.getByLabel(/^E-mail/).fill(EMAIL);
  await page.getByLabel(/Celular/).fill("11912345678");
  await page.getByLabel("CEP").fill("01310-100");
  await page.getByLabel("Logradouro").fill("Avenida Exemplo");
  await page.getByLabel("Número", { exact: true }).fill("100");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("Cidade", { exact: true }).fill("São Paulo");
  await page.getByLabel("UF", { exact: true }).fill("SP");
  await page.getByLabel(/Endereço do escritório na LexSion/).fill(SLUG);
}

test.beforeAll(async () => { admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } }); });
test.afterAll(async () => {
  if (!admin) return;
  const cs = await contracts();
  const ids = cs.map((c) => c.id), orgs = cs.map((c) => c.organization_id).filter(Boolean) as string[];
  if (orgs.length) { await admin.from("organizations").delete().in("id", orgs); await admin.from("audit_logs").delete().in("organization_id", orgs); }
  const { data: orders } = await admin.from("saas_orders").select("id,order_nsu").eq("customer->>email", EMAIL);
  for (const c of cs) await admin.storage.from("contratos-saas").remove([`${c.number}/contrato-aceito.pdf`]);
  if (ids.length) {
    await admin.from("saas_contract_files").delete().in("contract_id", ids);
    await admin.from("saas_contract_acceptances").delete().in("contract_id", ids);
    await admin.from("saas_contract_audit").delete().in("contract_id", ids);
    await admin.from("saas_contracts").update({ order_id: null }).in("id", ids);
  }
  if (orders?.length) { await admin.from("audit_logs").delete().in("entity_id", orders.map((o) => o.order_nsu)); await admin.from("saas_orders").delete().in("id", orders.map((o) => o.id)); }
  if (ids.length) await admin.from("saas_contracts").delete().in("id", ids);
  const { data: us } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of us.users.filter((x) => x.email === EMAIL)) await admin.auth.admin.deleteUser(u.id);
});

test("FLUXO-01: cadastro → contrato automático (sem aprovação) → aceite único → teste grátis → login; refresh e repetição não duplicam", async ({ page, request }) => {
  await page.goto("/contratar?plano=profissional");
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Continuar" }).click();
  await fill(page);
  // Duplo clique em "Revisar contrato": uma só tentativa ⇒ um só contrato.
  const btn = page.getByRole("button", { name: "Revisar contrato" });
  await btn.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); }); // dois cliques antes de a tela re-renderizar
  await expect(page.getByTestId("contrato-texto")).toContainText(/Nº LX-\d{4}-[0-9A-F]{10}/, { timeout: SLOW });
  await expect(page.getByText(/revisão jurídica|em preparação|Avise-me/i)).toHaveCount(0);
  await expect(page.getByTestId("contrato-texto")).not.toContainText("[PENDENTE");
  await expect(page.getByTestId("contrato-texto")).not.toContainText("MINUTA");
  expect((await contracts()).length).toBe(1);
  expect((await contracts())[0].template_status_at_render).toBe("PUBLICADO");

  // Refresh na etapa do contrato: volta ao contrato, sem novo contrato.
  await page.reload();
  await expect(page.getByTestId("contrato-texto")).toBeVisible({ timeout: SLOW });
  expect((await contracts()).length).toBe(1);
  // "Corrigir dados" e revisar de novo: MESMA tentativa (mesmo número), texto atualizado.
  const n1 = (await contracts())[0].number;
  await page.getByRole("button", { name: "Corrigir dados" }).click();
  await page.getByLabel("Bairro").fill("Bela Vista");
  await page.getByRole("button", { name: "Revisar contrato" }).click();
  await expect(page.getByTestId("contrato-texto")).toContainText("Bela Vista", { timeout: SLOW });
  expect((await contracts()).map((c) => c.number)).toEqual([n1]);

  // Aceite: caixas desmarcadas por padrão; sem elas, o servidor recusa.
  await page.getByRole("button", { name: "Continuar para o aceite" }).click();
  await expect(page.getByLabel(/Li o contrato integral/)).not.toBeChecked();
  await expect(page.getByLabel(/Aceito o contrato nesta versão/)).not.toBeChecked();
  const token = await page.evaluate(() => sessionStorage.getItem("lexsion.contratar.token"));
  const noConsent = await request.post("/api/contrato", { data: { action: "accept", token, hash: "x", read: false, agree: false, otp: "000000" } });
  expect(noConsent.status()).toBe(400);
  await page.getByLabel(/Li o contrato integral/).check();
  await page.getByLabel(/Aceito o contrato nesta versão/).check();
  const otpResp = page.waitForResponse((r) => r.url().endsWith("/api/contrato") && r.request().postData()?.includes('"otp"') === true && !r.request().postData()?.includes('"accept"'));
  await page.getByRole("button", { name: "Enviar código" }).click();
  const code = (await (await otpResp).json()).data.qaCode as string;
  await page.getByLabel("Código recebido por e-mail").fill(code);
  await page.getByRole("button", { name: "Aceitar e ativar teste" }).click();
  await expect(page.getByText(/Aceite eletrônico registrado/)).toBeVisible({ timeout: SLOW });
  await expect(page.getByText(/teste grátis de 30 dias, sem cobrança e sem cartão/)).toBeVisible({ timeout: SLOW });

  const [c] = await contracts();
  expect(c.accepted_at).not.toBeNull();
  expect(c.status).toBe("ACTIVE");
  const { data: org } = await admin.from("organizations").select("id,status,meta").eq("id", c.organization_id!).single();
  expect(org!.status).toBe("trial");
  const end = Date.parse((org!.meta as { trialEndsAt: string }).trialEndsAt);
  expect(Math.round((end - Date.now()) / 86_400_000)).toBeGreaterThanOrEqual(29);
  const orders = (await admin.from("saas_orders").select("id,status,amount").eq("contract_id", c.id)).data ?? [];
  expect(orders.map((o) => o.status)).toEqual(["teste"]); // sem cobrança antecipada
  expect((await admin.from("saas_contract_acceptances").select("id").eq("contract_id", c.id)).data?.length).toBe(1);

  // Repetição do aceite (outra aba / resposta perdida) e refresh: mesmo resultado, nada novo, teste não prorroga.
  const again = await request.post("/api/contrato", { data: { action: "accept", token } });
  expect((await again.json()).data.next.kind).toBe("trial");
  await page.reload();
  await expect(page.getByText(/Aceite eletrônico registrado/)).toBeVisible({ timeout: SLOW });
  expect((await contracts()).length).toBe(1);
  expect((await admin.from("saas_orders").select("id").eq("contract_id", c.id)).data?.length).toBe(1);
  expect(Date.parse(((await admin.from("organizations").select("meta").eq("id", c.organization_id!).single()).data!.meta as { trialEndsAt: string }).trialEndsAt)).toBe(end);
  // PDF do contrato aceito (mesmo texto aceito).
  const pdf = await request.post("/api/contrato", { data: { action: "pdf", token } });
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Primeiro acesso do titular (senha definida pelo teste; em produção vem do link do e-mail).
  const { data: us } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = us.users.find((x) => x.email === EMAIL)!;
  const password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  await admin.auth.admin.updateUserById(u.id, { password });
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\//, { timeout: SLOW });
  await page.goto("/app/boas-vindas");
  await expect(page.getByTestId("perfil-atuacao")).toBeVisible({ timeout: SLOW });
});

test("FLUXO-02: tentativa EXISTENTE criada com configuração incompleta retoma sozinha após configurar (sem redigitar), aceita e ativa", async ({ page, request }) => {
  const EMAIL2 = `qa-flow2-${tag}@lexsion-qa.invalid`;
  const SLUG2 = `qa-flow2-${tag}`;
  const qaCond = (await admin.from("saas_supplier_profile").select("conditions").eq("id", "qa").single()).data!.conditions as Record<string, string>;
  // 1) Configuração incompleta (falta a transferência internacional): o contrato nasce com pendência.
  const { transferencia, ...rest } = qaCond;
  await admin.from("saas_supplier_profile").update({ conditions: rest }).eq("id", "qa").throwOnError();
  try {
    await page.goto("/contratar?plano=profissional");
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Continuar" }).click();
    await fill(page);
    await page.getByLabel(/^E-mail/).fill(EMAIL2);
    await page.getByLabel("CPF", { exact: true }).fill("390.533.447-05"); // outro titular: 1 teste grátis por CPF/e-mail é regra real
    await page.getByLabel(/Endereço do escritório na LexSion/).fill(SLUG2);
    await page.getByRole("button", { name: "Revisar contrato" }).click();
    await expect(page.getByTestId("contrato-indisponivel")).toContainText("Seus dados ficam salvos", { timeout: SLOW });
    await expect(page.getByRole("button", { name: "Continuar para o aceite" })).toHaveCount(0);
    const before = (await admin.from("saas_contracts").select("number,body_text").eq("party->>email", EMAIL2)).data!;
    expect(before.length).toBe(1);
    expect(before[0].body_text).toContain("[PENDENTE");
  } finally {
    // 2) O administrador conclui a configuração (mesma tabela que o Super Admin grava).
    await admin.from("saas_supplier_profile").update({ conditions: { ...rest, transferencia } }).eq("id", "qa").throwOnError();
  }
  // 3) A MESMA aba recarrega: o contrato é regerado dos dados salvos (mesmo número), sem redigitar nada.
  const n = (await admin.from("saas_contracts").select("number").eq("party->>email", EMAIL2).single()).data!.number;
  await page.reload();
  await expect(page.getByTestId("contrato-texto")).toContainText(n, { timeout: SLOW });
  await expect(page.getByTestId("contrato-texto")).not.toContainText("[PENDENTE");
  await expect(page.getByTestId("contrato-indisponivel")).toHaveCount(0);
  await page.getByRole("button", { name: "Continuar para o aceite" }).click();
  await page.getByLabel(/Li o contrato integral/).check();
  await page.getByLabel(/Aceito o contrato nesta versão/).check();
  const otpResp = page.waitForResponse((r) => r.url().endsWith("/api/contrato") && r.request().postData()?.includes('"otp"') === true && !r.request().postData()?.includes('"accept"'));
  await page.getByRole("button", { name: "Enviar código" }).click();
  await page.getByLabel("Código recebido por e-mail").fill((await (await otpResp).json()).data.qaCode);
  await page.getByRole("button", { name: "Aceitar e ativar teste" }).click();
  await expect(page.getByText(/teste grátis de 30 dias, sem cobrança e sem cartão/)).toBeVisible({ timeout: SLOW });
  const after = (await admin.from("saas_contracts").select("id,number,status,organization_id").eq("party->>email", EMAIL2)).data!;
  expect(after.map((c) => c.number)).toEqual([n]); // mesma tentativa, nenhum contrato novo
  expect(after[0].status).toBe("ACTIVE");
  const token = await page.evaluate(() => sessionStorage.getItem("lexsion.contratar.token"));
  expect(((await (await request.post("/api/contrato", { data: { action: "accept", token } })).json()).data.next.kind)).toBe("trial");
  expect((await admin.from("saas_orders").select("id").eq("contract_id", after[0].id)).data?.length).toBe(1);
  // limpeza deste caso
  await admin.from("organizations").delete().eq("id", after[0].organization_id!);
  await admin.from("audit_logs").delete().eq("organization_id", after[0].organization_id!);
  const { data: o } = await admin.from("saas_orders").select("id,order_nsu").eq("contract_id", after[0].id);
  await admin.storage.from("contratos-saas").remove([`${n}/contrato-aceito.pdf`]);
  for (const t of ["saas_contract_files", "saas_contract_acceptances", "saas_contract_audit"]) await admin.from(t).delete().eq("contract_id", after[0].id);
  await admin.from("saas_contracts").update({ order_id: null }).eq("id", after[0].id);
  if (o?.length) { await admin.from("audit_logs").delete().in("entity_id", o.map((x) => x.order_nsu)); await admin.from("saas_orders").delete().in("id", o.map((x) => x.id)); }
  await admin.from("saas_contracts").delete().eq("id", after[0].id);
  const { data: us } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of us.users.filter((x) => x.email === EMAIL2)) await admin.auth.admin.deleteUser(u.id);
});
