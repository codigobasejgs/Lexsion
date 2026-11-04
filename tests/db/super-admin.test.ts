import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Super Admin gerencial no banco: ações transacionais com auditoria, idempotência, versão (concorrência), RBAC
// interno (proprietário, operações, financeiro, suporte, auditor), cortesia ≠ receita e expiração automática.
const U = { owner: "00000000-0000-0000-0000-0000000000f1", ops: "00000000-0000-0000-0000-0000000000f2", fin: "00000000-0000-0000-0000-0000000000f3", sup: "00000000-0000-0000-0000-0000000000f4", aud: "00000000-0000-0000-0000-0000000000f5", tit: "00000000-0000-0000-0000-0000000000f6", nomfa: "00000000-0000-0000-0000-0000000000f7" };
let db: PGlite, org = "";
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = [], aal = "aal2"): Promise<T[]> {
  await db.exec("reset role");
  const sub = user === "service" ? "" : user ?? "";
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub, aal })]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub]);
  if (user !== "service") await db.exec(user ? "set role authenticated" : "set role anon");
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
}
const fails = async (user: string | null, sql: string, params: unknown[] = [], aal = "aal2") => { try { await as(user, sql, params, aal); return "permitido"; } catch (e) { return (e as Error).message; } };
const ver = async () => (await db.query<{ u: string }>("select updated_at::text u from public.organizations where id = $1", [org])).rows[0].u;
const state = async () => (await db.query<{ status: string; e: string | null; plan: string }>("select status, meta->>'trialEndsAt' e, plan from public.organizations where id = $1", [org])).rows[0];

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
  await db.query("insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])", [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.platform_members (user_id, role) values ($1,'superadmin'),($2,'platform_admin'),($3,'platform_finance'),($4,'platform_support'),($5,'platform_auditor'),($6,'superadmin')", [U.owner, U.ops, U.fin, U.sup, U.aud, U.nomfa]);
  org = (await as<{ id: string }>(U.owner, "select (public.create_organization('escritorio-sa','Escritório SA', $1)).id", [U.tit]))[0].id;
}, 60_000);

describe("Teste grátis", () => {
  it("conceder 14 dias: escritório em teste, fim no fim do dia em Brasília, histórico e auditoria com antes/depois/motivo", async () => {
    const r = (await as<{ r: { ok: boolean; new_end: string } }>(U.owner, "select public.platform_trial($1,'conceder',14,null,'Teste inicial do escritório',null,'k1') r", [org]))[0].r;
    expect(r.ok).toBe(true);
    const s = await state();
    expect(s.status).toBe("trial");
    const end = new Date(s.e!);
    expect(Math.round((end.getTime() - Date.now()) / 86_400_000)).toBeGreaterThanOrEqual(14);
    expect(end.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })).toBe("23:59:59");
    const a = (await db.query<{ reason: string; before: { status: string }; after: { status: string }; actor_role: string }>("select reason, before, after, actor_role from public.audit_logs where action = 'teste.concessao'")).rows[0];
    expect(a).toMatchObject({ reason: "Teste inicial do escritório", before: { status: "trial" }, after: { status: "trial" }, actor_role: "superadmin" });
  });
  it("prorrogar +7 soma ao fim atual; duplo clique (mesma chave) não prorroga duas vezes", async () => {
    const before = new Date((await state()).e!).getTime();
    await as(U.ops, "select public.platform_trial($1,'prorrogar',7,null,'Cliente pediu mais prazo',null,'k2')", [org]);
    await as(U.ops, "select public.platform_trial($1,'prorrogar',7,null,'Cliente pediu mais prazo',null,'k2')", [org]);
    const after = new Date((await state()).e!).getTime();
    expect(Math.round((after - before) / 86_400_000)).toBe(7);
    expect((await db.query("select 1 from public.saas_trial_grants where kind = 'extensao'")).rows.length).toBe(1);
  });
  it("dois administradores com a mesma versão: o segundo é recusado (não sobrescreve)", async () => {
    const v = await ver();
    await as(U.owner, "select public.platform_trial($1,'prorrogar',3,null,'Ajuste do proprietário',$2,'k3')", [org, v]);
    expect(await fails(U.ops, "select public.platform_trial($1,'prorrogar',3,null,'Ajuste da operação',$2,'k4')", [org, v])).toMatch(/alterado por outra pessoa/);
  });
  it("definir data exata exige motivo e data válida; encerrar suspende sem apagar dados", async () => {
    expect(await fails(U.owner, "select public.platform_trial($1,'definir',null,now() + interval '20 days','x',null,null)", [org])).toMatch(/motivo/);
    expect(await fails(U.owner, "select public.platform_trial($1,'definir',null,now() - interval '1 day','Data no passado',null,null)", [org])).toMatch(/data final/);
    await as(U.owner, "select public.platform_trial($1,'definir',null,now() + interval '20 days','Acordo comercial',null,null)", [org]);
    await db.query("insert into public.org_records (organization_id, collection, id, data) values ($1,'clients','c-sa','{\"name\":\"Cliente\"}')", [org]);
    await as(U.owner, "select public.platform_trial($1,'encerrar',null,null,'Encerrado a pedido',null,null)", [org]);
    expect((await state()).status).toBe("suspensa");
    expect((await db.query("select 1 from public.org_records where organization_id = $1", [org])).rows.length).toBe(1);
  });
  it("reativar teste vencido devolve o acesso; expiração automática suspende de novo, idempotente", async () => {
    await as(U.owner, "select public.platform_trial($1,'reativar',7,null,'Nova chance de avaliação',null,null)", [org]);
    expect((await state()).status).toBe("trial");
    await db.query("update public.organizations set meta = meta || jsonb_build_object('trialEndsAt', now() - interval '1 hour') where id = $1", [org]);
    expect((await as<{ r: { testes_expirados: number } }>("service", "select public.saas_expire_access() r"))[0].r.testes_expirados).toBe(1);
    expect((await as<{ r: { testes_expirados: number } }>("service", "select public.saas_expire_access() r"))[0].r.testes_expirados).toBe(0);
    expect((await state()).status).toBe("suspensa");
    expect((await db.query("select 1 from public.org_records where organization_id = $1", [org])).rows.length).toBe(1);
  });
});

