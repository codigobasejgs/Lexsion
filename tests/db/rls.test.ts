import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Testes de banco REAIS (Postgres 18 via PGlite): aplicam as migrations de supabase/migrations e verificam RLS,
// funções privilegiadas e isolamento entre escritórios. O stub só cria o que o Supabase já fornece (auth/storage/papéis).
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
let orgA = "", orgB = "", clientA = "", clientA2 = "", caseA = "", caseA2 = "", draftA = "";

/** Executa como `authenticated` com o sub do JWT = user (igual ao PostgREST do Supabase). */
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
  clientA = (await as<{ id: string }>(U.adminA, "insert into public.clients (organization_id, kind, name, document) values ($1,'PF','Cliente Teste A','11144477735') returning id", [orgA]))[0].id;
  clientA2 = (await as<{ id: string }>(U.adminA, "insert into public.clients (organization_id, kind, name, document) values ($1,'PF','Outro Cliente A','52998224725') returning id", [orgA]))[0].id;
  caseA = (await as<{ id: string }>(U.advA, "insert into public.cases (organization_id, client_id, title, area) values ($1,$2,'Caso do Cliente A','Previdenciário') returning id", [orgA, clientA]))[0].id;
  caseA2 = (await as<{ id: string }>(U.advA, "insert into public.cases (organization_id, client_id, title, area) values ($1,$2,'Caso de outro cliente','Família') returning id", [orgA, clientA2]))[0].id;
  await as(U.adminA, "insert into public.client_portal_access (user_id, organization_id, client_id) values ($1,$2,$3), ($4,$2,$5)", [U.clienteA, orgA, clientA, U.outroCliente, clientA2]);
  draftA = (await as<{ id: string }>(U.estagA, "insert into public.drafts (organization_id, case_id, title, body) values ($1,$2,'Minuta','Texto completo') returning id", [orgA, caseA]))[0].id;
}, 60_000);

describe("RLS — isolamento entre escritórios", () => {
  it("escritório B não lê, não altera e não apaga dados do A (SELECT/UPDATE/DELETE)", async () => {
    expect(await as(U.adminB, "select id from public.clients")).toEqual([]);
    expect(await as(U.adminB, "select id from public.cases")).toEqual([]);
    expect(await as(U.adminB, "update public.clients set name = 'invadido' where id = $1 returning id", [clientA])).toEqual([]);
    expect(await as(U.adminB, "delete from public.cases where id = $1 returning id", [caseA])).toEqual([]);
    expect((await as<{ name: string }>(U.adminA, "select name from public.clients where id = $1", [clientA]))[0].name).toBe("Cliente Teste A");
  });
  it("INSERT com organization_id de outro escritório é recusado (não confia no id enviado)", async () => {
    expect(await denied(U.adminB, "insert into public.clients (organization_id, kind, name, document) values ($1,'PF','Intruso','39053344705')", [orgA])).toMatch(/row-level security/);
  });
  it("caso não pode apontar para cliente de outro escritório", async () => {
    const clientB = (await as<{ id: string }>(U.adminB, "insert into public.clients (organization_id, kind, name, document) values ($1,'PF','Cliente B','39053344705') returning id", [orgB]))[0].id;
    expect(await denied(U.advA, "insert into public.cases (organization_id, client_id, title, area) values ($1,$2,'Mistura','Cível')", [orgA, clientB])).toMatch(/outro escritório/);
  });
  it("anônimo não lê nada", async () => {
    expect(await denied(U.adminA.replace(/./g, "0"), "select 1")).toBe("permitido"); // sanity
    const r = await as(null, "select count(*)::int as n from public.clients").catch((e: Error) => e.message);
    expect(String(JSON.stringify(r))).toMatch(/permission denied|"n":0/);
  });
});

