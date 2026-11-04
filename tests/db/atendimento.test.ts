import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Atendimento WhatsApp: corrida "humano assumiu × IA respondendo", grupos sem IA, espelho aiActive, dedupe de eventos.
const U = { superadmin: "00000000-0000-0000-0000-00000000000a", adminA: "00000000-0000-0000-0000-0000000000a1", atdA: "00000000-0000-0000-0000-0000000000a3", finA: "00000000-0000-0000-0000-0000000000a4", adminB: "00000000-0000-0000-0000-0000000000b1" };
let db: PGlite;
let orgA = "";
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user ?? "", aal: "aal1" })]);
  await db.exec(user ? "set role authenticated" : "set role anon");
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
}
const denied = async (user: string | null, sql: string, params: unknown[] = []) => { try { await as(user, sql, params); return "permitido"; } catch (e) { return (e as Error).message; } };
const conv = (id: string, extra = {}) => db.query("insert into public.org_records (organization_id, collection, id, data) values ($1,'conversations',$2,$3)", [orgA, id, JSON.stringify({ id, organizationId: orgA, contactName: "Contato", phone: "+5511999990000", status: "aguardando_equipe", aiActive: true, unread: 0, ...extra })]);
const job = async (c: string, trigger: string) => {
  const v = (await db.query<{ version: number }>("select version from public.conversation_control where organization_id = $1 and conversation_id = $2", [orgA, c])).rows[0].version;
  return (await db.query<{ id: number }>("insert into public.ai_jobs (organization_id, conversation_id, trigger_message_id, control_version) values ($1,$2,$3,$4) returning id", [orgA, c, trigger, v])).rows[0].id;
};
const claim = async (id: number) => { await db.query("update public.ai_jobs set status = 'gerando' where id = $1", [id]); return (await db.query<{ ok: boolean }>("select public.ai_job_claim_send($1) as ok", [id])).rows[0].ok; };
const aiActive = async (c: string) => (await db.query<{ a: boolean }>("select (data->>'aiActive')::boolean as a from public.org_records where organization_id = $1 and collection = 'conversations' and id = $2", [orgA, c])).rows[0].a;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
  await db.query(`insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])`, [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.platform_members (user_id, role) values ($1, 'superadmin')", [U.superadmin]);
  orgA = (await as<{ id: string }>(U.superadmin, "select (public.create_organization('esc-a','Escritório A', $1)).id", [U.adminA]))[0].id;
  await as(U.superadmin, "select (public.create_organization('esc-b','Escritório B', $1)).id", [U.adminB]);
  await as(U.adminA, "insert into public.organization_memberships values ($1,$2,'atendimento'), ($1,$3,'financeiro')", [orgA, U.atdA, U.finA]);
}, 60_000);

