import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Fontes oficiais (BCB, STJ): globais, leitura para qualquer usuário autenticado; gravação só pelo servidor.
const U = { superadmin: "00000000-0000-0000-0000-00000000000a", adminA: "00000000-0000-0000-0000-0000000000a1" };
let db: PGlite;
async function as<T = Record<string, unknown>>(user: string | null, sql: string): Promise<T[]> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user ?? "", aal: "aal2" })]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try { return (await db.query<T>(sql)).rows; } finally { await db.exec("reset role"); }
}
const denied = async (user: string | null, sql: string) => { try { await as(user, sql); return "permitido"; } catch (e) { return (e as Error).message; } };

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
  await db.query(`insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])`, [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.official_series (series, month, value, source_url) values ('inpc','2026-09',0.5,'https://api.bcb.gov.br/x')");
  await db.query("insert into public.legal_precedents (id, kind, number, question, thesis, official_url, source_dataset, content_hash) values ('stj-tema-1','Tema','1','Aposentadoria especial por ruído','Tese sintética de teste','https://processo.stj.jus.br/x','teste','h')");
}, 60_000);

describe("fontes oficiais — RLS", () => {
  it("usuário autenticado lê; anônimo não", async () => {
    expect((await as(U.adminA, "select month from public.official_series")).length).toBe(1);
    expect((await as(U.adminA, "select id from public.legal_precedents")).length).toBe(1);
    expect(await denied(null, "select 1 from public.official_series")).toMatch(/permission denied/);
    expect(await denied(null, "select 1 from public.legal_precedents")).toMatch(/permission denied/);
  });
  it("ninguém grava pelo navegador (nem a plataforma)", async () => {
    expect(await denied(U.adminA, "insert into public.official_series (series, month, value, source_url) values ('inpc','2026-10',9,'https://x')")).toMatch(/permission denied/);
    expect(await denied(U.superadmin, "update public.legal_precedents set thesis = 'falsa'")).toMatch(/permission denied/);
    expect(await denied(U.adminA, "delete from public.official_series")).toMatch(/permission denied/);
  });
  it("busca textual em português nos precedentes", async () => {
    expect((await as(U.adminA, "select id from public.legal_precedents where search @@ websearch_to_tsquery('portuguese','aposentadorias ruído')")).length).toBe(1);
  });
  it("série fora da lista e URL não https são recusadas", async () => {
    await expect(db.query("insert into public.official_series (series, month, value, source_url) values ('xpto','2026-01',1,'https://x')")).rejects.toThrow();
    await expect(db.query("insert into public.legal_precedents (id, kind, number, official_url, source_dataset, content_hash) values ('x','Tema','2','http://x','t','h')")).rejects.toThrow();
  });
  it("gatilho do agendador não é chamável por usuários; agendamento criado", async () => {
    expect(await denied(U.superadmin, "select public.trigger_official_sync()")).toMatch(/permission denied/);
    expect((await db.query("select 1 from cron.job where jobname = 'lexsion-fontes-oficiais'")).rows.length).toBe(1);
    expect((await db.query("select 1 from public.legal_source_providers where id in ('bcb-sgs','stj-precedentes')")).rows.length).toBe(2);
  });
});
