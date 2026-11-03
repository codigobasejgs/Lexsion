import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Contrato SaaS no banco: fluxo de aprovação do modelo, versão aprovada imutável, aceite e arquivos só-acréscimo,
// RLS (titular A não lê contrato de B; anônimo e equipe não leem; plataforma lê), bucket privado.
const U = { sa: "00000000-0000-0000-0000-0000000000aa", ta: "00000000-0000-0000-0000-0000000000e1", tb: "00000000-0000-0000-0000-0000000000e2", adv: "00000000-0000-0000-0000-0000000000e3" };
let db: PGlite, orgA = "", orgB = "", tpl = "";
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec("reset role");
  const sub = user === "service" ? "" : user ?? "";
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub, aal: "aal2" })]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub]);
  if (user !== "service") await db.exec(user ? "set role authenticated" : "set role anon");
  try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
}
const fails = async (user: string | null, sql: string, params: unknown[] = []) => { try { await as(user, sql, params); return "permitido"; } catch (e) { return (e as Error).message; } };
const contract = (org: string | null, n: string) => db.query<{ id: string }>(`insert into public.saas_contracts (number, session_token_sha256, template_version_id, template_status_at_render, plan_id, cycle, amount, plan_snapshot, supplier_snapshot, party, body_text, document_sha256, organization_id)
  values ($1, md5($1), $2, 'PUBLICADO', 'solo', 'mensal', 9990, '{}', '{}', '{"kind":"PF","name":"Teste"}', 'texto', 'h-' || $1, $3) returning id`, [n, tpl, org]).then((r) => r.rows[0].id);

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec("create extension if not exists pgcrypto");
  await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
  for (const f of fs.readdirSync("supabase/migrations").sort()) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
  await db.query("insert into auth.users (id, email) select unnest($1::uuid[]), unnest($2::text[])", [Object.values(U), Object.keys(U).map((k) => `${k}@teste.invalid`)]);
  await db.query("insert into public.platform_members (user_id, role) values ($1, 'superadmin')", [U.sa]);
  orgA = (await db.query<{ id: string }>("insert into public.organizations (slug, name) values ('esc-a','Escritório A') returning id")).rows[0].id;
  orgB = (await db.query<{ id: string }>("insert into public.organizations (slug, name) values ('esc-b','Escritório B') returning id")).rows[0].id;
  await db.query("insert into public.organization_memberships (organization_id, user_id, role) values ($1,$2,'admin'), ($3,$4,'admin'), ($1,$5,'advogado')", [orgA, U.ta, orgB, U.tb, U.adv]);
  tpl = (await db.query<{ id: string }>("insert into public.saas_contract_template_versions (version, title, clauses, content_sha256) values ('t-1','T','[{\"n\":\"1\",\"title\":\"x\",\"body\":\"y\"}]','abc') returning id")).rows[0].id;
}, 60_000);

describe("Modelo de contrato: aprovação jurídica e imutabilidade", () => {
  it("dados da contratada vêm do comprovante de CNPJ (snapshot vigente)", async () => {
    const s = (await db.query<{ legal_name: string; document: string }>("select legal_name, document from public.saas_supplier_profile")).rows[0];
    expect(s).toEqual({ legal_name: "59.760.458 MARCO ANTONIO BOGGIAN", document: "59.760.458/0001-91" });
  });
  it("sem aprovação manual: modelo completo é disponibilizado pela função do servidor (sem nome/OAB); sem pendência", async () => {
    // Função de disponibilização: só o servidor; arquiva a vigente e publica a nova na mesma transação.
    expect(await fails(U.ta, "select public.saas_publish_template('saas-lexsion','x','T','[]','h','motivo ok', null)")).toMatch(/permission denied/);
    await db.query("update public.saas_contract_template_versions set status='PUBLICADO', published_at=now() where id=$1", [tpl]); // rascunho completo publica direto (sem OAB)
    const t2 = (await as<{ id: string }>("service", "select public.saas_publish_template('saas-lexsion','t-2','T','[{\"n\":\"1\",\"title\":\"x\",\"body\":\"y\"}]','h2','nova versão completa', null) id"))[0].id;
    const st = (await db.query<{ id: string; status: string }>("select id, status from public.saas_contract_template_versions where id in ($1,$2)", [tpl, t2])).rows;
    expect(st.find((x) => x.id === tpl)?.status).toBe("ARQUIVADO");
    expect(st.find((x) => x.id === t2)?.status).toBe("PUBLICADO");
    expect((await db.query("select 1 from public.saas_contract_audit where action = 'modelo.disponibilizado'")).rows.length).toBe(1);
    expect((await db.query("select 1 from public.saas_contract_audit where action like 'modelo.aprovad%'")).rows).toEqual([]); // nenhum evento falso de aprovação
    tpl = t2;
  });
  it("versão publicada é imutável (conteúdo) e não pode ser apagada; só uma publicada por vez", async () => {
    expect(await fails("service", "update public.saas_contract_template_versions set clauses='[]' where id=$1", [tpl])).toMatch(/imutável/);
    expect(await fails("service", "delete from public.saas_contract_template_versions where id=$1", [tpl])).toMatch(/rascunho/);
    const t3 = (await db.query<{ id: string }>("insert into public.saas_contract_template_versions (version, title, clauses, content_sha256, status) values ('t-3','T','[]','d','RASCUNHO') returning id")).rows[0].id;
    expect(await fails("service", "update public.saas_contract_template_versions set status='PUBLICADO' where id=$1", [t3])).toMatch(/duplicate key|unique/);
  });
});