describe("Atendimento — controle IA × humano", () => {
  it("conversa sem controle não fica com IA ativa (espelho força aiActive = false)", async () => {
    await conv("c1");
    expect(await aiActive("c1")).toBe(false);
  });
  it("devolver à IA ativa o espelho; assumir desativa, incrementa versão e cancela resposta pendente", async () => {
    const r1 = (await as<{ r: { mode: string; version: number } }>(U.atdA, "select public.conversation_set_mode($1,'c1','ia') as r", [orgA]))[0].r;
    expect(r1.mode).toBe("ia");
    expect(await aiActive("c1")).toBe(true);
    const j = await job("c1", "wa-m1");
    const r2 = (await as<{ r: { version: number; cancelled: number } }>(U.atdA, "select public.conversation_set_mode($1,'c1','humano') as r", [orgA]))[0].r;
    expect(r2.version).toBe(r1.version + 1);
    expect(r2.cancelled).toBe(1);
    expect((await db.query<{ status: string }>("select status from public.ai_jobs where id = $1", [j])).rows[0].status).toBe("cancelado");
    expect(await aiActive("c1")).toBe(false);
  });
  it("corrida: IA gerou a resposta, humano assumiu antes do envio ⇒ portão descarta (nada sai)", async () => {
    await as(U.atdA, "select public.conversation_set_mode($1,'c1','ia')", [orgA]);
    const j = await job("c1", "wa-m2");
    await db.query("update public.ai_jobs set status = 'gerando' where id = $1", [j]); // geração em andamento
    await as(U.adminA, "select public.conversation_set_mode($1,'c1','humano')", [orgA]); // cancela 'gerando'
    expect((await db.query<{ ok: boolean }>("select public.ai_job_claim_send($1) as ok", [j])).rows[0].ok).toBe(false);
    // Mesmo se o cancelamento não pegasse o trabalho (estado reaberto), a versão mudou: descartado.
    await as(U.atdA, "select public.conversation_set_mode($1,'c1','ia')", [orgA]);
    await db.query("update public.ai_jobs set status = 'gerando' where id = $1", [j]);
    expect((await db.query<{ ok: boolean }>("select public.ai_job_claim_send($1) as ok", [j])).rows[0].ok).toBe(false);
    expect((await db.query<{ status: string }>("select status from public.ai_jobs where id = $1", [j])).rows[0].status).toBe("descartado");
  });
  it("sem mudança de modo, o portão libera uma única vez e a confirmação final passa", async () => {
    const j = await job("c1", "wa-m3");
    expect(await claim(j)).toBe(true);
    expect((await db.query<{ ok: boolean }>("select public.ai_job_claim_send($1) as ok", [j])).rows[0].ok).toBe(false); // já "enviando"
    expect((await db.query<{ ok: boolean }>("select public.ai_job_confirm_send($1) as ok", [j])).rows[0].ok).toBe(true);
    await db.query("select public.ai_job_release_send($1)", [j]);
    await db.query("update public.ai_jobs set status = 'enviado' where id = $1", [j]);
  });
  it("corrida residual: humano assume DEPOIS do portão e ANTES do envio ⇒ confirmação final recusa (nada sai)", async () => {
    const j = await job("c1", "wa-m4");
    expect(await claim(j)).toBe(true); // portão passou; geração terminou; envio ainda não começou
    await as(U.atdA, "select public.conversation_set_mode($1,'c1','humano')", [orgA]);
    expect((await db.query<{ ok: boolean }>("select public.ai_job_confirm_send($1) as ok", [j])).rows[0].ok).toBe(false);
    expect((await db.query<{ status: string }>("select status from public.ai_jobs where id = $1", [j])).rows[0].status).toBe("cancelado");
    expect((await db.query<{ s: number | null }>("select sending_job s from public.conversation_control where organization_id = $1 and conversation_id = 'c1'", [orgA])).rows[0].s).toBeNull();
    await as(U.atdA, "select public.conversation_set_mode($1,'c1','ia')", [orgA]);
  });
  it("dois trabalhos na mesma conversa: só um ganha a reserva de envio", async () => {
    const [a, b] = [await job("c1", "wa-m5"), await job("c1", "wa-m6")];
    expect(await claim(a)).toBe(true);
    expect(await claim(b)).toBe(false);
    await db.query("select public.ai_job_release_send($1)", [a]);
  });
  it("cota diária atômica: com limite 3, a 4ª reserva é recusada", async () => {
    const r: boolean[] = [];
    for (let i = 0; i < 4; i++) r.push((await db.query<{ ok: boolean }>("select public.ai_quota_take($1, 3) as ok", [orgA])).rows[0].ok);
    expect(r).toEqual([true, true, true, false]);
    expect(await denied(U.adminA, "select public.ai_quota_take($1, 1000)", [orgA])).toMatch(/permission denied/);
  });
  it("grupo nunca entra em modo IA e o portão recusa trabalho de grupo", async () => {
    await conv("g1", { aiActive: false });
    await db.query("insert into public.conversation_control (organization_id, conversation_id, mode, is_group) values ($1,'g1','humano',true)", [orgA]);
    expect(await denied(U.adminA, "select public.conversation_set_mode($1,'g1','ia')", [orgA])).toMatch(/grupos/);
    await db.query("update public.conversation_control set mode = 'ia' where organization_id = $1 and conversation_id = 'g1'", [orgA]); // estado inválido forçado
    expect(await claim(await job("g1", "wa-g1"))).toBe(false);
  });
  it("versão esperada divergente ⇒ 40001 (outra pessoa mudou antes)", async () => {
    expect(await denied(U.atdA, "select public.conversation_set_mode($1,'c1','humano', 1)", [orgA])).toMatch(/mudou/);
  });
  it("financeiro e outro escritório não mudam o modo; navegador não chama o portão nem lê a fila de eventos", async () => {
    expect(await denied(U.finA, "select public.conversation_set_mode($1,'c1','ia')", [orgA])).toMatch(/permissão/);
    expect(await denied(U.adminB, "select public.conversation_set_mode($1,'c1','ia')", [orgA])).toMatch(/permissão/);
    expect(await denied(U.adminA, "select public.ai_job_claim_send(1)")).toMatch(/permission denied/);
    expect(await denied(U.adminA, "select id from public.wa_events")).toMatch(/permission denied/);
  });
  it("cache antigo do navegador não reativa a IA: gravar aiActive=true sem controle 'ia' é corrigido", async () => {
    await as(U.atdA, "select public.conversation_set_mode($1,'c1','humano')", [orgA]);
    await db.query("update public.org_records set data = data || '{\"aiActive\": true}' where organization_id = $1 and collection = 'conversations' and id = 'c1'", [orgA]);
    expect(await aiActive("c1")).toBe(false);
  });
  it("resolver marca a conversa como encerrada", async () => {
    await as(U.atdA, "select public.conversation_set_mode($1,'c1','resolvido')", [orgA]);
    expect((await db.query<{ s: string }>("select data->>'status' as s from public.org_records where organization_id = $1 and collection = 'conversations' and id = 'c1'", [orgA])).rows[0].s).toBe("encerrada");
  });
});

describe("Atendimento — fila de eventos", () => {
  it("reentrega do mesmo evento é recusada pelo banco (único por instância + tipo + id)", async () => {
    const ins = "insert into public.wa_events (organization_id, instance_name, provider_id, kind, payload) values ($1,'lexsion-esc-a','ABC','messages.upsert','{}')";
    await db.query(ins, [orgA]);
    await expect(db.query(ins, [orgA])).rejects.toThrow(/duplicate key/);
  });
  it("uso de IA aceita as finalidades novas", async () => {
    await db.query("insert into public.ai_usage (organization_id, purpose, model, input_chars, output_chars) values ($1,'atendimento','m',1,1), ($1,'simulador','m',1,1)", [orgA]);
  });
});

describe("Chaves de integração do escritório", () => {
  it("nenhum papel do navegador lê ou grava org_credentials (só o servidor)", async () => {
    await db.query("insert into public.org_credentials (organization_id, provider, sealed, hint) values ($1,'asaas','cifrado','••••1234')", [orgA]);
    expect(await denied(U.adminA, "select sealed from public.org_credentials")).toMatch(/permission denied/);
    expect(await denied(U.adminA, "insert into public.org_credentials (organization_id, provider, sealed, hint) values ($1,'gemini','x','x')", [orgA])).toMatch(/permission denied/);
    expect(await denied(null, "select 1 from public.org_credentials")).toMatch(/permission denied/);
  });
});

