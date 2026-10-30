// Prova de RESTAURAÇÃO numa cópia ISOLADA (Postgres local em memória, PGlite): aplica as migrations do repositório,
// carrega o backup lógico, confere contagens/hash por tabela e que a RLS continua isolando escritórios. Nunca toca o banco real.
// Uso: node scripts/restaurar-teste.mjs <pasta-do-backup>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, "manifest.json"))) { console.error("uso: node scripts/restaurar-teste.mjs <pasta-do-backup>"); process.exit(2); }
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec("create extension if not exists pgcrypto");
await db.exec(fs.readFileSync("supabase/tests/stub-supabase.sql", "utf8"));
const migs = fs.readdirSync("supabase/migrations").sort();
// pg_cron/pg_net existem só no Supabase: o stub cria o mínimo e a linha "create extension" é ignorada aqui.
for (const f of migs) await db.exec(fs.readFileSync(path.join("supabase/migrations", f), "utf8").replace(/^create extension if not exists (pg_cron|pg_net);.*$/gm, ""));
const local = migs.map((f) => f.split("_")[0]);
const missing = manifest.migrations.filter((v) => !local.includes(v));
if (missing.length) throw new Error(`backup tem migrations que o repositório não tem: ${missing.join(",")}`);

// Contas (só id/e-mail) e Storage (só metadados) para as FKs; arquivos são conferidos à parte.
const users = JSON.parse(fs.readFileSync(path.join(dir, "auth_users.json"), "utf8"));
if (users.length) await db.query("insert into auth.users (id, email) select (u->>'id')::uuid, u->>'email' from json_array_elements($1::json) u", [JSON.stringify(users)]);
await db.exec("set session_replication_role = replica"); // sem triggers na carga (auditoria e guardas não reescrevem o histórico)
const ORDER = ["organizations", "platform_members", "profiles", "organization_memberships", "collection_policies", "org_records", "portal_links", "platform_records",
  "clients", "client_portal_access", "cases", "portal_updates", "tasks", "documents", "drafts", "audit_logs",
  "whatsapp_instances", "ai_usage", "legal_source_providers", "legal_documents", "legal_document_versions", "legal_updates", "source_sync_runs", "source_sync_cursors", "tenant_legal_preferences", "tenant_alerts",
  "org_role_restrictions", "org_member_restrictions", "saas_plans", "saas_contract_template_versions", "saas_supplier_profile", "saas_contracts", "saas_orders", "saas_subscriptions", "saas_webhook_events",
  "saas_contract_acceptances", "saas_contract_files", "saas_contract_audit"];
// Backup antigo (antes destas tabelas existirem) é aceito: a tabela ausente fica vazia e o relatório mostra "--".
const present = (t) => fs.existsSync(path.join(dir, `${t}.json`));
// Catálogos que a migration já semeia vêm do backup (mesmo conteúdo): limpa antes para não duplicar.
await db.exec("delete from public.collection_policies; delete from public.legal_source_providers");
if (present("saas_plans")) await db.exec("delete from public.saas_plans");
if (present("saas_supplier_profile")) await db.exec("delete from public.saas_supplier_profile");
for (const t of ORDER) {
  if (!present(t)) continue;
  const rows = JSON.parse(fs.readFileSync(path.join(dir, `${t}.json`), "utf8"));
  if (!rows.length) continue;
  const over = ["audit_logs", "ai_usage", "source_sync_runs", "saas_webhook_events", "saas_contract_acceptances", "saas_contract_audit"].includes(t) ? "overriding system value" : "";
  // Colunas geradas (ex.: índice de busca) são recalculadas pelo banco: ficam fora da lista do insert.
  const cols = (await db.query(`select string_agg(quote_ident(column_name), ',' order by ordinal_position) c from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER'`, [t])).rows[0].c;
  await db.query(`insert into public.${t} (${cols}) ${over} select ${cols} from json_populate_recordset(null::public.${t}, $1::json)`, [JSON.stringify(rows)]);
}
await db.exec("set session_replication_role = origin");

let ok = true;
for (const t of ORDER) {
  if (!manifest.tables[t]) { console.log(`--  ${t}: não estava neste backup`); continue; }
  const back = (await db.query(`select coalesce(json_agg(t), '[]'::json) as rows from public.${t} t`)).rows[0].rows;
  const n = back.length, exp = manifest.tables[t].rows;
  const same = n === exp;
  if (!same) ok = false;
  console.log(`${same ? "OK " : "ERRO"} ${t}: ${n}/${exp}`);
}
// RLS continua valendo na cópia: um membro de um escritório não lê registros de outro.
const pair = (await db.query("select a.user_id, b.id as organization_id from public.organization_memberships a, public.organizations b where exists (select 1 from public.org_records r where r.organization_id = b.id) and not exists (select 1 from public.organization_memberships x where x.user_id = a.user_id and x.organization_id = b.id) limit 1")).rows[0];
if (pair) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [pair.user_id]);
  await db.exec("set role authenticated");
  const leak = (await db.query("select count(*)::int n from public.org_records where organization_id = $1", [pair.organization_id])).rows[0].n;
  await db.exec("reset role");
  console.log(`${leak === 0 ? "OK " : "ERRO"} RLS na cópia restaurada: membro de outro escritório lê ${leak} registro(s)`);
  if (leak) ok = false;
} else console.log("--  RLS: backup sem par de escritórios para conferir isolamento");
const files = manifest.storage ?? [];
const sdir = path.join(dir, "storage");
const fileAt = (name) => path.join(sdir, ...name.split("/"));
if (files.length && fs.existsSync(sdir)) {
  // Tamanho e, quando o manifesto tem, SHA-256 de cada arquivo restaurado.
  const good = files.filter((o) => fs.existsSync(fileAt(o.name)) && fs.statSync(fileAt(o.name)).size === Number(o.size)
    && (!o.sha256 || crypto.createHash("sha256").update(fs.readFileSync(fileAt(o.name))).digest("hex") === o.sha256)).length;
  console.log(`${good === files.length ? "OK " : "ERRO"} arquivos do Storage: ${good}/${files.length} com tamanho${files[0]?.sha256 ? " e SHA-256" : ""} conferidos`);
  if (good !== files.length) ok = false;
} else console.log(`--  arquivos do Storage: ${files.length} no manifesto${files.length ? " (backup sem --with-files)" : ""}`);
// Correspondência banco ⇄ arquivos: todo documento/arquivo registrado no banco tem o arquivo restaurado.
const refs = (await db.query(`select 'documentos/' || storage_path p from public.documents where storage_path is not null
  union select 'documentos/' || (data->>'path') from public.org_records where collection = 'files' and data->>'path' is not null`)).rows.map((r) => r.p);
const have = new Set(files.map((o) => o.name));
const orphan = refs.filter((p) => !have.has(p) || !fs.existsSync(fileAt(p))).length;
console.log(`${orphan ? "ERRO" : "OK "} banco ⇄ arquivos: ${refs.length - orphan}/${refs.length} registro(s) de documento com arquivo restaurado`);
if (orphan) ok = false;
console.log(ok ? "RESTAURACAO_OK" : "RESTAURACAO_FALHOU");
process.exit(ok ? 0 : 1);
