import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Contratação self-service no banco: ativação transacional e idempotente, renovação, limite de usuários e RLS
// (titular vê só o próprio; navegador não escreve nada; plataforma vê tudo). Migrations reais em PGlite.
const U = { sa: "00000000-0000-0000-0000-0000000000aa", t1: "00000000-0000-0000-0000-0000000000d1", t2: "00000000-0000-0000-0000-0000000000d2", x: "00000000-0000-0000-0000-0000000000d3", trial: "00000000-0000-0000-0000-0000000000d4" };
let db: PGlite;
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("reset role");
  // "service" = servidor com a chave secreta: sem usuário (auth.uid() nulo) e sem RLS (no Supabase o service_role tem tudo).
  const sub = user === "service" ? "" : user ?? "";
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub, aal: "aal2" })]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub]);
  if (user !== "service") await db.exec(user ? "set role authenticated" : "set role anon");
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
}
const fails = async (user: string | null, sql: string, params: unknown[] = []) => { try { await as(user, sql, params); return "permitido"; } catch (e) { return (e as Error).message; } };
// Pedido pago (como o servidor grava depois de conferir no /payment_check).
async function paidOrder(slug: string, email: string, plan = "solo") {
  return (await db.query<{ id: string }>(`insert into public.saas_orders (plan_id, cycle, amount, plan_snapshot, customer, status, paid_at, transaction_nsu)
    select id, 'mensal', price_monthly, to_jsonb(p), jsonb_build_object('slug', $1::text, 'office', 'Escritório ' || $1, 'name', 'Titular', 'email', $2::text), 'pago', '2026-10-30T12:00:00Z', gen_random_uuid()::text
    from public.saas_plans p where id = $3 returning id`, [slug, email, plan])).rows[0].id;
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
  await db.query("insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])", [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.platform_members (user_id, role) values ($1, 'superadmin')", [U.sa]);
}, 60_000);

describe("Planos propostos", () => {
  it("Solo, Profissional e Elite existem com os valores propostos e NÃO aprovados (nada é vendido)", async () => {
    const p = (await db.query<{ id: string; price_monthly: number; max_users: number; approved: boolean; price_yearly: number | null; trial_days: number }>("select id, price_monthly, max_users, approved, price_yearly, trial_days from public.saas_plans order by sort")).rows;
    expect(p.map((x) => [x.id, x.price_monthly, x.max_users])).toEqual([["solo", 9990, 1], ["profissional", 24990, 5], ["elite", 49990, 15]]);
    expect(p.every((x) => !x.approved && x.price_yearly === null && x.trial_days === 0)).toBe(true);
  });
  it("preço abaixo do mínimo da InfinitePay (R$ 1,00) é recusado pelo banco", async () => {
    expect(await fails("service", "update public.saas_plans set price_monthly = 50 where id = 'solo'")).toMatch(/check/);
  });
});

describe("Ativação", () => {
  it("pedido pago ativa exatamente UM escritório, titular e assinatura; repetir não duplica", async () => {
    const o = await paidOrder("escritorio-novo", "t1@teste.invalid");
    const org1 = (await as<{ id: string }>("service", "select public.saas_activate($1, $2) id", [o, U.t1]))[0].id;
    const org2 = (await as<{ id: string }>("service", "select public.saas_activate($1, $2) id", [o, U.t1]))[0].id;
    expect(org2).toBe(org1);
    expect((await db.query("select 1 from public.organizations where slug = 'escritorio-novo'")).rows.length).toBe(1);
    const s = (await db.query<{ status: string; max_users: number; current_period_end: string }>("select status, max_users, current_period_end::text from public.saas_subscriptions where organization_id = $1", [org1])).rows[0];
    expect(s).toEqual({ status: "ativa", max_users: 1, current_period_end: "2026-11-30" });
    expect((await db.query<{ role: string }>("select role from public.organization_memberships where organization_id = $1 and user_id = $2", [org1, U.t1])).rows[0].role).toBe("admin");
    expect((await db.query("select 1 from public.audit_logs where action = 'assinatura.ativada' and organization_id = $1", [org1])).rows.length).toBe(1);
  });
  it("pedido pendente NÃO ativa", async () => {
    const o = await paidOrder("escritorio-pendente", "x@teste.invalid");
    await db.query("update public.saas_orders set status = 'pendente' where id = $1", [o]);
    expect(await fails("service", "select public.saas_activate($1, $2)", [o, U.x])).toMatch(/não está pago/);
    expect((await db.query("select 1 from public.organizations where slug = 'escritorio-pendente'")).rows.length).toBe(0);
  });
  it("endereço já usado: ativação falha inteira (sem escritório pela metade) e o pedido continua pago e recuperável", async () => {
    const o = await paidOrder("escritorio-novo", "t2@teste.invalid");
    expect(await fails("service", "select public.saas_activate($1, $2)", [o, U.t2])).toMatch(/já em uso/);
    const r = (await db.query<{ status: string; activation: string }>("select status, activation from public.saas_orders where id = $1", [o])).rows[0];
    expect(r).toEqual({ status: "pago", activation: "aguardando" });
    expect((await db.query("select 1 from public.organization_memberships where user_id = $1", [U.t2])).rows.length).toBe(0);
  });
  it("só o servidor ativa: navegador (authenticated), mesmo plataforma, não executa", async () => {
    const o = await paidOrder("escritorio-x", "t2@teste.invalid");
    expect(await fails(U.sa, "select public.saas_activate($1, $2)", [o, U.sa])).toMatch(/permission denied/);
    expect(await fails(U.t2, "select public.saas_activate($1, $2)", [o, U.t2])).toMatch(/permission denied/);
  });
});

describe("Teste grátis", () => {
  it("pedido em teste cria escritório 'trial' e assinatura 'teste' com fim = início + dias do plano; sem cobrança", async () => {
    const o = (await db.query<{ id: string }>(`insert into public.saas_orders (plan_id, cycle, amount, plan_snapshot, customer, status, created_at)
      values ('profissional', 'mensal', 24990, '{"max_users":5,"trial_days":30,"label":"Profissional"}', '{"slug":"escritorio-teste","office":"Escritório Teste","name":"T","email":"x@teste.invalid","document":"52998224725"}', 'teste', '2026-10-30T12:00:00Z') returning id`)).rows[0].id;
    const org = (await as<{ id: string }>("service", "select public.saas_activate($1, $2) id", [o, U.trial]))[0].id;
    expect((await db.query<{ status: string }>("select status from public.organizations where id = $1", [org])).rows[0].status).toBe("trial");
    expect((await db.query<{ status: string; e: string }>("select status, current_period_end::text e from public.saas_subscriptions where organization_id = $1", [org])).rows[0]).toEqual({ status: "teste", e: "2026-11-29" });
    expect((await db.query<{ paid_at: string | null; transaction_nsu: string | null }>("select paid_at, transaction_nsu from public.saas_orders where id = $1", [o])).rows[0]).toEqual({ paid_at: null, transaction_nsu: null });
  });
  it("um teste por CPF/CNPJ: o 2º teste com o mesmo documento é recusado pelo banco", async () => {
    expect(await fails("service", `insert into public.saas_orders (plan_id, cycle, amount, plan_snapshot, customer, status) values ('solo','mensal',9990,'{}','{"slug":"outro","document":"52998224725","email":"y@teste.invalid"}','teste')`)).toMatch(/duplicate key|unique/);
  });
  it("1ª mensalidade paga ao fim do teste: escritório passa a 'ativa' e o período conta do fim do teste", async () => {
    const org = (await db.query<{ id: string }>("select id from public.organizations where slug = 'escritorio-teste'")).rows[0].id;
    const o = (await db.query<{ id: string }>(`insert into public.saas_orders (kind, organization_id, plan_id, cycle, amount, plan_snapshot, customer, status, paid_at, transaction_nsu)
      values ('renovacao', $1, 'profissional', 'mensal', 24990, '{}', '{}', 'pago', '2026-11-25T12:00:00Z', 'tx-fim-teste') returning id`, [org])).rows[0].id;
    await as("service", "select public.saas_apply_renewal($1)", [o]);
    expect((await db.query<{ status: string }>("select status from public.organizations where id = $1", [org])).rows[0].status).toBe("ativa");
    expect((await db.query<{ status: string; e: string }>("select status, current_period_end::text e from public.saas_subscriptions where organization_id = $1", [org])).rows[0]).toEqual({ status: "ativa", e: "2026-12-29" });
  });
});

describe("Limites, renovação e isolamento", () => {
  it("plano Solo (1 usuário): convidar a 2ª pessoa é recusado pelo banco", async () => {
    const org = (await db.query<{ id: string }>("select id from public.organizations where slug = 'escritorio-novo'")).rows[0].id;
    expect(await fails("service", "insert into public.organization_memberships (organization_id, user_id, role) values ($1, $2, 'advogado')", [org, U.x])).toMatch(/limite de 1 usuário/);
  });
  it("renovação paga estende do fim do período e reativa suspensão por inadimplência; repetir não estende 2x", async () => {
    const org = (await db.query<{ id: string }>("select id from public.organizations where slug = 'escritorio-novo'")).rows[0].id;
    await db.query("update public.organizations set status = 'suspensa', status_reason = 'Inadimplência: período vencido' where id = $1", [org]);
    const o = (await db.query<{ id: string }>(`insert into public.saas_orders (kind, organization_id, plan_id, cycle, amount, plan_snapshot, customer, status, paid_at, transaction_nsu)
      values ('renovacao', $1, 'solo', 'mensal', 9990, '{}', '{}', 'pago', '2026-11-20T12:00:00Z', 'tx-renova') returning id`, [org])).rows[0].id;
    await as("service", "select public.saas_apply_renewal($1)", [o]);
    await as("service", "select public.saas_apply_renewal($1)", [o]);
    expect((await db.query<{ e: string }>("select current_period_end::text e from public.saas_subscriptions where organization_id = $1", [org])).rows[0].e).toBe("2026-12-30");
    expect((await db.query<{ status: string }>("select status from public.organizations where id = $1", [org])).rows[0].status).toBe("ativa");
  });
  it("titular lê SÓ o próprio pedido e assinatura; outro usuário não lê nada; ninguém do navegador escreve", async () => {
    expect((await as(U.t1, "select organization_id from public.saas_subscriptions")).length).toBe(1);
    expect((await as(U.t1, "select id from public.saas_orders")).length).toBe(2); // contratação + renovação do próprio escritório
    expect(await as(U.x, "select id from public.saas_orders")).toEqual([]);
    expect(await as(U.x, "select organization_id from public.saas_subscriptions")).toEqual([]);
    expect(await fails(U.t1, "update public.saas_subscriptions set price = 100")).toMatch(/permission denied/);
    expect(await fails(U.t1, "update public.saas_plans set price_monthly = 100")).toMatch(/permission denied/);
    expect(await fails(U.sa, "insert into public.saas_orders (plan_id, cycle, amount, plan_snapshot, customer) values ('solo','mensal',100,'{}','{}')")).toMatch(/permission denied/);
    expect(await fails(null, "select id from public.saas_plans")).toMatch(/permission denied/);
  });
  it("plataforma (MFA) lê todos os pedidos e avisos; titular não lê avisos do provedor", async () => {
    expect((await as(U.sa, "select id from public.saas_orders")).length).toBeGreaterThanOrEqual(4);
    await db.query("insert into public.saas_webhook_events (body_sha256, body) values ('h1', '{}')");
    expect((await as(U.sa, "select id from public.saas_webhook_events")).length).toBe(1);
    expect(await as(U.t1, "select id from public.saas_webhook_events")).toEqual([]);
  });
});
