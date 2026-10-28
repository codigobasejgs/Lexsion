// Aplica migrations pendentes de supabase/migrations no projeto (Management API), uma transação por arquivo,
// registrando em supabase_migrations.schema_migrations (mesma tabela do `supabase db push`). Idempotente:
// arquivos já registrados são pulados. Uso: node scripts/supabase-migrate.mjs [--dry-run]
import fs from "node:fs";
import path from "node:path";

if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = process.env;
if (!token || !ref) { console.error("Defina SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF."); process.exit(2); }
const dry = process.argv.includes("--dry-run");

async function q(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 1500)}`);
  return JSON.parse(t);
}
const lit = (s) => `'${s.replace(/'/g, "''")}'`;

await q("create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)");
const done = new Set((await q("select version from supabase_migrations.schema_migrations")).map((r) => r.version));
const files = fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
  if (done.has(version)) { console.log(`= ${f} (já aplicada)`); continue; }
  const sql = fs.readFileSync(path.join("supabase/migrations", f), "utf8");
  const record = `insert into supabase_migrations.schema_migrations (version, name, statements) values (${lit(version)}, ${lit(rest.join("_"))}, array[${lit(sql)}]);`;
  await q(`begin;\n${sql}\n;${record}\n${dry ? "rollback" : "commit"};`);
  console.log(`${dry ? "~ (dry-run, revertida)" : "+ aplicada"} ${f}`);
}
