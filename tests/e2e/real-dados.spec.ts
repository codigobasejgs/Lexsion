import fs from "node:fs";
import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unzip } from "../../src/lib/zip";

// Dados do escritório na OPERAÇÃO REAL (Anexo III.11/12): exportação integral pelo titular (ZIP com dados, arquivo
// privado e manifesto; outro escritório não entra), advogado não exporta; Super Admin vê encerrados e a eliminação é
// recusada antes de 90 dias e sem senha. Escritórios e pessoas SINTÉTICOS, apagados no fim.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const SLOW = Number(process.env.SLOW ?? 30_000);
const tag = crypto.randomBytes(3).toString("hex");
type U = { id: string; email: string; password: string };
let admin: SupabaseClient, orgA = "", orgB = "";
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
async function login(page: Page, u: U, dest: RegExp) {
  await page.context().clearCookies();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(u.email);
  await page.getByLabel("Senha", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(dest, { timeout: SLOW });
}

test.beforeAll(async () => {
  admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  people.tit = await mkUser("dx-tit", "QA Titular Dados");
  people.adv = await mkUser("dx-adv", "QA Advogado Dados");
  people.sa = await mkUser("dx-sa", "QA Proprietário Dados");
  await admin.from("platform_members").insert({ user_id: people.sa.id, role: "superadmin" }).throwOnError();
  orgA = (await admin.from("organizations").insert({ slug: `qa-dx-a-${tag}`, name: `QA Dados A ${tag}`, status: "ativa" }).select("id").single().throwOnError()).data!.id;
  orgB = (await admin.from("organizations").insert({ slug: `qa-dx-b-${tag}`, name: `QA Dados B ${tag}`, status: "ativa" }).select("id").single().throwOnError()).data!.id;
  await admin.from("organization_memberships").insert([{ organization_id: orgA, user_id: people.tit.id, role: "admin" }, { organization_id: orgA, user_id: people.adv.id, role: "advogado" }]).throwOnError();
  await admin.from("org_records").insert([{ organization_id: orgA, collection: "clients", id: `c-${tag}`, data: { id: `c-${tag}`, organizationId: orgA, name: "Cliente Sintético A" } },
    { organization_id: orgB, collection: "clients", id: `c-b-${tag}`, data: { id: `c-b-${tag}`, organizationId: orgB, name: "Cliente de OUTRO escritório" } }]).throwOnError();
  await admin.storage.from("documentos").upload(`${orgA}/f-${tag}/procuracao.pdf`, Buffer.from("%PDF-1.4\n%QA\n"), { contentType: "application/pdf" });
});
test.afterAll(async () => {
  if (!admin) return;
  for (const o of [orgA, orgB]) {
    for (const b of ["documentos", "exportacoes"]) {
      const { data: top } = await admin.storage.from(b).list(o);
      for (const d of top ?? []) { if (d.id) await admin.storage.from(b).remove([`${o}/${d.name}`]); else { const { data: fs2 } = await admin.storage.from(b).list(`${o}/${d.name}`); if (fs2?.length) await admin.storage.from(b).remove(fs2.map((x) => `${o}/${d.name}/${x.name}`)); } }
    }
  }
  await admin.from("organizations").delete().in("id", [orgA, orgB]);
  await admin.from("data_erasures").delete().like("org_slug", `qa-dx-%-${tag}`); // trilha de escritório sintético "qa-"
  await admin.from("audit_logs").delete().in("organization_id", [orgA, orgB]);
  await admin.from("platform_members").delete().eq("user_id", people.sa?.id ?? "");
  for (const u of Object.values(people)) await admin.auth.admin.deleteUser(u.id);
});

test("DX-01: titular exporta tudo (dados + arquivo + manifesto); o ZIP não traz outro escritório; advogado não exporta", async ({ page, request }) => {
  await login(page, people.tit, /\/app\//);
  await page.goto("/app/configuracoes?aba=dados");
  await page.getByRole("button", { name: /Gerar exportação integral/ }).click();
  await expect(page.getByText(/Exportação pronta/)).toBeVisible({ timeout: 90_000 });
  const { data: job } = await admin.from("data_exports").select("id,status,storage_path,files,records").eq("organization_id", orgA).single();
  expect(job).toMatchObject({ status: "pronto", files: 1 });
  const url = await page.evaluate(async ({ o, id }) => (await (await fetch("/api/dados/exportar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: o, action: "download", id }) })).json()).data.url as string, { o: orgA, id: job!.id });
  const z = await request.get(url);
  expect(z.status()).toBe(200);
  const files = unzip(new Uint8Array(await z.body()));
  expect(Object.keys(files)).toEqual(expect.arrayContaining(["manifesto.json", "LEIA-ME.txt", "dados/escritorio.json", "dados/registros/clients.json", `arquivos/f-${tag}/procuracao.pdf`]));
  expect(files["dados/registros/clients.json"]).toContain("Cliente Sintético A");
  expect(Object.values(files).join("\n")).not.toContain("Cliente de OUTRO escritório");
  expect(JSON.parse(files["manifesto.json"]).itens.length).toBeGreaterThan(5);
  const { data: au } = await admin.from("audit_logs").select("action").eq("organization_id", orgA).like("action", "exportacao.%");
  expect(au?.map((a) => a.action)).toEqual(expect.arrayContaining(["exportacao.solicitada", "exportacao.pronta", "exportacao.baixada"]));
  // Advogado(a) do mesmo escritório e titular de outro: recusados pelo servidor.
  await login(page, people.adv, /\/app\//);
  const st = await page.evaluate(async (o) => (await fetch("/api/dados/exportar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: o, action: "create" }) })).status, orgA);
  expect(st).toBe(403);
  const st2 = await page.evaluate(async (o) => (await fetch("/api/dados/exportar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: o, action: "list" }) })).status, orgB);
  expect(st2).toBe(403);
});

test("DX-02: Super Admin vê o encerrado como 'aguardando 90 dias'; eliminação recusada antes do prazo e com senha errada; nada sai", async ({ page }) => {
  await admin.from("organizations").update({ status: "cancelada", status_reason: "QA: encerrado" }).eq("id", orgB).throwOnError();
  await login(page, people.sa, /\/admin/);
  await page.goto("/admin/dados");
  const row = page.getByTestId(`encerrado-qa-dx-b-${tag}`);
  await expect(row).toContainText("aguardando 90 dias", { timeout: SLOW });
  const early = await page.evaluate(async (o) => (await fetch("/api/admin/eliminacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org: o, confirm: "x", reason: "QA: tentativa antes do prazo", password: "x" }) })).status, orgB);
  expect(early).toBe(409);
  await admin.from("organizations").update({ closed_at: new Date(Date.now() - 91 * 86_400_000).toISOString() }).eq("id", orgB).throwOnError();
  const wrong = await page.evaluate(async ({ o, slug }) => (await fetch("/api/admin/eliminacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org: o, confirm: slug, reason: "QA: senha errada não elimina", password: "senha-errada-qa" }) })).status, { o: orgB, slug: `qa-dx-b-${tag}` });
  expect(wrong).toBe(403);
  expect((await admin.from("org_records").select("id").eq("organization_id", orgB)).data?.length).toBe(1);
  // Com a senha certa: elimina de verdade (arquivos + banco), preserva a trilha permanente.
  await page.reload();
  await page.getByTestId(`encerrado-qa-dx-b-${tag}`).getByRole("button", { name: /Ver prévia e eliminar/ }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel(/Motivo/).fill("QA: escritório sintético encerrado há 91 dias");
  await d.getByLabel(/Digite o endereço/).fill(`qa-dx-b-${tag}`);
  await d.getByLabel(/Sua senha/).fill(people.sa.password);
  await d.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await expect(d.getByText(/Eliminação concluída/)).toBeVisible({ timeout: 60_000 });
  expect((await admin.from("organizations").select("id").eq("id", orgB)).data).toEqual([]);
  expect((await admin.from("org_records").select("id").eq("organization_id", orgB)).data).toEqual([]);
  const { data: er } = await admin.from("data_erasures").select("status,org_slug").eq("organization_id", orgB).single();
  expect(er).toEqual({ status: "concluida", org_slug: `qa-dx-b-${tag}` });
  expect((await admin.from("org_records").select("id").eq("organization_id", orgA)).data?.length).toBe(1); // o outro escritório fica intacto
});
