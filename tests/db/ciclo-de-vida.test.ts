import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Ciclo de vida dos dados (Anexo III.10–12) e perfil de atuação: encerramento grava a data; eliminação só após 90 dias,
// só pelo servidor, preserva contratos/pagamentos, remove o resto e deixa trilha permanente; exportação só do titular;
// incidente com prazo de 1 dia útil; perfil de atuação com RLS e catálogo; plataforma sem autenticador.
const U = { sa: "00000000-0000-0000-0000-0000000000c1", ta: "00000000-0000-0000-0000-0000000000c2", tb: "00000000-0000-0000-0000-0000000000c3", adv: "00000000-0000-0000-0000-0000000000c4", aud: "00000000-0000-0000-0000-0000000000c5" };
let db: PGlite, orgA = "", orgB = "";
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("reset role");
  const sub = user === "service" ? "" : user ?? "";
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub, aal: "aal1" })]); // sessão comum (sem TOTP)
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub]);
  if (user !== "service") await db.exec(user ? "set role authenticated" : "set role anon");
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
}
const fails = async (user: string | null, sql: string, params: unknown[] = []) => { try { await as(user, sql, params); return "permitido"; } catch (e) { return (e as Error).message; } };

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
  await db.query("insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])", [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.platform_members (user_id, role) values ($1,'superadmin'), ($2,'platform_auditor')", [U.sa, U.aud]);
  orgA = (await db.query<{ id: string }>("insert into public.organizations (slug, name, status) values ('esc-ciclo-a','Escritório A','ativa') returning id")).rows[0].id;
  orgB = (await db.query<{ id: string }>("insert into public.organizations (slug, name, status) values ('esc-ciclo-b','Escritório B','ativa') returning id")).rows[0].id;
  await db.query("insert into public.organization_memberships (organization_id, user_id, role) values ($1,$2,'admin'), ($3,$4,'admin'), ($1,$5,'advogado')", [orgA, U.ta, orgB, U.tb, U.adv]);
  await db.query("insert into public.org_records (organization_id, collection, id, data) values ($1,'clients','c1','{\"name\":\"Cliente A\"}'), ($2,'clients','c2','{\"name\":\"Cliente B\"}')", [orgA, orgB]);
  const tpl = (await db.query<{ id: string }>("insert into public.saas_contract_template_versions (version, title, clauses, content_sha256) values ('t-ciclo','T','[]','x') returning id")).rows[0].id;
  await db.query(`insert into public.saas_contracts (number, session_token_sha256, template_version_id, template_status_at_render, plan_id, cycle, amount, plan_snapshot, supplier_snapshot, party, organization_id)
    values ('LX-CICLO', md5('LX-CICLO'), $1, 'PUBLICADO', 'solo', 'mensal', 9990, '{}', '{}', '{"kind":"PF","slug":"esc-ciclo-a"}', $2)`, [tpl, orgA]);
}, 60_000);

describe("Plataforma sem autenticador", () => {
  it("superadmin com sessão comum (aal1) é plataforma; titular não é", async () => {
    expect(await as(U.sa, "select public.is_platform() ok")).toEqual([{ ok: true }]);
    expect(await as(U.ta, "select public.is_platform() ok")).toEqual([{ ok: false }]);
  });
});