describe("Cortesia, plano, status e limites", () => {
  it("cortesia: só o proprietário; acesso ativo sem receita (MRR 0, nenhum pedido pago)", async () => {
    expect(await fails(U.ops, "select public.platform_courtesy($1,'conceder',now() + interval '30 days','Parceria',null,null)", [org])).toMatch(/sem permissão/);
    await as(U.owner, "select public.platform_courtesy($1,'conceder',now() + interval '30 days','Parceria institucional',null,'c1')", [org]);
    expect((await state()).status).toBe("ativa");
    const m = (await as<{ m: { mrr: number; paying: number; courtesy: number } }>(U.owner, "select public.platform_metrics(30) m"))[0].m;
    expect(m).toMatchObject({ mrr: 0, paying: 0, courtesy: 1 });
    expect((await db.query("select 1 from public.saas_orders where status = 'pago'")).rows.length).toBe(0);
  });
  it("alterar plano é auditado, sem criar cobrança; plano inexistente recusado", async () => {
    await as(U.ops, "select public.platform_set_plan($1,'profissional','imediato','Upgrade comercial',null)", [org]);
    expect((await state()).plan).toBe("profissional");
    expect(await fails(U.ops, "select public.platform_set_plan($1,'inexistente','imediato','Teste inválido',null)", [org])).toMatch(/plano inválido/);
    expect((await db.query("select 1 from public.saas_orders")).rows.length).toBe(0);
  });
  it("suspender e reativar preservam dados; reativar sem direito vigente é recusado", async () => {
    await as(U.ops, "select public.platform_set_status($1,'suspensa','Uso indevido em análise',null)", [org]);
    expect((await state()).status).toBe("suspensa");
    await as(U.ops, "select public.platform_set_status($1,'ativa','Análise concluída',null)", [org]); // cortesia ainda vigente
    expect((await state()).status).toBe("ativa");
    await as(U.owner, "select public.platform_courtesy($1,'encerrar',null,'Fim da parceria',null,null)", [org]);
    await db.query("update public.organizations set meta = meta || jsonb_build_object('trialEndsAt', now() - interval '1 day'), status = 'suspensa' where id = $1", [org]);
    await db.query("insert into public.saas_subscriptions (organization_id, plan_id, cycle, status, price, plan_snapshot, max_users, current_period_start, current_period_end) values ($1,'solo','mensal','suspensa',9990,'{}',1,current_date - 40,current_date - 10)", [org]);
    expect(await fails(U.ops, "select public.platform_set_status($1,'ativa','Tentativa sem direito',null)", [org])).toMatch(/sem direito vigente/);
  });
  it("limite extra de usuários vale no banco (override > plano) e pode ser revogado", async () => {
    await db.query("insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f8','x8@t.invalid'),('00000000-0000-0000-0000-0000000000f9','x9@t.invalid')");
    expect(await fails("service", "insert into public.organization_memberships (organization_id, user_id, role) values ($1,'00000000-0000-0000-0000-0000000000f8','advogado')", [org])).toMatch(/limite de 1/);
    await as(U.ops, "select public.platform_override($1,3,now() + interval '10 days','Mutirão temporário')", [org]);
    await as("service", "insert into public.organization_memberships (organization_id, user_id, role) values ($1,'00000000-0000-0000-0000-0000000000f8','advogado')", [org]);
    await as(U.ops, "select public.platform_override($1,null,null,'Fim do mutirão')", [org]);
    expect(await fails("service", "insert into public.organization_memberships (organization_id, user_id, role) values ($1,'00000000-0000-0000-0000-0000000000f9','advogado')", [org])).toMatch(/limite de 1/);
  });
});

