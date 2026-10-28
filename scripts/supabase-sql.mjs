// Executa SQL no projeto Supabase pela Management API (token SUPABASE_ACCESS_TOKEN, só no terminal do operador).
// Uso: node scripts/supabase-sql.mjs <arquivo.sql | -e "sql"> [--dry-run]
// --dry-run envolve tudo em BEGIN … ROLLBACK: valida no Postgres real sem gravar nada.
// Nunca imprime credenciais. Lê .env.local se as variáveis não estiverem no ambiente.
import fs from "node:fs";

if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = process.env;
if (!token || !ref) { console.error("Defina SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF (em .env.local, fora do Git)."); process.exit(2); }

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const i = args.indexOf("-e");
let sql = i >= 0 ? args[i + 1] : fs.readFileSync(args.find((a) => !a.startsWith("-")), "utf8");
if (dry) sql = `begin;\n${sql}\n;select 'DRY_RUN_OK' as resultado;\nrollback;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text.length > 4000 ? `${text.slice(0, 4000)}…` : text);
process.exit(res.ok ? 0 : 1);
