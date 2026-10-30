import "server-only";
import crypto from "node:crypto";

// Cliente mínimo do Cloudflare R2 (API S3) com assinatura AWS SigV4 em crypto nativo — sem SDK.
// ponytail: só PUT/GET/DELETE/LIST de objeto; multipart (arquivos > 100 MB) fica para quando um backup chegar lá.
// Chaves só no servidor (R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY); bucket privado, nunca exposto ao navegador.
const REGION = "auto";
const sha256 = (d: crypto.BinaryLike) => crypto.createHash("sha256").update(d).digest("hex");
const hmac = (k: crypto.BinaryLike, d: string) => crypto.createHmac("sha256", k).update(d).digest();
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export function r2Config() {
  const { R2_ENDPOINT: endpoint, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: keyId, R2_SECRET_ACCESS_KEY: secret } = process.env;
  if (!endpoint || !bucket || !keyId || !secret) return null;
  return { endpoint: endpoint.replace(/\/$/, ""), bucket, keyId, secret };
}

/** Requisição S3 assinada. `key` é o caminho do objeto (sem barra inicial); `query` para listagem. */
export async function r2Request(method: "GET" | "PUT" | "DELETE" | "HEAD", key: string, opts: { body?: Uint8Array; query?: Record<string, string>; contentType?: string } = {}) {
  const c = r2Config();
  if (!c) throw new Error("R2 não configurado no servidor");
  const host = new URL(c.endpoint).host;
  const path = `/${c.bucket}${key ? `/${key.split("/").map(enc).join("/")}` : ""}`;
  const qs = Object.entries(opts.query ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${enc(k)}=${enc(v)}`).join("&");
  const body = opts.body ?? new Uint8Array();
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (opts.contentType) headers["content-type"] = opts.contentType;
  const signed = Object.keys(headers).sort();
  const canonical = [method, path, qs, signed.map((h) => `${h}:${headers[h]}\n`).join(""), signed.join(";"), payloadHash].join("\n");
  const scope = `${day}/${REGION}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const kSign = hmac(hmac(hmac(hmac(`AWS4${c.secret}`, day), REGION), "s3"), "aws4_request");
  const signature = crypto.createHmac("sha256", kSign).update(toSign).digest("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${c.keyId}/${scope}, SignedHeaders=${signed.join(";")}, Signature=${signature}`;
  const { host: _h, ...send } = headers;
  void _h;
  return fetch(`${c.endpoint}${path}${qs ? `?${qs}` : ""}`, { method, headers: { ...send, Authorization: auth }, body: method === "PUT" ? Buffer.from(body) : undefined, signal: AbortSignal.timeout(120_000) });
}

/** Lista TODOS os objetos sob um prefixo (pagina de 1000 em 1000). */
export async function r2List(prefix: string) {
  const out: { key: string; size: number; lastModified: string }[] = [];
  let token = "";
  do {
    const r = await r2Request("GET", "", { query: { "list-type": "2", prefix, "max-keys": "1000", ...(token ? { "continuation-token": token } : {}) } });
    if (!r.ok) throw new Error(`R2 respondeu HTTP ${r.status} ao listar`);
    const xml = await r.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) out.push({
      key: /<Key>([^<]+)<\/Key>/.exec(m[1])![1].replace(/&amp;/g, "&"),
      size: Number(/<Size>(\d+)<\/Size>/.exec(m[1])?.[1] ?? 0),
      lastModified: /<LastModified>([^<]+)<\/LastModified>/.exec(m[1])?.[1] ?? "",
    });
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([^<]+)</.exec(xml)?.[1] ?? "") : "";
  } while (token);
  return out;
}