describe("RLS — papéis dentro do escritório", () => {
  it("correspondente externo não vê clientes do escritório", async () => {
    expect(await as(U.extA, "select id from public.clients")).toEqual([]);
  });
  it("financeiro lê clientes mas não cadastra", async () => {
    expect((await as(U.finA, "select id from public.clients")).length).toBe(2);
    expect(await denied(U.finA, "insert into public.clients (organization_id, kind, name, document) values ($1,'PF','X','86288366757')", [orgA])).toMatch(/row-level security/);
  });
  it("estagiário escreve minuta mas não aprova, nem por UPDATE direto nem pela função", async () => {
    expect(await denied(U.estagA, "update public.drafts set status = 'aprovado' where id = $1", [draftA])).toMatch(/row-level security/);
    expect(await denied(U.estagA, "select public.approve_draft($1, 1)", [draftA])).toMatch(/somente advogado/);
  });
  it("aprovação exige versão atual (conflito simultâneo) e bloqueia campo não preenchido", async () => {
    expect(await denied(U.advA, "select public.approve_draft($1, 99)", [draftA])).toMatch(/alterada por outra pessoa/);
    const pend = (await as<{ id: string }>(U.advA, "insert into public.drafts (organization_id, title, body) values ($1,'Com lacuna','[cliente.nis — não preenchido]') returning id", [orgA]))[0].id;
    expect(await denied(U.advA, "select public.approve_draft($1, 1)", [pend])).toMatch(/não preenchidos/);
    const ok = await as<{ status: string; approved_by: string }>(U.advA, "select (d).status, (d).approved_by from (select public.approve_draft($1, 1) as d) s", [draftA]);
    expect(ok[0]).toEqual({ status: "aprovado", approved_by: U.advA });
  });
  it("auditoria registra quem fez e não pode ser apagada", async () => {
    const rows = await as<{ action: string; actor_id: string }>(U.adminA, "select action, actor_id from public.audit_logs where entity = 'drafts' and entity_id = $1 order by id", [draftA]);
    expect(rows.map((r) => r.action)).toEqual(["insert", "update"]);
    expect(rows[1].actor_id).toBe(U.advA);
    expect(await denied(U.adminA, "delete from public.audit_logs")).toMatch(/permission denied/);
    expect(await as(U.adminB, "select id from public.audit_logs where organization_id = $1", [orgA])).toEqual([]);
  });
});

describe("Portal do cliente", () => {
  it("cliente vê só o próprio caso e só atualização PUBLICADA", async () => {
    const up = (await as<{ id: string }>(U.estagA, "insert into public.portal_updates (organization_id, case_id, text, next_step) values ($1,$2,'Recebemos seus documentos e estamos conferindo.','Aguardar contato') returning id", [orgA, caseA]))[0].id;
    expect((await as(U.clienteA, "select id from public.cases")).map((r) => r.id)).toEqual([caseA]);
    expect(await as(U.clienteA, "select id from public.portal_updates")).toEqual([]);
    expect(await denied(U.estagA, "select public.publish_portal_update($1)", [up])).toMatch(/somente advogado/);
    await as(U.advA, "select public.publish_portal_update($1)", [up]);
    await as(U.advA, "select public.publish_portal_update($1)", [up]); // idempotente
    expect((await as(U.clienteA, "select id from public.portal_updates")).length).toBe(1);
    expect(await as(U.outroCliente, "select id from public.portal_updates")).toEqual([]);
    expect((await as(U.outroCliente, "select id from public.cases")).map((r) => r.id)).toEqual([caseA2]);
  });
  it("cliente não cria atualização nem lê documento não compartilhado", async () => {
    expect(await denied(U.clienteA, "insert into public.portal_updates (organization_id, case_id, text, next_step) values ($1,$2,'Tentativa do cliente','x')", [orgA, caseA])).toMatch(/row-level security/);
    await as(U.advA, "insert into public.documents (organization_id, client_id, case_id, name, doc_type, shared_with_client) values ($1,$2,$3,'Parecer interno','Peça',false), ($1,$2,$3,'Comprovante','Comprovante',true)", [orgA, clientA, caseA]);
    expect((await as<{ name: string }>(U.clienteA, "select name from public.documents")).map((r) => r.name)).toEqual(["Comprovante"]);
  });
});

