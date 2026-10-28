import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// LexSion Intelligence: fontes públicas são globais (só leitura); preferências e alertas são por escritório (RLS).
const U = { superadmin: "00000000-0000-0000-0000-00000000000a", adminA: "00000000-0000-0000-0000-0000000000a1", advA: "00000000-0000-0000-0000-0000000000a2", finA: "00000000-0000-0000-0000-0000000000a4", adminB: "00000000-0000-0000-0000-0000000000b1" };
let db: PGlite;
let orgA = "", orgB = "";
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
}
const denied = async (user: string | null, sql: string, params: unknown[] = []) => { try { await as(user, sql, params); return "permitido"; } catch (e) { return (e as Error).message; } };

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
  await db.query(`insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])`, [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.platform_members (user_id, role) values ($1, 'superadmin')", [U.superadmin]);
  orgA = (await as<{ id: string }>(U.superadmin, "select (public.create_organization('esc-a','Escritório A', $1)).id", [U.adminA]))[0].id;
  orgB = (await as<{ id: string }>(U.superadmin, "select (public.create_organization('esc-b','Escritório B', $1)).id", [U.adminB]))[0].id;
  await as(U.adminA, "insert into public.organization_memberships values ($1,$2,'advogado'), ($1,$3,'financeiro')", [orgA, U.advA, U.finA]);
  const d = (await db.query<{ id: string }>("insert into public.legal_documents (provider_id, external_id, doc_kind, type_code, number, title, ementa, organ, official_url, content_hash, areas) values ('camara-proposicoes','1','proposicao','PL','1/2026','PL 1/2026','Altera a Lei 8.213 sobre aposentadoria','Câmara','https://dadosabertos.camara.leg.br/api/v2/proposicoes/1','h1','{Previdenciário}') returning id")).rows[0].id;
  const v = (await db.query<{ id: string }>("insert into public.legal_document_versions (document_id, version, content_hash) values ($1,1,'h1') returning id", [d])).rows[0].id;
  const u = (await db.query<{ id: string }>("insert into public.legal_updates (document_id, version_id, update_type, areas) values ($1,$2,'novo','{Previdenciário}') returning id", [d, v])).rows[0].id;
  await db.query("insert into public.tenant_alerts (organization_id, update_id, reason) values ($1,$2,'área Previdenciário')", [orgA, u]);
}, 60_000);

describe("Inteligência jurídica — RLS", () => {
  it("fonte pública: qualquer membro lê; ninguém grava pelo navegador; anônimo não lê", async () => {
    expect((await as(U.adminB, "select id from public.legal_documents")).length).toBe(1);
    expect(await denied(U.adminA, "insert into public.legal_documents (provider_id, external_id, doc_kind, type_code, number, title, organ, official_url, content_hash) values ('camara-proposicoes','x','proposicao','PL','x','x','x','https://x','x')")).toMatch(/permission denied/);
    expect(await denied(U.adminA, "update public.legal_documents set title = 'falso'")).toMatch(/permission denied/);
    expect(await denied(null, "select id from public.legal_documents")).toMatch(/permission denied/);
  });
  it("busca em português na ementa funciona", async () => {
    expect((await as(U.advA, "select id from public.legal_documents where search @@ plainto_tsquery('portuguese', 'aposentadorias')")).length).toBe(1);
  });
  it("alertas e preferências isolados por escritório; financeiro não altera preferências", async () => {
    expect((await as(U.advA, "select id from public.tenant_alerts")).length).toBe(1);
    expect(await as(U.adminB, "select id from public.tenant_alerts")).toEqual([]);
    await as(U.advA, "insert into public.tenant_legal_preferences (organization_id, areas, keywords) values ($1, '{Previdenciário}', '{BPC}')", [orgA]);
    expect(await as(U.adminB, "select organization_id from public.tenant_legal_preferences")).toEqual([]);
    expect(await as(U.finA, "update public.tenant_legal_preferences set areas = '{Penal}' where organization_id = $1 returning 1", [orgA])).toEqual([]);
    expect((await as<{ a: string[] }>(U.adminA, "select areas a from public.tenant_legal_preferences"))[0].a).toEqual(["Previdenciário"]);
    expect(await denied(U.adminB, "insert into public.tenant_legal_preferences (organization_id) values ($1)", [orgA])).toMatch(/row-level/);
  });
  it("execuções e cursores só para a plataforma; trava de execução não é chamável pelo navegador", async () => {
    await db.query("insert into public.source_sync_runs (provider_id, trigger, status) values ('camara-proposicoes','teste','ok')");
    expect(await as(U.adminA, "select id from public.source_sync_runs")).toEqual([]);
    expect((await as(U.superadmin, "select id from public.source_sync_runs")).length).toBe(1);
    expect(await denied(U.superadmin, "select public.acquire_sync_lock('camara-proposicoes', 60)")).toMatch(/permission denied/);
  });
  it("catálogo honesto: só a Câmara está ativa; DataJud aguarda licença", async () => {
    const r = await as<{ id: string; status: string; enabled: boolean }>(U.adminA, "select id, status, enabled from public.legal_source_providers order by id");
    expect(r.filter((x) => x.enabled).map((x) => x.id)).toEqual(["camara-proposicoes"]);
    expect(r.find((x) => x.id === "datajud-cnj")?.status).toBe("AGUARDA_LICENCA");
  });
});

describe("Agendador", () => {
  it("job único a cada 3 horas; função de disparo não é chamável pelo navegador", async () => {
    const j = (await db.query<{ jobname: string; schedule: string }>("select jobname, schedule from cron.job")).rows;
    expect(j).toEqual([{ jobname: "lexsion-inteligencia", schedule: "7 */3 * * *" }]);
    expect(await denied(U.superadmin, "select public.trigger_legal_sync()")).toMatch(/permission denied/);
  });
});
