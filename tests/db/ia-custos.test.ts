import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Controle financeiro da IA/OCR no banco: bloqueio padrão, teto em US$, limites de páginas, reserva e acerto, RLS.
const U = { superadmin: "00000000-0000-0000-0000-00000000000a", adminA: "00000000-0000-0000-0000-0000000000a1", adminB: "00000000-0000-0000-0000-0000000000b1" };
let db: PGlite;
let orgA = "", orgB = "";
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user ?? "", aal: "aal2" })]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
}
const denied = async (user: string | null, sql: string) => { try { await as(user, sql); return "permitido"; } catch (e) { return (e as Error).message; } };
const reserve = async (org: string, pages: number, usd: number, owner = "plataforma") => (await db.query<{ r: { ok: boolean; id?: number; reason?: string } }>("select public.ai_reserve($1,'ocr','ocr','gemini-2.5-flash-lite',$2,$3,'ocr-v1','doc-1',null,$4) r", [org, pages, usd, owner])).rows[0].r;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
  await db.query(`insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])`, [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.platform_members (user_id, role) values ($1, 'superadmin')", [U.superadmin]);
  orgA = (await as<{ id: string }>(U.superadmin, "select (public.create_organization('esc-a','Escritório A', $1)).id", [U.adminA]))[0].id;
  orgB = (await as<{ id: string }>(U.superadmin, "select (public.create_organization('esc-b','Escritório B', $1)).id", [U.adminB]))[0].id;
}, 60_000);

describe("controle financeiro da IA", () => {
  it("OCR nasce bloqueado: sem chave-mestra e sem faturamento confirmado nada é reservado", async () => {
    expect((await reserve(orgA, 1, 0.001)).reason).toBe("ocr_bloqueado");
    await db.query("update public.ai_settings set ocr_enabled = true");
    expect((await reserve(orgA, 1, 0.001)).reason).toBe("ocr_bloqueado"); // falta confirmação do faturamento
    await db.query("update public.ai_settings set billing_confirmed_at = now()");
    expect((await reserve(orgA, 1, 0.001)).ok).toBe(true);
  });
  it("limites de páginas por escritório (override > plano > plataforma) e por dia", async () => {
    await db.query("insert into public.ai_budgets (scope, ref, ocr_pages_day, ocr_pages_month) values ('escritorio', $1, 3, 10)", [orgA]);
    expect((await reserve(orgA, 2, 0.001)).ok).toBe(true); // 1 + 2 = 3
    expect((await reserve(orgA, 1, 0.001)).reason).toBe("limite_dia");
    expect((await reserve(orgB, 5, 0.001)).ok).toBe(true); // B usa o limite da plataforma (300/dia)
  });
  it("falha libera as páginas; acerto usa os tokens reais e o preço oficial", async () => {
    const r = await reserve(orgB, 1, 0.01);
    const cost = (await db.query<{ c: string }>("select public.ai_settle($1, true, 1000000, 100000, 1200) c", [r.id])).rows[0].c;
    expect(Number(cost)).toBeCloseTo(0.1 + 0.04, 6); // 1M entrada × $0,10 + 100k saída × $0,40
    const f = await reserve(orgB, 4, 0.01);
    await db.query("select public.ai_settle($1, false, null, null, 50)", [f.id]);
    expect((await db.query<{ pages: number; cost_usd: string; status: string }>("select pages, cost_usd, status from public.ai_usage where id = $1", [f.id])).rows[0]).toMatchObject({ pages: 0, status: "falha" });
    expect((await db.query("select public.ai_settle($1, true, 1, 1, 1) c", [r.id])).rows[0]).toEqual({ c: null }); // não acerta duas vezes
  });
  it("teto mensal em US$ da plataforma bloqueia; chave própria do escritório não consome o teto", async () => {
    await db.query("update public.ai_budgets set monthly_usd = 0.2 where scope = 'plataforma'");
    expect((await reserve(orgB, 1, 0.5)).reason).toBe("teto_plataforma");
    expect((await reserve(orgB, 1, 0.5, "escritorio")).ok).toBe(true);
    expect((await db.query<{ ok: boolean }>("select public.ai_platform_ok(0.5) ok")).rows[0].ok).toBe(false);
  });
  it("reservas concorrentes não passam do limite (trava atômica)", async () => {
    await db.query("insert into public.ai_budgets (scope, ref, ocr_pages_day, ocr_pages_month) values ('escritorio', $1, 1000, 1000) on conflict (scope, ref) do update set ocr_pages_day = 1000", [orgB]);
    await db.query("update public.ai_budgets set monthly_usd = 100, ocr_pages_month = 1000 where scope = 'plataforma'");
    const used = Number((await db.query<{ p: string }>("select coalesce(sum(pages),0) p from public.ai_usage where organization_id = $1 and status in ('reservado','concluido')", [orgB])).rows[0].p);
    await db.query("update public.ai_budgets set ocr_pages_day = $2 where scope = 'escritorio' and ref = $1", [orgB, used + 3]);
    const rs = await Promise.all(Array.from({ length: 6 }, () => reserve(orgB, 1, 0.001)));
    expect(rs.filter((r) => r.ok)).toHaveLength(3);
  });
  it("RLS: escritório não vê preços, orçamentos, configuração nem cache; plataforma vê preços e orçamentos", async () => {
    expect(await as(U.adminA, "select 1 from public.ai_budgets")).toEqual([]);
    expect(await as(U.adminA, "select 1 from public.ai_prices")).toEqual([]);
    expect((await as(U.superadmin, "select model from public.ai_prices")).length).toBeGreaterThan(0);
    expect(await denied(U.superadmin, "select 1 from public.ai_settings")).toMatch(/permission denied/);
    expect(await denied(U.adminA, "select 1 from public.ocr_cache")).toMatch(/permission denied/);
    expect(await denied(U.superadmin, "update public.ai_budgets set monthly_usd = 999")).toMatch(/permission denied/);
    expect(await denied(U.adminA, "select public.ai_reserve(null,'ocr','ocr','x',1,0,'v','d',null,'plataforma')")).toMatch(/permission denied/);
  });
  it("uso de IA de um escritório não aparece para outro", async () => {
    expect((await as<{ organization_id: string }>(U.adminA, "select distinct organization_id from public.ai_usage")).map((r) => r.organization_id)).toEqual([orgA]);
  });
});
