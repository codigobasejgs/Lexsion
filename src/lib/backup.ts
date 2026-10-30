import "server-only";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { r2List, r2Request } from "@/lib/r2";

// Backup lógico DIÁRIO, cifrado, fora do Supabase (Cloudflare R2, bucket privado). Substitui o PITR (plano Free).
// Formato: JSON (tabelas + manifesto com contagem e SHA-256 por tabela) → gzip → AES-256-GCM.
// A chave (BACKUP_ENCRYPTION_KEY, 32 bytes em base64) fica SÓ no servidor e com o dono; nunca no R2 nem no Git.
// Sem a chave o arquivo é ilegível: guardar uma cópia dela fora do computador (cofre de senhas).
// Arquivos do Storage: cópia INCREMENTAL e cifrada por arquivo (backups/arquivos/). Só baixa o que é novo ou mudou
// (índice cifrado guarda tamanho+data de cada objeto): o egress do plano Free (5 GB/mês) não é consumido todo dia.
// O nome do objeto no R2 é um HMAC do conteúdo com a chave: não revela nome, escritório nem conteúdo.
export const TABLES = ["organizations", "platform_members", "profiles", "organization_memberships", "collection_policies", "org_records", "portal_links", "platform_records",
  "clients", "client_portal_access", "cases", "portal_updates", "tasks", "documents", "drafts", "audit_logs",
  "whatsapp_instances", "ai_usage", "legal_source_providers", "legal_documents", "legal_document_versions", "legal_updates", "source_sync_runs", "source_sync_cursors", "tenant_legal_preferences", "tenant_alerts",
  "org_role_restrictions", "org_member_restrictions",
  "saas_plans", "saas_orders", "saas_subscriptions", "saas_webhook_events"];
const PREFIX = "backups/diario/";
const FILES = "backups/arquivos/";
const INDEX = `${FILES}indice.lxbk`;
const KEEP = 30;
const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
type FileEntry = { bucket: string; name: string; size: number; sha256: string; blob: string };
// objects: último estado conhecido de cada arquivo; blobs: última vez que cada cópia foi citada por um manifesto.
// A retenção olha `blobs` (não `objects`): arquivo substituído continua guardado enquanto um manifesto antigo o citar.
type Index = { objects: Record<string, { stamp: string; sha256: string; blob: string; sealed: number }>; blobs: Record<string, string> };
const MAGIC = Buffer.from("LXBK1"); // cabeçalho: versão do formato

function key(): Buffer {
  const k = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY ausente ou inválida (32 bytes em base64)");
  return k;
}

