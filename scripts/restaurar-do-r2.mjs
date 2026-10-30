// Prova de restauração a partir do R2: baixa o backup cifrado mais recente (ou o informado), decifra com
// BACKUP_ENCRYPTION_KEY e gera a pasta no formato de backup-logico.mjs para o restaurar-teste.mjs (cópia isolada).
// Também baixa e decifra CADA arquivo do Storage citado no manifesto e confere o SHA-256 (pasta storage/).
// Nunca toca o banco real. Uso: node scripts/restaurar-do-r2.mjs <pasta-fora-do-repo> [chave-do-objeto]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const env = { ...process.env };
if (fs.existsSync(".env.local")) for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m && !env[m[1]]) env[m[1]] = m[2]; }
const out = process.argv[2];
if (!out || path.resolve(out).startsWith(path.resolve("."))) { console.error("uso: node scripts/restaurar-do-r2.mjs <pasta-FORA-do-repositório> [objeto]"); process.exit(2); }
const proxy = env.HTTPS_PROXY ? ["--proxy", env.HTTPS_PROXY] : [];
const s3 = (p) => execFileSync("curl", ["-sS", "--fail", "--ssl-no-revoke", ...proxy, "--aws-sigv4", "aws:amz:auto:s3", "--user", `${env.R2_ACCESS_KEY_ID}:${env.R2_SECRET_ACCESS_KEY}`, `${env.R2_ENDPOINT}/${env.R2_BUCKET}${p}`], { maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "pipe"] });
const k = Buffer.from(env.BACKUP_ENCRYPTION_KEY ?? "", "base64");
const open = (sealed) => {
  if (!sealed.subarray(0, 5).equals(Buffer.from("LXBK1"))) throw new Error("arquivo não é um backup LexSion");
  const d = crypto.createDecipheriv("aes-256-gcm", k, sealed.subarray(5, 17));
  d.setAuthTag(sealed.subarray(17, 33)); // adulterado ou chave errada ⇒ falha aqui
  return zlib.gunzipSync(Buffer.concat([d.update(sealed.subarray(33)), d.final()]));
};
const get = (key) => s3(`/${key.split("/").map(encodeURIComponent).join("/")}`);

let key = process.argv[3];
if (!key) {
  const xml = s3("?list-type=2&prefix=backups/diario/").toString();
  key = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]).sort().at(-1);
  if (!key) { console.error("nenhum backup no R2"); process.exit(1); }
}
const sealed = get(key);
const data = JSON.parse(open(sealed).toString());

const dir = path.join(out, path.basename(key, ".lxbk"));
fs.mkdirSync(dir, { recursive: true });
const migrations = fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).map((f) => f.split("_")[0]);
for (const [t, rows] of Object.entries(data.tables)) fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows));
fs.writeFileSync(path.join(dir, "auth_users.json"), JSON.stringify(data.authUsers));
// Arquivos: cada um decifrado e conferido pelo SHA-256 do manifesto; vão para storage/<bucket>/<caminho>.
const storage = data.manifest.storage ?? [];
let bad = 0;
for (const f of storage) {
  const plain = open(get(f.blob));
  if (crypto.createHash("sha256").update(plain).digest("hex") !== f.sha256 || plain.length !== f.size) { bad++; continue; }
  const dest = path.join(dir, "storage", f.bucket, ...f.name.split("/"));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, plain);
}
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ ...data.manifest, project: "r2", migrations, auth: data.authUsers.length,
  storage: storage.map((f) => ({ name: `${f.bucket}/${f.name}`, bucket: f.bucket, path: f.name, size: f.size, sha256: f.sha256 })) }, null, 2));
console.log(`decifrado: ${key} (${sealed.length} bytes), ${storage.length} arquivo(s), ${bad} com SHA-256 divergente -> ${dir}`);
if (bad) process.exit(1);
console.log(dir);
