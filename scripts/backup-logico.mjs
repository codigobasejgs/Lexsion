// Backup LÓGICO do banco da LexSion (dados das tabelas do app em JSON) pela Management API. Só leitura no banco.
// Uso: node scripts/backup-logico.mjs <pasta-destino-FORA-do-repositório> [--with-files]
// --with-files também baixa os arquivos do Storage privado (contém dados pessoais: guardar cifrado e com acesso restrito).
// Não copia senhas/hashes do Auth (só id e e-mail): contas são recuperadas pelo backup do Supabase ou por novo convite.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret } = process.env;
const out = process.argv[2];
if (!token || !ref || !out) { console.error("uso: node scripts/backup-logico.mjs <pasta-destino> [--with-files]"); process.exit(2); }
if (path.resolve(out).startsWith(path.resolve("."))) { console.error("Destino dentro do repositório: recusado (backup nunca vai para o Git)."); process.exit(2); }

const TABLES = ["organizations", "platform_members", "profiles", "organization_memberships", "collection_policies", "org_records", "portal_links", "platform_records",
  "clients", "client_portal_access", "cases", "portal_updates", "tasks", "documents", "drafts", "audit_logs",
  "whatsapp_instances", "ai_usage", "legal_source_providers", "legal_documents", "legal_document_versions", "legal_updates", "source_sync_runs", "source_sync_cursors", "tenant_legal_preferences", "tenant_alerts"];

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em consulta de backup`);
  return r.json();
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.join(out, `lexsion-${stamp}`);
fs.mkdirSync(dir, { recursive: true });
const manifest = { createdAt: new Date().toISOString(), project: ref, migrations: [], tables: {}, auth: 0, storage: [] };
manifest.migrations = (await q("select version from supabase_migrations.schema_migrations order by version")).map((r) => r.version);
for (const t of TABLES) {
  const rows = await q(`select coalesce(json_agg(t), '[]'::json) as rows from public.${t} t`);
  const data = rows[0].rows;
  fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(data));
  manifest.tables[t] = { rows: data.length, sha256: crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex") };
}
const users = (await q("select coalesce(json_agg(json_build_object('id', id, 'email', email, 'created_at', created_at)), '[]'::json) as rows from auth.users"))[0].rows;
fs.writeFileSync(path.join(dir, "auth_users.json"), JSON.stringify(users));
manifest.auth = users.length;
const objs = (await q("select coalesce(json_agg(json_build_object('name', name, 'size', (metadata->>'size')::bigint, 'mime', metadata->>'mimetype')), '[]'::json) as rows from storage.objects where bucket_id = 'documentos'"))[0].rows;
manifest.storage = objs;
if (process.argv.includes("--with-files") && objs.length) {
  if (!secret || !url) throw new Error("SUPABASE_SECRET_KEY ausente para baixar arquivos");
  for (const o of objs) {
    const r = await fetch(`${url}/storage/v1/object/documentos/${o.name.split("/").map(encodeURIComponent).join("/")}`, { headers: { Authorization: `Bearer ${secret}`, apikey: secret } });
    if (!r.ok) throw new Error(`falha ao baixar um arquivo (HTTP ${r.status})`);
    const p = path.join(dir, "storage", ...o.name.split("/"));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
}
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`backup ok: ${dir}`);
console.log(Object.entries(manifest.tables).map(([t, v]) => `${t}=${v.rows}`).join(" "), `auth=${manifest.auth} storage=${objs.length}`);
