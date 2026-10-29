import "server-only";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { r2List, r2Request } from "@/lib/r2";

// Backup lógico DIÁRIO, cifrado, fora do Supabase (Cloudflare R2, bucket privado). Substitui o PITR (plano Free).
// Formato: JSON (tabelas + manifesto com contagem e SHA-256 por tabela) → gzip → AES-256-GCM.
// A chave (BACKUP_ENCRYPTION_KEY, 32 bytes em base64) fica SÓ no servidor e com o dono; nunca no R2 nem no Git.
// Sem a chave o arquivo é ilegível: guardar uma cópia dela fora do computador (cofre de senhas).
// ponytail: arquivos do Storage não entram (bucket "documentos" vazio hoje); copiar quando houver documentos reais.
export const TABLES = ["organizations", "platform_members", "profiles", "organization_memberships", "collection_policies", "org_records", "portal_links", "platform_records",
  "clients", "client_portal_access", "cases", "portal_updates", "tasks", "documents", "drafts", "audit_logs",
  "whatsapp_instances", "ai_usage", "legal_source_providers", "legal_documents", "legal_document_versions", "legal_updates", "source_sync_runs", "source_sync_cursors", "tenant_legal_preferences", "tenant_alerts"];
const PREFIX = "backups/diario/";
const KEEP = 30;
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

/** Gera, cifra, envia, confere a volta (baixa e decifra) e aplica a retenção. */
export async function runBackup() {
  const t0 = Date.now();
  const tables: Record<string, unknown[]> = {};
  const manifest: { createdAt: string; tables: Record<string, { rows: number; sha256: string }> } = { createdAt: new Date().toISOString(), tables: {} };
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
  const restored = JSON.parse(open(Buffer.from(await back.arrayBuffer())).toString()) as { tables: Record<string, unknown[]> };
  const mismatch = TABLES.filter((t) => crypto.createHash("sha256").update(JSON.stringify(restored.tables[t])).digest("hex") !== manifest.tables[t].sha256);
  if (mismatch.length) throw new Error(`conferência falhou: ${mismatch.join(", ")}`);
  // Retenção: mantém os KEEP mais recentes.
  const all = (await r2List(PREFIX)).sort((a, b) => b.key.localeCompare(a.key));
  let removed = 0;
  for (const o of all.slice(KEEP)) { if ((await r2Request("DELETE", o.key)).ok) removed++; }
  const rows = Object.values(manifest.tables).reduce((s, v) => s + v.rows, 0);
  return { name, bytes: sealed.length, rows, tables: TABLES.length, kept: Math.min(all.length, KEEP), removed, verified: true, ms: Date.now() - t0 };
}