describe("Encerramento e eliminação após 90 dias", () => {
  it("cancelar grava closed_at; reativar limpa", async () => {
    await db.query("update public.organizations set status = 'cancelada' where id = $1", [orgB]);
    expect((await db.query<{ c: string | null }>("select closed_at c from public.organizations where id = $1", [orgB])).rows[0].c).not.toBeNull();
    await db.query("update public.organizations set status = 'ativa' where id = $1", [orgB]);
    expect((await db.query<{ c: string | null }>("select closed_at c from public.organizations where id = $1", [orgB])).rows[0].c).toBeNull();
  });
  it("antes de 90 dias: aparece como 'aguardando' e o banco recusa a eliminação", async () => {
    await db.query("update public.organizations set status = 'cancelada' where id = $1", [orgA]);
    const [c] = await as<{ slug: string; eligible: boolean }>(U.sa, "select slug, eligible from public.platform_erasure_candidates()");
    expect(c).toEqual({ slug: "esc-ciclo-a", eligible: false });
    const p = (await as<{ p: { remove: Record<string, number>; retain: Record<string, unknown> } }>(U.sa, "select public.platform_erasure_preview($1) p", [orgA]))[0].p;
    expect(p.remove.registros_operacionais).toBe(1);
    expect(p.retain.contratos_saas).toBe(1);
    const e = (await db.query<{ id: string }>("insert into public.data_erasures (organization_id, org_slug, org_name, closed_at, eligible_at, requested_by, reason, preview) values ($1,'esc-ciclo-a','A', now(), now(), $2, 'Teste de eliminação precoce', '{}') returning id", [orgA, U.sa])).rows[0].id;
    expect(await fails("service", "select public.saas_erase_org_db($1)", [e])).toMatch(/não elegível/);
  });
  it("titular, auditor e anônimo não eliminam; só o servidor executa a etapa de banco", async () => {
    expect(await fails(U.sa, "select public.saas_erase_org_db(gen_random_uuid())")).toMatch(/permission denied/);
    expect(await fails(U.ta, "select public.platform_erasure_candidates()")).toMatch(/somente a plataforma/);
    expect(await fails(null, "select public.platform_erasure_preview($1)", [orgA])).toMatch(/permission denied/);
    expect((await as(U.aud, "select * from public.platform_erasure_candidates()")).length).toBe(1); // auditor consulta
  });
  it("após 90 dias: elimina registros, equipe e trilha do escritório; preserva contrato (desvinculado) e deixa trilha permanente", async () => {
    await db.query("update public.organizations set closed_at = now() - interval '91 days' where id = $1", [orgA]);
    const e = (await db.query<{ id: string }>("insert into public.data_erasures (organization_id, org_slug, org_name, closed_at, eligible_at, requested_by, reason, preview) values ($1,'esc-ciclo-a','A', now() - interval '91 days', now() - interval '1 day', $2, 'Encerrado há mais de 90 dias', '{}') returning id", [orgA, U.sa])).rows[0].id;
    const counts = (await as<{ r: Record<string, number> }>("service", "select public.saas_erase_org_db($1) r", [e]))[0].r;
    expect(counts.registros_operacionais).toBe(1);
    expect((await db.query("select 1 from public.organizations where id = $1", [orgA])).rows).toEqual([]);
    expect((await db.query("select 1 from public.org_records where organization_id = $1", [orgA])).rows).toEqual([]);
    expect((await db.query("select 1 from public.organization_memberships where organization_id = $1", [orgA])).rows).toEqual([]);
    expect((await db.query("select 1 from public.audit_logs where organization_id = $1", [orgA])).rows).toEqual([]);
    expect((await db.query<{ o: string | null }>("select organization_id o from public.saas_contracts where number = 'LX-CICLO'")).rows[0].o).toBeNull(); // preservado
    expect((await db.query<{ s: string }>("select status s from public.data_erasures where id = $1", [e])).rows[0].s).toBe("concluida");
    expect((await db.query("select 1 from public.org_records where organization_id = $1", [orgB])).rows.length).toBe(1); // outro escritório intacto
    expect(await fails("service", "delete from public.data_erasures where id = $1", [e])).toMatch(/permanente/); // escritório real
    const q = (await db.query<{ id: string }>("insert into public.data_erasures (organization_id, org_slug, org_name, closed_at, eligible_at, requested_by, reason, preview) values (gen_random_uuid(),'qa-sintetico','QA', now(), now(), $1, 'Teste sintético removível', '{}') returning id", [U.sa])).rows[0].id;
    expect(await fails(U.sa, "delete from public.data_erasures where id = $1", [q])).toMatch(/permission denied/);
    await as("service", "delete from public.data_erasures where id = $1", [q]); // só o servidor, só "qa-"
    expect(await fails("service", "update public.data_erasures set reason = 'trocado depois do fato' where id = $1", [e])).toMatch(/imutáveis/);
  });
});

describe("Exportação, incidentes e perfil de atuação", () => {
  it("exportações: titular lê as do próprio escritório; outro titular e advogado não", async () => {
    await db.query("insert into public.data_exports (organization_id, requested_by, status) values ($1, $2, 'pronto')", [orgB, U.tb]);
    expect((await as(U.tb, "select id from public.data_exports")).length).toBe(1);
    expect(await as(U.ta, "select id from public.data_exports")).toEqual([]);
    expect(await fails(U.tb, "insert into public.data_exports (organization_id, requested_by) values ($1,$2)", [orgB, U.tb])).toMatch(/permission denied/); // só o servidor cria
  });
  it("incidente: prazo de aviso é 1 dia útil (sexta → segunda); auditor lê, titular não; histórico só-acréscimo", async () => {
    const [i] = await as<{ id: string; d: string }>(U.sa, "insert into public.security_incidents (title, detected_at, known_at, notify_deadline) values ('Teste de incidente', '2026-11-06 10:00-03', '2026-11-06 10:00-03', now()) returning id, (notify_deadline at time zone 'America/Sao_Paulo')::date::text d");
    expect(i.d).toBe("2026-11-09");
    expect((await as(U.aud, "select id from public.security_incidents")).length).toBe(1);
    expect(await as(U.ta, "select id from public.security_incidents")).toEqual([]);
    await as(U.sa, "insert into public.security_incident_updates (incident_id, kind, text) values ($1, 'contencao', 'Credencial revogada e trocada')", [i.id]);
    expect(await fails("service", "delete from public.security_incident_updates")).toMatch(/só-acréscimo/);
  });
  it("perfil de atuação: titular grava; catálogo e principal conferidos; advogado só lê; outro escritório não vê", async () => {
    await as(U.tb, "insert into public.org_practice_profiles (organization_id, primary_area, areas, practice_models) values ($1, 'previdenciario', '{previdenciario,trabalhista}', '{Contencioso}')", [orgB]);
    expect(await fails(U.tb, "update public.org_practice_profiles set areas = '{astrologia}' where organization_id = $1", [orgB])).toMatch(/catálogo/);
    expect(await fails(U.tb, "update public.org_practice_profiles set primary_area = 'civil' where organization_id = $1", [orgB])).toMatch(/principal/);
    expect(await as(U.ta, "select * from public.org_practice_profiles")).toEqual([]);
  });
});