describe("Texto com pendência não é disponibilizado (CT-02)", () => {
  it("texto com [PENDENTE] nunca é disponibilizado (nem por update, nem pela função)", async () => {
    const pend = (await db.query<{ id: string }>(`insert into public.saas_contract_template_versions (version, title, clauses, content_sha256) values ('p-1','T','[{"n":"1","title":"x","body":"[PENDENTE: foro]"}]','p') returning id`)).rows[0].id;
    expect(await fails("service", "update public.saas_contract_template_versions set status='PUBLICADO' where id=$1", [pend])).toMatch(/\[PENDENTE\]/);
    expect(await fails("service", "select public.saas_publish_template('saas-lexsion','p-2','T','[{\"body\":\"[PENDENTE: x]\"}]','h','motivo válido', null)")).toMatch(/\[PENDENTE\]/);
  });
  it("interesse em contratar: e-mail único, sem leitura pública; titular comum não lê", async () => {
    await db.query("insert into public.saas_signup_interests (email, name, consent_at) values ('a@x.test','Ana Teste',now())");
    expect(await fails("service", "insert into public.saas_signup_interests (email, name, consent_at) values ('a@x.test','Ana 2',now())")).toMatch(/duplicate key|unique/);
    expect(await fails("service", "insert into public.saas_signup_interests (email, name, consent_at) values ('A@X.test','Ana 3',now())")).toMatch(/check/);
    expect(await as(U.ta, "select id from public.saas_signup_interests")).toEqual([]);
    expect(await fails(null, "select id from public.saas_signup_interests")).toMatch(/permission denied/);
  });
});