describe("Storage privado", () => {
  it("bucket documentos é privado, com limite e tipos permitidos", async () => {
    const b = (await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documentos'")).rows[0];
    expect(b.public).toBe(false);
    expect(Number(b.file_size_limit)).toBe(15728640);
    expect(b.allowed_mime_types).not.toContain("image/svg+xml");
  });
  it("arquivo só pode ser gravado na pasta do próprio escritório", async () => {
    await as(U.advA, "insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`${orgA}/doc1/cnis.pdf`]);
    expect(await denied(U.adminB, "insert into storage.objects (bucket_id, name) values ('documentos', $1)", [`${orgA}/x/invasao.pdf`])).toMatch(/row-level security/);
    expect(await as(U.adminB, "select name from storage.objects")).toEqual([]);
    expect(await as(U.clienteA, "select name from storage.objects")).toEqual([]); // não compartilhado
  });
});

describe("Exclusões (dados e LGPD)", () => {
  it("apagar escritório remove os dados dele em cascata e mantém o histórico de auditoria", async () => {
    const org = (await as<{ id: string }>(U.superadmin, "select (public.create_organization('escritorio-x','Escritório X', $1)).id", [U.adminB]))[0].id;
    const cli = (await as<{ id: string }>(U.adminB, "insert into public.clients (organization_id, kind, name, document) values ($1,'PF','Cliente X','86288366757') returning id", [org]))[0].id;
    await as(U.adminB, "insert into public.cases (organization_id, client_id, title, area) values ($1,$2,'Caso X','Cível')", [org, cli]);
    await db.query("delete from public.organizations where id = $1", [org]);
    expect((await db.query("select 1 from public.clients where organization_id = $1", [org])).rows).toEqual([]);
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.audit_logs where organization_id = $1", [org])).rows[0].n).toBeGreaterThan(0);
  });
  it("apagar usuário mantém os registros e zera a autoria", async () => {
    await db.query("insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1','temp@teste.invalid')");
    await as(U.adminA, "insert into public.organization_memberships (organization_id, user_id, role) values ($1,'00000000-0000-0000-0000-0000000000d1','advogado')", [orgA]);
    const k = (await as<{ id: string }>("00000000-0000-0000-0000-0000000000d1", "insert into public.cases (organization_id, client_id, title, area, owner_id) values ($1,$2,'Caso do temporário','Cível','00000000-0000-0000-0000-0000000000d1') returning id", [orgA, clientA]))[0].id;
    await db.query("delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1'");
    expect((await db.query<{ owner_id: string | null }>("select owner_id from public.cases where id = $1", [k])).rows[0].owner_id).toBeNull();
  });
});

describe("Situação do escritório", () => {
  it("titular não altera o próprio status/plano; só nome e marca", async () => {
    expect(await denied(U.adminA, "update public.organizations set status = 'ativa', plan = 'enterprise' where id = $1", [orgA])).toMatch(/permission denied/);
    expect((await as(U.adminA, "update public.organizations set name = 'Escritório A Renomeado' where id = $1 returning id", [orgA])).length).toBe(1);
  });
  it("suspensão exige motivo, corta equipe e portal, e reativação devolve o acesso com os dados intactos", async () => {
    expect(await denied(U.superadmin, "select public.set_organization_status($1, 'suspensa', '')", [orgA])).toMatch(/motivo/);
    expect(await denied(U.adminA, "select public.set_organization_status($1, 'ativa', 'x')", [orgA])).toMatch(/somente a plataforma/);
    await as(U.superadmin, "select public.set_organization_status($1, 'suspensa', 'Inadimplência de teste')", [orgA]);
    expect(await as(U.advA, "select id from public.cases")).toEqual([]);
    expect(await as(U.clienteA, "select id from public.cases")).toEqual([]);
    await as(U.superadmin, "select public.set_organization_status($1, 'ativa', null)", [orgA]);
    expect((await as(U.advA, "select id from public.cases")).length).toBeGreaterThan(0);
  });
});

describe("Plataforma", () => {
  it("só a plataforma cria escritório; endereço reservado é recusado", async () => {
    expect(await denied(U.adminA, "select public.create_organization('novo-x','Novo', $1)", [U.adminA])).toMatch(/somente a plataforma/);
    expect(await denied(U.superadmin, "select public.create_organization('admin','X', $1)", [U.adminA])).toMatch(/reservado/);
  });
  it("titular do escritório não vira membro da plataforma", async () => {
    expect(await as(U.adminA, "select user_id from public.platform_members")).toEqual([]);
  });
});
