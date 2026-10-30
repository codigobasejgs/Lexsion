import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Governança REAL do escritório: o titular personaliza permissões pela tela e o BANCO passa a negar/permitir.
// Escritório e pessoas sintéticos (qa-…@lexsion-qa.invalid), apagados no final.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const SLOW = Number(process.env.SLOW ?? 30_000);
const tag = crypto.randomBytes(3).toString("hex");
type U = { id: string; email: string; password: string };
let admin: SupabaseClient;
let org = "";
const people: Record<string, U> = {};

test.describe.configure({ mode: "serial", timeout: 6 * SLOW + 60_000 });
test.skip(!ON, "Supabase não configurado neste ambiente");

async function mkUser(key: string, name: string): Promise<U> {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").upsert({ user_id: data.user.id, full_name: name }).throwOnError();
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U) {
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app\/inicio/, { timeout: SLOW });
}
const client = async (u: U) => { const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email: u.email, password: u.password }); return c; };

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  people.tit = await mkUser("gtit", "QA Titular Governança");
  people.est = await mkUser("gest", "QA Estagiária Governança");
  people.adv = await mkUser("gadv", "QA Advogado Governança");
  org = (await admin.from("organizations").insert({ slug: `qa-gov-${tag}`, name: `QA Governança ${tag}` }).select("id").single().throwOnError()).data!.id;
  await admin.from("organization_memberships").insert([{ organization_id: org, user_id: people.tit.id, role: "admin" }, { organization_id: org, user_id: people.est.id, role: "estagiario" }, { organization_id: org, user_id: people.adv.id, role: "advogado" }]).throwOnError();
  await admin.from("org_records").insert({ organization_id: org, collection: "clients", id: `c-gov-${tag}`, data: { id: `c-gov-${tag}`, organizationId: org, kind: "PF", name: "Cliente QA Governança", document: "52998224725", status: "ativo" } }).throwOnError();
});
test.afterAll(async () => {
  if (!admin) return;
  await admin.from("organizations").delete().eq("id", org);
  await admin.from("audit_logs").delete().eq("organization_id", org);
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("GOV-01: titular retira 'Ver clientes' do estagiário pela tela → banco nega; devolve → banco permite; auditado", async ({ page }) => {
  const est = await client(people.est);
  const seeClients = async () => ((await est.from("org_records").select("id").eq("organization_id", org).eq("collection", "clients")).data ?? []).length;
  expect(await seeClients()).toBe(1);
  await login(page, people.tit);
  await page.goto("/app/equipe");
  await page.getByTestId("gov-perfil").selectOption("estagiario");
  const box = page.getByRole("checkbox", { name: "Ver Clientes — Estagiário(a)/colaborador(a)" });
  await expect(box).toBeChecked({ timeout: SLOW });
  await box.click(); // a caixa só muda depois que o banco confirma (não é otimista)
  await expect(box).not.toBeChecked({ timeout: SLOW });
  await expect(page.getByText(/Permissão de .* em Clientes atualizada/)).toBeVisible({ timeout: SLOW });
  await expect.poll(seeClients, { timeout: SLOW }).toBe(0); // negado no BANCO, mesmo pela API direta
  await page.reload();
  await page.getByTestId("gov-perfil").selectOption("estagiario");
  await expect(page.getByRole("checkbox", { name: "Ver Clientes — Estagiário(a)/colaborador(a)" })).not.toBeChecked({ timeout: SLOW }); // persistiu
  await page.getByRole("checkbox", { name: "Ver Clientes — Estagiário(a)/colaborador(a)" }).click();
  await expect(page.getByRole("checkbox", { name: "Ver Clientes — Estagiário(a)/colaborador(a)" })).toBeChecked({ timeout: SLOW });
  await expect.poll(seeClients, { timeout: SLOW }).toBe(1);
  const { data: au } = await admin.from("audit_logs").select("action,actor_id").eq("organization_id", org).like("action", "permissao.%");
  expect(au?.length).toBeGreaterThanOrEqual(2);
  expect(au?.every((a) => a.actor_id === people.tit.id)).toBe(true);
});

test("GOV-02: revogação individual com motivo — só aquela pessoa perde a edição; 'o que pode' reflete; estagiário não abre a governança", async ({ page }) => {
  await login(page, people.tit);
  await page.goto("/app/equipe");
  await page.getByTestId("gov-pessoa").selectOption({ label: "QA Advogado Governança (Advogado(a))" });
  await page.getByTestId("gov-modulo").selectOption("tasks");
  await page.getByLabel("Motivo (auditado)").fill("Afastamento (teste QA)");
  await page.getByRole("button", { name: "Revogar" }).click();
  await expect(page.getByText(/Acesso revogado agora/)).toBeVisible({ timeout: SLOW });
  const adv = await client(people.adv);
  const ins = await adv.from("org_records").insert({ organization_id: org, collection: "tasks", id: `t-${tag}`, data: { id: `t-${tag}`, organizationId: org, title: "x" } });
  expect(ins.error?.message ?? "").toMatch(/row-level security/);
  await page.getByTestId("gov-ver").selectOption({ label: "QA Advogado Governança" });
  await expect(page.getByLabel("Acesso efetivo, conferido no banco").getByText("Tarefas · vê")).toBeVisible({ timeout: SLOW });
  await page.getByRole("button", { name: "Devolver" }).click();
  await expect.poll(async () => (await admin.from("org_member_restrictions").select("user_id").eq("organization_id", org)).data?.length ?? 0, { timeout: SLOW }).toBe(0);
  // Estagiário não gere equipe: o painel não aparece e o banco recusa a gravação direta.
  await login(page, people.est);
  await page.goto("/app/equipe");
  await expect(page.getByTestId("gov-matriz")).toHaveCount(0);
  const est = await client(people.est);
  expect((await est.from("org_role_restrictions").insert({ organization_id: org, role: "advogado", collection: "cases", deny_read: true })).error?.message ?? "").toMatch(/row-level security/);
});