export function seal(plain: Buffer, k = key()): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([c.update(zlib.gzipSync(plain)), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

export function open(sealed: Buffer, k = key()): Buffer {
  if (!sealed.subarray(0, 5).equals(MAGIC)) throw new Error("arquivo não é um backup LexSion");
  const d = crypto.createDecipheriv("aes-256-gcm", k, sealed.subarray(5, 17));
  d.setAuthTag(sealed.subarray(17, 33)); // adulteração ou chave errada ⇒ falha aqui
  return zlib.gunzipSync(Buffer.concat([d.update(sealed.subarray(33)), d.final()]));
}

async function readTable(t: string): Promise<unknown[]> {
  const db = supabaseAdmin();
  const out: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(t).select("*").range(from, from + 999);
    if (error) throw new Error(`leitura de ${t}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function getSealed(key: string): Promise<Buffer | null> {
  const r = await r2Request("GET", key);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`leitura no R2 falhou (HTTP ${r.status})`);
  return open(Buffer.from(await r.arrayBuffer()));
}
async function putSealed(key: string, plain: Buffer): Promise<number> {
  const sealed = seal(plain);
  const put = await r2Request("PUT", key, { body: sealed, contentType: "application/octet-stream" });
  if (!put.ok) throw new Error(`envio ao R2 falhou (HTTP ${put.status})`);
  return sealed.length;
}

/** Copia os arquivos do Storage (incremental), conferindo cada arquivo NOVO na volta (decifra + SHA-256). */
async function backupFiles(now: string) {
  const db = supabaseAdmin();
  const { data: objs, error } = await db.rpc("backup_storage_index");
  if (error) throw new Error(`índice do Storage: ${error.message}`);
  const index: Index = { objects: {}, blobs: {}, ...JSON.parse((await getSealed(INDEX))?.toString() ?? "{}") };
  const inR2 = new Map((await r2List(FILES)).map((o) => [o.key, o.size]));
  const files: FileEntry[] = [];
  let uploaded = 0, uploadedBytes = 0;
  for (const o of (objs ?? []) as { bucket_id: string; name: string; size: number; updated_at: string }[]) {
    const id = `${o.bucket_id}/${o.name}`, stamp = `${o.size}@${o.updated_at}`;
    const prev = index.objects[id];
    if (prev && prev.stamp === stamp && inR2.get(prev.blob) === prev.sealed) { // inalterado e a cópia existe com o tamanho certo
      index.blobs[prev.blob] = now;
      files.push({ bucket: o.bucket_id, name: o.name, size: Number(o.size), sha256: prev.sha256, blob: prev.blob });
      continue;
    }
    const { data, error: dlErr } = await db.storage.from(o.bucket_id).download(o.name);
    if (dlErr || !data) throw new Error(`download de arquivo do bucket ${o.bucket_id} falhou`); // sem o nome: pode conter dado pessoal
    const buf = Buffer.from(await data.arrayBuffer());
    if (buf.length !== Number(o.size)) throw new Error(`arquivo do bucket ${o.bucket_id} com tamanho divergente do índice`);
    const sum = sha256(buf);
    const blob = `${FILES}${crypto.createHmac("sha256", key()).update(sum).digest("hex")}.lxbk`;
    let sealedLen = inR2.get(blob);
    if (sealedLen == null) {
      sealedLen = await putSealed(blob, buf);
      const back = await getSealed(blob);
      if (!back || sha256(back) !== sum) throw new Error("conferência de arquivo falhou (SHA-256)");
      inR2.set(blob, sealedLen);
      uploaded++; uploadedBytes += sealedLen;
    }
    index.objects[id] = { stamp, sha256: sum, blob, sealed: sealedLen };
    index.blobs[blob] = now;
    files.push({ bucket: o.bucket_id, name: o.name, size: buf.length, sha256: sum, blob });
  }
  return { files, index, inR2, uploaded, uploadedBytes };
}

/** Gera, cifra, envia, confere a volta (baixa e decifra) e aplica a retenção. Banco E arquivos do Storage. */
export async function runBackup() {
  const t0 = Date.now();
  const startedAt = new Date().toISOString();
  const fb = await backupFiles(startedAt);
  const tables: Record<string, unknown[]> = {};
  const manifest: { createdAt: string; tables: Record<string, { rows: number; sha256: string }>; storage: FileEntry[] } = { createdAt: startedAt, tables: {}, storage: fb.files };
  for (const t of TABLES) {
    tables[t] = await readTable(t);
    manifest.tables[t] = { rows: tables[t].length, sha256: crypto.createHash("sha256").update(JSON.stringify(tables[t])).digest("hex") };
  }
  const { data: users } = await supabaseAdmin().auth.admin.listUsers({ perPage: 1000 });
  const authUsers = (users?.users ?? []).map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })); // sem senhas
  const sealed = seal(Buffer.from(JSON.stringify({ manifest, tables, authUsers })));
  const name = `${PREFIX}lexsion-${manifest.createdAt.replace(/[:.]/g, "-")}.lxbk`;
  const put = await r2Request("PUT", name, { body: sealed, contentType: "application/octet-stream" });
  if (!put.ok) throw new Error(`envio ao R2 falhou (HTTP ${put.status})`);
  // Verificação de ida e volta: o que está no R2 decifra e bate com o manifesto.
  const back = await r2Request("GET", name);
  if (!back.ok) throw new Error(`leitura de volta falhou (HTTP ${back.status})`);
  const restored = JSON.parse(open(Buffer.from(await back.arrayBuffer())).toString()) as { tables: Record<string, unknown[]>; manifest: { storage: FileEntry[] } };
  const mismatch = TABLES.filter((t) => crypto.createHash("sha256").update(JSON.stringify(restored.tables[t])).digest("hex") !== manifest.tables[t].sha256);
  if (mismatch.length) throw new Error(`conferência falhou: ${mismatch.join(", ")}`);
  // Todo arquivo citado no manifesto existe no R2 (cópia nova conferida acima; antiga conferida por tamanho).
  const missing = restored.manifest.storage.filter((f) => !fb.inR2.has(f.blob)).length;
  if (missing) throw new Error(`backup incompleto: ${missing} arquivo(s) sem cópia no R2`);
  await putSealed(INDEX, Buffer.from(JSON.stringify(fb.index)));
  // Retenção SÓ depois do backup novo conferido: mantém os KEEP manifestos mais recentes.
  const all = (await r2List(PREFIX)).sort((a, b) => b.key.localeCompare(a.key));
  let removed = 0;
  for (const o of all.slice(KEEP)) { if ((await r2Request("DELETE", o.key)).ok) removed++; }
  // Arquivo só sai do R2 quando nenhum manifesto guardado pode citá-lo: não visto desde antes do manifesto mais antigo mantido.
  const oldestKept = all.slice(0, KEEP).at(-1)?.key.match(/lexsion-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)?.[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3") ?? startedAt;
  // Cópia desconhecida do índice (ex.: envio interrompido) não é apagada aqui: só o que o índice sabe que expirou.
  let removedFiles = 0;
  for (const [blob, seen] of Object.entries(fb.index.blobs)) {
    if (seen >= oldestKept) continue;
    if (fb.inR2.has(blob) && !(await r2Request("DELETE", blob)).ok) continue;
    delete fb.index.blobs[blob];
    for (const [id, e] of Object.entries(fb.index.objects)) if (e.blob === blob) delete fb.index.objects[id];
    removedFiles++;
  }
  if (removedFiles) await putSealed(INDEX, Buffer.from(JSON.stringify(fb.index)));
  const rows = Object.values(manifest.tables).reduce((s, v) => s + v.rows, 0);
  const fileBytes = fb.files.reduce((s, f) => s + f.size, 0);
  return { name, bytes: sealed.length, rows, tables: TABLES.length, files: fb.files.length, fileBytes, filesUploaded: fb.uploaded, kept: Math.min(all.length, KEEP), removed, removedFiles, verified: true, ms: Date.now() - t0 };
}
