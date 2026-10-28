import fs from "node:fs";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Teste de integração REAL contra o Supabase do projeto: usuários de Auth reais, JWT reais, RLS do Postgres real.
// Cria escritórios e usuários de QA (domínio .invalid, nome "QA …") e REMOVE tudo no final.
// Só roda com RUN_REAL=1 e credenciais em .env.local (nunca em CI público). `RUN_REAL=1 pnpm test:real`.
const env: Record<string, string> = {};
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) env[m[1]] = m[2]; }
const ON = process.env.RUN_REAL === "1" && !!env.SUPABASE_SECRET_KEY && !!env.NEXT_PUBLIC_SUPABASE_URL;
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const tag = crypto.randomBytes(3).toString("hex");
const pw = () => `Qa${crypto.randomBytes(16).toString("base64url")}7`;

let admin: SupabaseClient;
const users: Record<string, { id: string; email: string; password: string; c?: SupabaseClient }> = {};
let orgA = "", orgB = "", clientA = "", caseA = "", draftA = "";

async function mkUser(key: string) {
  const email = `qa-${key}-${tag}@lexsion-qa.invalid`;
  const password = pw();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { qa: true } });
  if (error) throw error;
  users[key] = { id: data.user.id, email, password };
}
async function login(key: string) {
  const c = createClient(URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email: users[key].email, password: users[key].password });
  if (error) throw error;
  users[key].c = c;
  return c;
}
const as = (k: string) => users[k].c!;

describe.skipIf(!ON)("Supabase REAL — RLS e funções privilegiadas", () => {
  beforeAll(async () => {
    admin = createClient(URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const k of ["plat", "adminA", "advA", "estagA", "adminB", "clienteA"]) await mkUser(k);
    // Operação de plataforma via service role (equivale ao Super Admin no servidor).
    const { error: pe } = await admin.from("platform_members").insert({ user_id: users.plat.id, role: "platform_admin" });
    if (pe) throw pe;
    for (const k of Object.keys(users)) await login(k);
    const { data: a, error: ea } = await as("plat").rpc("create_organization", { p_slug: `qa-a-${tag}`, p_name: `QA Escritório A ${tag}`, p_owner: users.adminA.id });
    if (ea) throw ea;
    const { data: b, error: eb } = await as("plat").rpc("create_organization", { p_slug: `qa-b-${tag}`, p_name: `QA Escritório B ${tag}`, p_owner: users.adminB.id });
    if (eb) throw eb;
    orgA = (a as { id: string }).id;
    orgB = (b as { id: string }).id;
    await as("adminA").from("organization_memberships").insert([{ organization_id: orgA, user_id: users.advA.id, role: "advogado" }, { organization_id: orgA, user_id: users.estagA.id, role: "estagiario" }]).throwOnError();
    clientA = (await as("adminA").from("clients").insert({ organization_id: orgA, kind: "PF", name: "QA Cliente A", document: "11144477735" }).select("id").single().throwOnError()).data!.id;
    caseA = (await as("advA").from("cases").insert({ organization_id: orgA, client_id: clientA, title: "QA Caso A", area: "Previdenciário" }).select("id").single().throwOnError()).data!.id;
    await as("adminA").from("client_portal_access").insert({ user_id: users.clienteA.id, organization_id: orgA, client_id: clientA }).throwOnError();
    draftA = (await as("estagA").from("drafts").insert({ organization_id: orgA, case_id: caseA, title: "QA Minuta", body: "Texto" }).select("id").single().throwOnError()).data!.id;
  }, 120_000);

  afterAll(async () => {
    if (!admin) return;
    if (orgA || orgB) await admin.from("organizations").delete().in("id", [orgA, orgB].filter(Boolean)); // cascata limpa dados
    await admin.from("audit_logs").delete().in("organization_id", [orgA, orgB].filter(Boolean));
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  }, 120_000);

  it("escritório B não lê nem altera dados do A", async () => {
    expect((await as("adminB").from("clients").select("id")).data).toEqual([]);
    expect((await as("adminB").from("cases").select("id")).data).toEqual([]);
    const up = await as("adminB").from("clients").update({ name: "invadido" }).eq("id", clientA).select("id");
    expect(up.data).toEqual([]);
    expect((await as("adminA").from("clients").select("name").eq("id", clientA).single()).data?.name).toBe("QA Cliente A");
  });
  it("INSERT com organization_id de outro escritório é recusado pelo banco", async () => {
    const r = await as("adminB").from("clients").insert({ organization_id: orgA, kind: "PF", name: "Intruso", document: "39053344705" });
    expect(r.error?.code).toBe("42501");
  });
  it("estagiário não aprova minuta (UPDATE direto e função)", async () => {
    const r1 = await as("estagA").from("drafts").update({ status: "aprovado" }).eq("id", draftA).select("id");
    expect(r1.error?.code ?? (r1.data?.length === 0 ? "bloqueado" : "passou")).not.toBe("passou");
    const r2 = await as("estagA").rpc("approve_draft", { p_draft: draftA, p_expected_version: 1 });
    expect(r2.error?.message).toMatch(/somente advogado/);
    const r3 = await as("advA").rpc("approve_draft", { p_draft: draftA, p_expected_version: 1 });
    expect(r3.error).toBeNull();
    expect((r3.data as { status: string }).status).toBe("aprovado");
  });
  it("cliente do portal vê só o próprio caso; nada de rascunho", async () => {
    expect((await as("clienteA").from("cases").select("id")).data?.map((r) => r.id)).toEqual([caseA]);
    await as("advA").from("portal_updates").insert({ organization_id: orgA, case_id: caseA, text: "Recebemos seus documentos.", next_step: "Aguardar" }).throwOnError();
    expect((await as("clienteA").from("portal_updates").select("id")).data).toEqual([]);
    expect((await as("clienteA").from("drafts").select("id")).data).toEqual([]);
  });
  it("auditoria registra o autor real e o B não a lê", async () => {
    const { data } = await as("adminA").from("audit_logs").select("action, actor_id").eq("entity", "drafts").eq("entity_id", draftA).order("id");
    expect(data?.map((r) => r.action)).toEqual(["insert", "update"]);
    expect(data?.[1].actor_id).toBe(users.advA.id);
    expect((await as("adminB").from("audit_logs").select("id").eq("organization_id", orgA)).data).toEqual([]);
  });
  it("Storage: grava só na pasta do próprio escritório; arquivo do A não é lido pelo B", async () => {
    const file = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: "application/pdf" });
    const ok = await as("advA").storage.from("documentos").upload(`${orgA}/qa/teste.pdf`, file, { contentType: "application/pdf" });
    expect(ok.error).toBeNull();
    const bad = await as("adminB").storage.from("documentos").upload(`${orgA}/qa/invasao.pdf`, file, { contentType: "application/pdf" });
    expect(bad.error).not.toBeNull();
    const read = await as("adminB").storage.from("documentos").download(`${orgA}/qa/teste.pdf`);
    expect(read.error).not.toBeNull();
    const svg = await as("advA").storage.from("documentos").upload(`${orgA}/qa/x.svg`, new Blob(["<svg/>"], { type: "image/svg+xml" }), { contentType: "image/svg+xml" });
    expect(svg.error).not.toBeNull();
    await admin.storage.from("documentos").remove([`${orgA}/qa/teste.pdf`]);
  });
  it("chave publicável sem login não lê nada", async () => {
    const anon = createClient(URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const r = await anon.from("clients").select("id");
    expect(r.data ?? []).toEqual([]);
  });
});
