import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Registros operacionais do ERP (org_records): isolamento, papéis, ações sensíveis, versão, portal e plataforma.
const U = {
  superadmin: "00000000-0000-0000-0000-00000000000a",
  adminA: "00000000-0000-0000-0000-0000000000a1",
  advA: "00000000-0000-0000-0000-0000000000a2",
  estagA: "00000000-0000-0000-0000-0000000000a3",
  finA: "00000000-0000-0000-0000-0000000000a4",
  extA: "00000000-0000-0000-0000-0000000000a5",
  adminB: "00000000-0000-0000-0000-0000000000b1",
  clienteA: "00000000-0000-0000-0000-0000000000c1",
  outroCliente: "00000000-0000-0000-0000-0000000000c2",
};
let db: PGlite;
let orgA = "", orgB = "";

async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}
const denied = async (user: string, sql: string, params: unknown[] = []) => {
  try { await as(user, sql, params); return "permitido"; } catch (e) { return (e as Error).message; }
};
const rec = (org: string, id: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id, organizationId: org, ...extra });
const put = (u: string, org: string, coll: string, id: string, extra: Record<string, unknown> = {}) =>
  as(u, "insert into public.org_records (organization_id, collection, id, data) values ($1,$2,$3,$4::jsonb)", [org, coll, id, rec(org, id, extra)]);
const set = (patch: object) => `update public.org_records set data = data || '${JSON.stringify(patch)}'::jsonb`;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8"));
  await db.query(`insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])`, [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.platform_members (user_id, role) values ($1, 'superadmin')", [U.superadmin]);
  orgA = (await as<{ id: string }>(U.superadmin, "select (public.create_organization('escritorio-a','Escritório A', $1)).id", [U.adminA]))[0].id;
  orgB = (await as<{ id: string }>(U.superadmin, "select (public.create_organization('escritorio-b','Escritório B', $1)).id", [U.adminB]))[0].id;
  for (const [u, r] of [[U.advA, "advogado"], [U.estagA, "estagiario"], [U.finA, "financeiro"], [U.extA, "external_collaborator"]]) await as(U.adminA, "insert into public.organization_memberships (organization_id, user_id, role) values ($1, $2, $3)", [orgA, u, r]);
}, 60_000);

describe("org_records — isolamento", () => {
  it("B não lê, não altera e não apaga registros de A; nem grava com o escritório de A", async () => {
    await put(U.advA, orgA, "leads", "lead-1", { name: "Lead A" });
    expect(await as(U.adminB, "select id from public.org_records where collection = 'leads'")).toEqual([]);
    expect(await as(U.adminB, `${set({ name: "x" })} where id = 'lead-1' returning id`)).toEqual([]);
    expect(await as(U.adminB, "delete from public.org_records where id = 'lead-1' returning id")).toEqual([]);
    expect(await denied(U.adminB, "insert into public.org_records (organization_id, collection, id, data) values ($1,'leads','lead-x',$2::jsonb)", [orgA, rec(orgA, "lead-x")])).toMatch(/row-level/);
  });
  it("o objeto não pode declarar outro escritório que a coluna", async () => {
    expect(await denied(U.advA, "insert into public.org_records (organization_id, collection, id, data) values ($1,'leads','lead-y',$2::jsonb)", [orgA, rec(orgB, "lead-y")])).toMatch(/check constraint/);
  });
  it("anônimo não lê nada", async () => {
    expect(await denied(null as unknown as string, "select id from public.org_records")).toMatch(/permission denied/);
  });
});