describe("RBAC interno e isolamento", () => {
  it("sem autenticador (aal1) a plataforma opera; vínculo vencido não opera nem lê", async () => {
    expect((await as(U.nomfa, "select * from public.platform_orgs()", [], "aal1")).length).toBeGreaterThan(0);
    await db.query("update public.platform_members set expires_at = now() - interval '1 minute' where user_id = $1", [U.nomfa]);
    expect(await fails(U.nomfa, "select public.platform_trial($1,'prorrogar',3,null,'Vínculo vencido',null,null)", [org], "aal1")).toMatch(/sem permissão/);
    expect(await fails(U.nomfa, "select * from public.platform_orgs()", [], "aal1")).toMatch(/somente a plataforma/);
  });
  it("suporte, financeiro e auditor leem a lista; suporte NÃO vê valores; nenhum deles executa ações", async () => {
    const sup = (await as<{ sub_price: number | null }>(U.sup, "select sub_price from public.platform_orgs()"))[0];
    expect(sup.sub_price).toBeNull();
    expect((await as<{ sub_price: number }>(U.fin, "select sub_price from public.platform_orgs()"))[0].sub_price).toBe(9990);
    expect((await as<{ m: { mrr: number | null } }>(U.sup, "select public.platform_metrics(30) m"))[0].m.mrr).toBeNull();
    for (const u of [U.sup, U.fin, U.aud]) expect(await fails(u, "select public.platform_set_status($1,'suspensa','Tentativa indevida',null)", [org])).toMatch(/sem permissão/);
  });
  it("titular do escritório e anônimo não chamam funções da plataforma nem leem concessões", async () => {
    expect(await fails(U.tit, "select * from public.platform_orgs()")).toMatch(/somente a plataforma/);
    expect(await fails(U.tit, "select public.platform_trial($1,'prorrogar',30,null,'Autoprorrogação',null,null)", [org])).toMatch(/sem permissão/);
    expect(await as(U.tit, "select id from public.saas_trial_grants")).toEqual([]);
    expect(await fails(null, "select * from public.platform_orgs()")).toMatch(/permission denied/);
  });
  it("histórico e auditoria são só-acréscimo; auditor lê a auditoria; suporte não", async () => {
    expect(await fails("service", "update public.saas_trial_grants set days = 999")).toMatch(/só-acréscimo/);
    expect(await fails("service", "delete from public.saas_trial_grants")).toMatch(/só-acréscimo/);
    expect((await as(U.aud, "select id from public.audit_logs where organization_id = $1", [org])).length).toBeGreaterThan(5);
    expect(await as(U.sup, "select id from public.audit_logs where organization_id = $1", [org])).toEqual([]);
  });
  it("linha do tempo 360º traz eventos, concessões e equipe, sem conteúdo jurídico", async () => {
    const t = (await as<{ t: { events: unknown[]; grants: unknown[]; team: { role: string }[] } }>(U.owner, "select public.platform_org_timeline($1) t", [org]))[0].t;
    expect(t.events.length).toBeGreaterThan(5);
    expect(t.grants.length).toBeGreaterThanOrEqual(5);
    expect(t.team.map((m) => m.role)).toContain("admin");
    expect(JSON.stringify(t)).not.toContain("c-sa"); // nada de org_records (conteúdo do escritório)
    expect(Object.keys(t).sort()).toEqual(["contracts", "events", "grants", "orders", "overrides", "team"]);
  });
});