describe("Aceite, arquivos e auditoria", () => {
  it("aceite é único por contrato e só-acréscimo (não altera nem apaga)", async () => {
    const c = await contract(orgA, "LX-A-1");
    const ins = `insert into public.saas_contract_acceptances (contract_id, document_sha256, template_version_id, email, signer_name, otp_id) values ($1,'h',$2,'a@x','A',gen_random_uuid())`;
    await db.query(ins, [c, tpl]);
    expect(await fails("service", ins, [c, tpl])).toMatch(/duplicate key|unique/);
    expect(await fails("service", "update public.saas_contract_acceptances set email='outro@x'")).toMatch(/só-acréscimo/);
    expect(await fails("service", "delete from public.saas_contract_acceptances")).toMatch(/só-acréscimo/);
    await db.query("insert into public.saas_contract_files (contract_id, kind, storage_path, sha256, bytes) values ($1,'contrato_aceito','LX-A-1/c.pdf','s',10)", [c]);
    expect(await fails("service", "update public.saas_contract_files set sha256='x'")).toMatch(/só-acréscimo/);
    await db.query("insert into public.saas_contract_audit (contract_id, action) values ($1,'teste')", [c]);
    expect(await fails("service", "delete from public.saas_contract_audit")).toMatch(/só-acréscimo/);
  });
  it("RLS: titular A lê só o contrato de A; titular B, equipe (advogado) e anônimo não leem; plataforma lê tudo", async () => {
    await contract(orgB, "LX-B-1");
    expect((await as<{ number: string }>(U.ta, "select number from public.saas_contracts")).map((r) => r.number)).toEqual(["LX-A-1"]);
    expect((await as<{ number: string }>(U.tb, "select number from public.saas_contracts")).map((r) => r.number)).toEqual(["LX-B-1"]);
    expect(await as(U.adv, "select number from public.saas_contracts")).toEqual([]);
    expect(await fails(null, "select number from public.saas_contracts")).toMatch(/permission denied/);
    expect((await as(U.ta, "select id from public.saas_contract_acceptances")).length).toBe(1);
    expect(await as(U.tb, "select id from public.saas_contract_acceptances")).toEqual([]);
    expect((await as(U.sa, "select number from public.saas_contracts")).length).toBe(2);
  });
  it("navegador não escreve nada; OTP e modelos não são legíveis pelo titular; plataforma não altera aceite", async () => {
    expect(await fails(U.ta, "update public.saas_contracts set amount = 100")).toMatch(/permission denied/);
    expect(await fails(U.sa, "insert into public.saas_contract_acceptances (contract_id, document_sha256, template_version_id, email, signer_name, otp_id) values (gen_random_uuid(),'h',gen_random_uuid(),'a','A',gen_random_uuid())")).toMatch(/permission denied/);
    expect(await fails(U.ta, "select id from public.saas_contract_otps")).toMatch(/permission denied/);
    expect(await as(U.ta, "select id from public.saas_contract_template_versions")).toEqual([]);
    expect(await as(U.ta, "select id from public.saas_supplier_profile")).toEqual([]);
  });
  it("bucket de contratos é privado e separado do bucket de documentos dos escritórios", async () => {
    expect((await db.query<{ public: boolean }>("select public from storage.buckets where id='contratos-saas'")).rows[0].public).toBe(false);
  });
});

describe("Reconciliação de prévias presas (dry run antes de aplicar)", () => {
  it("prévia antiga do mesmo titular/plano vira SUPERSEDED; vencida vira EXPIRED; aceita/vinculada nunca muda; dry run não altera", async () => {
    const mk = (n: string, email: string, ago: string, extra = "") => db.query(`insert into public.saas_contracts (number, session_token_sha256, template_version_id, template_status_at_render, plan_id, cycle, amount, plan_snapshot, supplier_snapshot, party, created_at, expires_at, status${extra ? ", accepted_at" : ""})
      values ($1, md5($1), $2, 'REVISAO_JURIDICA', 'solo', 'mensal', 9990, '{}', '{}', jsonb_build_object('kind','PF','email',$3::text,'cpf','52998224725'), now() - $4::interval, now() - $4::interval + interval '7 days', 'READY_FOR_REVIEW'${extra ? ", now()" : ""})`, [n, tpl, email, ago]);
    await mk("R-OLD", "r@x.test", "3 days"); await mk("R-NEW", "r@x.test", "1 day"); await mk("R-EXP", "s@x.test", "10 days"); await mk("R-ACC", "r@x.test", "5 days", "acc");
    const dry = await as<{ number: string; classe: string; acao: string }>("service", "select contrato number, classe, acao from public.saas_reconcile_contracts(false) where contrato like 'R-%'");
    expect(Object.fromEntries(dry.map((r) => [r.number, r.classe]))).toEqual({ "R-OLD": "substituido", "R-NEW": "em_andamento", "R-EXP": "expirado", "R-ACC": "aceito_ou_vinculado" });
    expect((await db.query<{ s: string }>("select status s from public.saas_contracts where number = 'R-OLD'")).rows[0].s).toBe("READY_FOR_REVIEW"); // dry run não muda
    await as("service", "select * from public.saas_reconcile_contracts(true)");
    const st = Object.fromEntries((await db.query<{ number: string; status: string; sb: string | null }>("select c.number, c.status, (select number from public.saas_contracts n where n.id = c.superseded_by) sb from public.saas_contracts c where c.number like 'R-%'")).rows.map((r) => [r.number, `${r.status}${r.sb ? `>${r.sb}` : ""}`]));
    expect(st).toEqual({ "R-OLD": "SUPERSEDED>R-NEW", "R-NEW": "READY_FOR_REVIEW", "R-EXP": "EXPIRED", "R-ACC": "READY_FOR_REVIEW" });
    expect(await fails(U.ta, "select * from public.saas_reconcile_contracts(true)")).toMatch(/permission denied/);
  });
});