describe("org_records — papéis", () => {
  it("financeiro não lê leads; estagiário não lê honorários; coleção sem regra é recusada", async () => {
    expect(await as(U.finA, "select id from public.org_records where collection = 'leads'")).toEqual([]);
    await put(U.finA, orgA, "installments", "in-1", { clientId: "c-1", amount: 1000, paid: 0, status: "aberta" });
    expect((await as(U.finA, "select id from public.org_records where collection = 'installments'")).length).toBe(1);
    expect(await as(U.estagA, "select id from public.org_records where collection = 'installments'")).toEqual([]);
    expect(await denied(U.adminA, "insert into public.org_records (organization_id, collection, id, data) values ($1,'xyz','a',$2::jsonb)", [orgA, rec(orgA, "a")])).toMatch(/foreign key|row-level/);
  });
  it("caso sigiloso e correspondente externo veem só o permitido", async () => {
    await put(U.advA, orgA, "cases", "k-sig", { confidential: true, ownerId: U.advA, clientId: "c-9" });
    await put(U.advA, orgA, "cases", "k-ext", { confidential: false, ownerId: U.extA, clientId: "c-9" });
    expect((await as<{ id: string }>(U.estagA, "select id from public.org_records where collection = 'cases'")).map((r) => r.id)).toEqual(["k-ext"]);
    expect((await as<{ id: string }>(U.extA, "select id from public.org_records where collection = 'cases'")).map((r) => r.id)).toEqual(["k-ext"]);
    expect(await as(U.extA, "select id from public.org_records where collection = 'clients'")).toEqual([]);
  });
  it("estagiário não aprova minuta nem publica no portal; campo não preenchido bloqueia; advogado(a) aprova", async () => {
    await put(U.estagA, orgA, "drafts", "d-1", { status: "rascunho", body: "Texto" });
    expect(await denied(U.estagA, `${set({ status: "aprovado" })} where collection = 'drafts' and id = 'd-1'`)).toMatch(/somente advogado/);
    await put(U.estagA, orgA, "drafts", "d-2", { status: "rascunho", body: "Falta [cliente.nome — não preenchido]" });
    expect(await denied(U.advA, `${set({ status: "aprovado" })} where collection = 'drafts' and id = 'd-2'`)).toMatch(/não preenchidos/);
    expect((await as(U.advA, `${set({ status: "aprovado" })} where collection = 'drafts' and id = 'd-1' returning id`)).length).toBe(1);
    expect(await denied(U.estagA, `${set({ portalUpdates: [{ id: "pu1", text: "t", publishedAt: "2026-10-28" }] })} where collection = 'cases' and id = 'k-ext'`)).toMatch(/publica no portal/);
  });
  it("laudo/exame não é compartilhado com o cliente", async () => {
    expect(await denied(U.advA, "insert into public.org_records (organization_id, collection, id, data) values ($1,'documents','doc-l',$2::jsonb)", [orgA, rec(orgA, "doc-l", { type: "Laudo", sharedWithClient: true })])).toMatch(/saúde/);
  });
});

describe("org_records — consistência", () => {
  it("lote com versão antiga falha inteiro (nada gravado)", async () => {
    await put(U.advA, orgA, "events", "ev-1", { title: "A" });
    const upd = (exp: number, title: string) => ({ collection: "events", data: { id: "ev-1", organizationId: orgA, title }, expected: exp });
    await as(U.advA, "select public.apply_changes($1::jsonb)", [JSON.stringify([upd(1, "B")])]);
    const batch = [{ collection: "events", data: { id: "ev-2", organizationId: orgA, title: "novo" } }, upd(1, "C")];
    expect(await denied(U.advA, "select public.apply_changes($1::jsonb)", [JSON.stringify(batch)])).toMatch(/alterado por outra pessoa/);
    expect(await as(U.advA, "select id from public.org_records where id = 'ev-2'")).toEqual([]);
    expect((await as<{ t: string }>(U.advA, "select data->>'title' t from public.org_records where id = 'ev-1'"))[0].t).toBe("B");
  });
  it("auditoria automática registra o autor; escritório suspenso perde acesso", async () => {
    expect((await as(U.adminA, "select 1 from public.audit_logs where entity = 'events' and entity_id = 'ev-1' and actor_id = $1", [U.advA])).length).toBeGreaterThan(0);
    await as(U.superadmin, "select public.set_organization_status($1, 'suspensa', 'Teste de suspensão')", [orgA]);
    expect(await as(U.advA, "select id from public.org_records")).toEqual([]);
    await as(U.superadmin, "select public.set_organization_status($1, 'ativa', null)", [orgA]);
    expect((await as(U.advA, "select id from public.org_records")).length).toBeGreaterThan(0);
  });
});

