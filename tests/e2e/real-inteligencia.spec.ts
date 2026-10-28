import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Monitoramento jurídico REAL: dados da API pública da Câmara já coletados pelo agendador.
// Prova: repetir a coleta não duplica documento, versão, atualização nem alerta; o escritório com preferência
// recebe alerta e notificação; outro escritório não vê os alertas; Jornal mostra fonte, datas e link oficial.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY;
const SLOW = Number(process.env.SLOW ?? 30_000);
const tag = crypto.randomBytes(3).toString("hex");
type U = { id: string; email: string; password: string };
let admin: SupabaseClient;
const orgs: string[] = [];
const people: Record<string, U> = {};

test.describe.configure({ mode: "serial", timeout: 600_000 });
test.skip(!ON, "Supabase não configurado neste ambiente");
// A coleta roda no SERVIDOR: só tem sentido contra a produção (a rede local não alcança a Câmara diretamente).
test.skip(({ baseURL }) => !String(baseURL).startsWith("https://"), "teste de produção (coleta no servidor)");

async function mkUser(key: string): Promise<U> {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`, password = `Qa${crypto.randomBytes(12).toString("base64url")}7x`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { id: data.user.id, email, password };
}
async function login(page: Page, u: U, dest = /\/app\/inicio/) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(dest, { timeout: SLOW });
}
const count = async (t: string) => (await admin.from(t).select("*", { count: "exact", head: true })).count ?? 0;

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  people.a = await mkUser("intela");
  people.b = await mkUser("intelb");
  people.sa = await mkUser("intelsa");
  await admin.from("platform_members").insert({ user_id: people.sa.id, role: "platform_admin" }).throwOnError();
  for (const [k, u] of [["a", people.a], ["b", people.b]] as const) {
    const { data } = await admin.from("organizations").insert({ slug: `qa-intel-${k}-${tag}`, name: `QA Intel ${k} ${tag}` }).select("id").single().throwOnError();
    orgs.push(data!.id);
    await admin.from("organization_memberships").insert({ organization_id: data!.id, user_id: u.id, role: "admin" }).throwOnError();
  }
});

test.afterAll(async () => {
  if (!admin) return;
  await admin.from("organizations").delete().in("id", orgs);
  await admin.from("audit_logs").delete().in("organization_id", orgs);
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("INTEL-01: preferências pela tela; nova coleta não duplica; alerta e notificação só no escritório interessado", async ({ page }) => {
  const docs0 = await count("legal_documents"), vers0 = await count("legal_document_versions"), ups0 = await count("legal_updates");
  expect(docs0).toBeGreaterThan(0); // coleta real anterior pelo agendador
  // Área com itens reais coletados (escolhe a área mais frequente para o teste ser determinístico).
  const { data: sample } = await admin.from("legal_updates").select("areas").limit(500);
  const freq = new Map<string, number>();
  for (const r of sample ?? []) for (const a of r.areas as string[]) freq.set(a, (freq.get(a) ?? 0) + 1);
  const area = [...freq.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  test.skip(!area, "coleta sem área classificada ainda");

  await login(page, people.a);
  await page.goto("/app/jornal/alertas");
  await page.getByRole("checkbox", { name: area!, exact: true }).check();
  await page.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(page.getByText(/Salvo\./)).toBeVisible({ timeout: SLOW });

  // Os itens já coletados viram alerta na próxima execução que os detectar; para provar o caminho completo
  // sem esperar 3 h, a execução manual do Super Admin (mesmo motor, auditada) roda agora.
  const ctx = await page.context().browser()!.newContext();
  const p2 = await ctx.newPage();
  await login(p2, people.sa, /\/admin/);
  const r1 = await p2.evaluate(async () => (await fetch("/api/admin/inteligencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "camara-proposicoes", maxItems: 150 }) })).json());
  expect(r1.ok).toBe(true);
  expect(["ok", "parcial"]).toContain(r1.data.status);
  const docs1 = await count("legal_documents"), vers1 = await count("legal_document_versions"), ups1 = await count("legal_updates");
  // Repetição: só entram documentos realmente novos ou alterados na fonte (mesmo número de versões e atualizações criadas).
  expect(docs1 - docs0).toBe(r1.data.novo);
  expect(vers1 - vers0).toBe(r1.data.novo + r1.data.changed);
  expect(ups1 - ups0).toBe(r1.data.novo + r1.data.changed);
  const r2 = await p2.evaluate(async () => (await fetch("/api/admin/inteligencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "camara-proposicoes", maxItems: 150 }) })).json());
  expect(await count("legal_documents")).toBe(docs1 + r2.data.novo);
  await ctx.close();

  // Alertas: o escritório A (área escolhida) só tem alerta de atualização com essa área; B não tem nenhum.
  const { data: alA } = await admin.from("tenant_alerts").select("update_id,reason,legal_updates(areas)").eq("organization_id", orgs[0]);
  const { data: alB } = await admin.from("tenant_alerts").select("update_id").eq("organization_id", orgs[1]);
  expect(alB ?? []).toEqual([]);
  expect((alA ?? []).length).toBeGreaterThan(0); // alerta REAL criado (não passa vazio)
  expect(r1.data.alerts + r2.data.alerts).toBe((alA ?? []).length); // a 2ª execução não recria alertas
  expect(r2.data.alerts).toBe(0);
  for (const a of alA ?? []) expect(((a as unknown as { legal_updates: { areas: string[] } }).legal_updates.areas)).toContain(area);
  const uniq = new Set((alA ?? []).map((a) => a.update_id));
  expect(uniq.size).toBe((alA ?? []).length); // sem alerta duplicado
  const { count: notif } = await admin.from("org_records").select("id", { count: "exact", head: true }).eq("organization_id", orgs[0]).eq("collection", "notifications").like("id", "intel-%");
  expect(notif).toBe((alA ?? []).length);

  // Jornal: item real com fonte, rótulo de tramitação e link oficial.
  await page.goto("/app/jornal");
  await expect(page.getByText(/Coleta automática de fontes oficiais/)).toBeVisible({ timeout: SLOW });
  await page.locator('main li a[href^="/app/jornal/"]').first().click();
  await expect(page.getByRole("link", { name: "Ler na fonte oficial" })).toHaveAttribute("href", /^https:\/\/www\.camara\.leg\.br\//);
  await expect(page.getByText(/Histórico de versões/)).toBeVisible();
});

test("INTEL-02: escritório B não lê alertas nem preferências de A; ninguém grava documento jurídico pelo navegador", async () => {
  const b = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await b.auth.signInWithPassword({ email: people.b.email, password: people.b.password });
  expect((await b.from("tenant_alerts").select("id").eq("organization_id", orgs[0])).data ?? []).toEqual([]);
  expect((await b.from("tenant_legal_preferences").select("organization_id").eq("organization_id", orgs[0])).data ?? []).toEqual([]);
  const ins = await b.from("legal_documents").insert({ provider_id: "camara-proposicoes", external_id: "falso", doc_kind: "proposicao", type_code: "PL", number: "0/0", title: "Falso", organ: "X", official_url: "https://x", content_hash: "x" });
  expect(ins.error?.message ?? "").toMatch(/permission denied/);
  expect((await b.from("source_sync_runs").select("id").limit(1)).data ?? []).toEqual([]); // execuções: só plataforma
  // Rota do cron sem segredo é recusada.
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL ? "https://lexsion.com.br" : ""}/api/cron/inteligencia`).catch(() => null);
  if (r) expect(r.status).toBe(401);
});