describe("Equipe da plataforma (Super Admin)", () => {
  const staff = "00000000-0000-0000-0000-0000000000e1";
  const email = (id: string) => db.query<{ e: string }>("select email e from auth.users where id = $1", [id]).then((r) => r.rows[0].e);
  it("Super Admin concede papel com módulos restritos; a pessoa só usa o que foi liberado; não-superadmin não gerencia", async () => {
    await db.query("insert into auth.users (id, email) values ($1, 'staff@teste.invalid') on conflict do nothing", [staff]);
    await as(U.owner, "select public.platform_staff_set('staff@teste.invalid', 'platform_support', array['financeiro','auditoria'], null, 'suporte de novembro', false)");
    const ok = async (m: string) => (await as<{ ok: boolean }>(staff, "select public.platform_module_ok($1) ok", [m]))[0].ok;
    expect(await ok("suporte")).toBe(true);
    expect(await ok("financeiro")).toBe(false);
    expect(await ok("equipe")).toBe(false);
    expect((await as<{ a: { platform: string; platformDenied: string[] } }>(staff, "select public.my_access() a"))[0].a).toMatchObject({ platform: "platform_support", platformDenied: ["financeiro", "auditoria"] });
    expect(await fails(staff, "select public.platform_staff_set('staff@teste.invalid', 'superadmin', null, null, 'me promovendo', false)")).toMatch(/somente o Super Admin/);
    expect(await fails(U.ops, "select * from public.platform_staff()")).toMatch(/somente o Super Admin/);
    expect(await fails(null, "select * from public.platform_staff()")).toMatch(/permission denied|somente/);
    const a = (await db.query<{ action: string; reason: string }>("select action, reason from public.audit_logs where entity = 'platform_members' and entity_id = $1 order by id desc limit 1", [staff])).rows[0];
    expect(a).toEqual({ action: "plataforma.acesso_concedido", reason: "suporte de novembro" });
    expect((await as(U.owner, "select * from public.platform_staff()")).length).toBeGreaterThan(5);
  });
  it("alterar e revogar; validade vencida corta o acesso", async () => {
    await as(U.owner, "select public.platform_staff_set('staff@teste.invalid', 'platform_finance', '{}', now() + interval '1 day', 'mudou para financeiro', false)");
    expect((await as<{ ok: boolean }>(staff, "select public.platform_module_ok('financeiro') ok"))[0].ok).toBe(true);
    await db.query("update public.platform_members set expires_at = now() - interval '1 minute' where user_id = $1", [staff]);
    expect((await as<{ ok: boolean }>(staff, "select public.platform_module_ok('suporte') ok"))[0].ok).toBe(false);
    expect((await as<{ a: { platform: string | null } }>(staff, "select public.my_access() a"))[0].a.platform).toBeNull();
    await as(U.owner, "select public.platform_staff_set('staff@teste.invalid', null, null, null, 'fim do contrato', true)");
    expect((await db.query("select 1 from public.platform_members where user_id = $1", [staff])).rows).toEqual([]);
  });
  it("não altera a si mesmo, exige conta cadastrada, motivo e módulo válido; nunca deixa a plataforma sem Super Admin", async () => {
    expect(await fails(U.owner, "select public.platform_staff_set($1, 'superadmin', null, null, 'auto alteração', true)", [await email(U.owner)])).toMatch(/próprio/);
    expect(await fails(U.owner, "select public.platform_staff_set('nao-existe@teste.invalid', 'platform_support', null, null, 'conta inexistente', false)")).toMatch(/não há conta/);
    expect(await fails(U.owner, "select public.platform_staff_set('staff@teste.invalid', 'platform_admin', null, null, 'x', false)")).toMatch(/motivo/);
    expect(await fails(U.owner, "select public.platform_staff_set('staff@teste.invalid', 'platform_admin', array['inexistente'], null, 'módulo errado', false)")).toMatch(/módulo desconhecido/);
    // Dois Super Admins (owner e nomfa): owner rebaixa nomfa; depois ninguém consegue tirar o último.
    await as(U.owner, "select public.platform_staff_set($1, 'platform_admin', null, null, 'rebaixado para operação', false)", [await email(U.nomfa)]);
    await db.query("insert into public.platform_members (user_id, role) values ($1, 'superadmin') on conflict (user_id) do update set role = 'superadmin'", [staff]);
    await as(staff, "select public.platform_staff_set($1, null, null, null, 'troca de responsável', true)", [await email(U.owner)]);
    expect(await fails(staff, "select public.platform_staff_set($1, 'superadmin', null, null, 'tentativa', false)", [await email(staff)])).toMatch(/próprio/);
    expect((await db.query<{ n: number }>("select count(*)::int n from public.platform_members where role = 'superadmin'")).rows[0].n).toBe(1);
    await db.query("insert into public.platform_members (user_id, role) values ($1,'superadmin') on conflict (user_id) do update set role='superadmin'", [U.owner]);
    await db.query("update public.platform_members set role = 'superadmin' where user_id = $1", [U.nomfa]);
    await db.query("delete from public.platform_members where user_id = $1", [staff]);
  });
});