describe("Portal (registros)", () => {
  it("cliente vê só campos leigos dos próprios registros, envia arquivo ao pedido e pergunta à equipe", async () => {
    await put(U.advA, orgA, "clients", "c-1", { name: "Cliente Portal" });
    await put(U.advA, orgA, "clients", "c-2", { name: "Outro" });
    await as(U.advA, "insert into public.portal_links (user_id, organization_id, client_id) values ($1,$2,'c-1'), ($3,$2,'c-2')", [U.clienteA, orgA, U.outroCliente]);
    await put(U.advA, orgA, "cases", "k-p", { clientId: "c-1", title: "Aposentadoria", ownerId: U.advA, notes: "INTERNO", portalStatus: "Em análise", portalUpdates: [{ id: "u1", text: "Rascunho interno" }] });
    await put(U.advA, orgA, "documents", "doc-p", { clientId: "c-1", name: "RG", type: "Documento pessoal", status: "solicitado", sharedWithClient: true });
    await put(U.advA, orgA, "documents", "doc-int", { clientId: "c-1", name: "Parecer", type: "Peça", status: "recebido", sharedWithClient: false });
    const s = (await as<{ s: { cases: { id: string }[]; documents: { id: string }[] } }>(U.clienteA, "select public.portal_snapshot() s"))[0].s;
    expect(s.cases.map((c) => c.id)).toEqual(["k-p"]);
    expect(JSON.stringify(s)).not.toMatch(/INTERNO|Rascunho interno|Parecer/);
    expect(s.documents.map((d) => d.id)).toEqual(["doc-p"]);
    expect(JSON.stringify((await as<{ s: unknown }>(U.outroCliente, "select public.portal_snapshot() s"))[0].s)).not.toMatch(/Aposentadoria/);
    expect(await as(U.clienteA, "select id from public.org_records")).toEqual([]); // sem leitura direta
    expect(await denied(U.outroCliente, "insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`${orgA}/doc-p/rg.pdf`])).toMatch(/row-level/);
    await as(U.clienteA, "insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`${orgA}/doc-p/rg.pdf`]);
    expect(await denied(U.outroCliente, "select public.portal_send_document('doc-p', $1, 'rg.pdf', 'application/pdf', 100)", [`${orgA}/doc-p/rg.pdf`])).toMatch(/não encontrado/);
    expect(await denied(U.clienteA, "select public.portal_send_document('doc-p', $1, 'rg.pdf', 'application/pdf', 100)", [`${orgB}/doc-p/rg.pdf`])).toMatch(/caminho/);
    await as(U.clienteA, "select public.portal_send_document('doc-p', $1, 'rg.pdf', 'application/pdf', 100)", [`${orgA}/doc-p/rg.pdf`]);
    expect((await as<{ st: string }>(U.advA, "select data->>'status' st from public.org_records where id = 'doc-p'"))[0].st).toBe("recebido");
    expect(await denied(U.clienteA, "select public.portal_send_document('doc-p', $1, 'rg.pdf', 'application/pdf', 100)", [`${orgA}/doc-p/rg.pdf`])).toMatch(/já foi atendido/);
    const t = (await as<{ t: string }>(U.clienteA, "select public.portal_ask('Quando sai a perícia?') t"))[0].t;
    expect((await as<{ a: string }>(U.advA, "select data->>'assigneeId' a from public.org_records where collection = 'tasks' and id = $1", [t]))[0].a).toBe(U.advA);
  });
  it("só advogado(a)/titular vincula cliente ao portal, e só cliente existente", async () => {
    expect(await denied(U.estagA, "insert into public.portal_links (user_id, organization_id, client_id) values ($1,$2,'c-1')", [U.outroCliente, orgA])).toMatch(/row-level/);
    expect(await denied(U.advA, "insert into public.portal_links (user_id, organization_id, client_id) values ($1,$2,'nao-existe')", [U.outroCliente, orgA])).toMatch(/row-level/);
  });
});

describe("Meu acesso", () => {
  it("mostra só os vínculos do próprio usuário, inclusive escritório suspenso", async () => {
    await as(U.superadmin, "select public.set_organization_status($1, 'suspensa', 'Teste de suspensão')", [orgA]);
    const a = (await as<{ a: { memberships: { organizationId: string; status: string }[]; platform: string | null } }>(U.advA, "select public.my_access() a"))[0].a;
    expect(a.memberships).toEqual([expect.objectContaining({ organizationId: orgA, status: "suspensa" })]);
    expect(a.platform).toBeNull();
    await as(U.superadmin, "select public.set_organization_status($1, 'ativa', null)", [orgA]);
    const c = (await as<{ a: { memberships: unknown[]; portal: { clientId: string }[] } }>(U.clienteA, "select public.my_access() a"))[0].a;
    expect(c.memberships).toEqual([]);
    expect(c.portal.map((p) => p.clientId)).toEqual(["c-1"]);
    expect((await as<{ a: { platform: string } }>(U.superadmin, "select public.my_access() a"))[0].a.platform).toBe("superadmin");
  });
});

describe("Equipe e plataforma", () => {
  it("equipe com nome e e-mail só para membros; plataforma não lê registros dos escritórios", async () => {
    expect((await as(U.advA, "select * from public.org_team($1)", [orgA])).length).toBeGreaterThan(3);
    expect(await as(U.adminB, "select * from public.org_team($1)", [orgA])).toEqual([]);
    expect(await as(U.superadmin, "select id from public.org_records")).toEqual([]);
    expect(await denied(U.adminA, "insert into public.platform_records (collection, id, data) values ('supportTickets','t1','{}')")).toMatch(/row-level/);
    expect(await denied(U.adminA, "select public.platform_set_org_meta($1, '{}')", [orgA])).toMatch(/somente a plataforma/);
    await as(U.superadmin, "insert into public.platform_records (collection, id, data) values ('supportTickets','t1','{}')");
    expect(await as(U.adminA, "select id from public.platform_records")).toEqual([]);
  });
});

describe("PWA white-label (marca pública)", () => {
  it("anônimo lê só a marca de escritório ativo; nada além de nome, cores e ícone; suspenso some", async () => {
    await as(U.adminA, "update public.organizations set branding = $2::jsonb where id = $1", [orgA, JSON.stringify({ brandName: "Marca A", pwaShortName: "MarcaA", primary: "#112233", backgroundDark: "#000000", brandingVersion: 3, hasPublicIcon: true })]);
    const b = (await as<{ b: Record<string, unknown> }>(null, "select public.public_brand('escritorio-a') b"))[0].b;
    expect(b).toMatchObject({ brandName: "Marca A", primary: "#112233", hasIcon: true, iconVersion: 3 });
    expect(Object.keys(b).sort()).toEqual(["backgroundDark", "backgroundLight", "brandName", "hasIcon", "iconVersion", "name", "primary", "pwaShortName", "slug", "themeMode"]);
    await as(U.superadmin, "select public.set_organization_status($1, 'suspensa', 'Teste de suspensão')", [orgA]);
    expect((await as<{ b: unknown }>(null, "select public.public_brand('escritorio-a') b"))[0].b).toBeNull();
    await as(U.superadmin, "select public.set_organization_status($1, 'ativa', null)", [orgA]);
  });
  it("ícone: titular grava na pasta do próprio escritório; advogado(a) e outro escritório não", async () => {
    await as(U.adminA, "insert into storage.objects (bucket_id, name) values ('marcas', 'slug-escritorio-a/icon-512.png')");
    expect(await denied(U.advA, "insert into storage.objects (bucket_id, name) values ('marcas', 'slug-escritorio-a/icon-192.png')")).toMatch(/row-level/);
    expect(await denied(U.adminB, "insert into storage.objects (bucket_id, name) values ('marcas', 'slug-escritorio-a/x.png')")).toMatch(/row-level/);
    expect(await denied(U.adminA, "insert into storage.objects (bucket_id, name) values ('marcas', 'slug-escritorio-b/x.png')")).toMatch(/row-level/);
  });
});
