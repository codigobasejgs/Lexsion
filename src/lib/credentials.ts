import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ProviderId } from "@/domain/integrations";

// Chaves de integração do escritório: cifradas aqui (AES-256-GCM, CREDENTIALS_KEY de 32 bytes, só no servidor)
// antes de ir ao banco. Nunca voltam ao navegador; a tela só vê o final da chave e o resultado do teste.
function key() {
  const k = Buffer.from(process.env.CREDENTIALS_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("CREDENTIALS_KEY ausente ou inválida no servidor");
  return k;
}
export function sealSecret(plain: string, k = key()) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}
export function openSecret(sealed: string, k = key()) {
  const b = Buffer.from(sealed, "base64"), d = crypto.createDecipheriv("aes-256-gcm", k, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
export const hint = (s: string) => `••••${s.slice(-4)}`;

type Check = { status: "verificada" | "recusada" | "nao_verificavel"; detail: string };
const get = (url: string, headers: Record<string, string>) => fetch(url, { headers, signal: AbortSignal.timeout(20_000), cache: "no-store" }).catch(() => null);

/** Testa a chave no PROVEDOR REAL, com chamada só de leitura (nada é cobrado, enviado ou assinado). */
export async function testCredential(p: ProviderId, secret: string, env: "producao" | "teste"): Promise<Check> {
  if (p === "gemini") {
    // Gera 1 token: além da chave, revela falta de crédito/faturamento (402/429), que a listagem de modelos não mostra.
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", { method: "POST", headers: { "x-goog-api-key": secret, "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ok" }] }], generationConfig: { maxOutputTokens: 1 } }), signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!r) return { status: "recusada", detail: "O Google não respondeu. Tente de novo." };
    if (r.ok) return { status: "verificada", detail: "Chave aceita e com crédito disponível." };
    if (r.status === 400 || r.status === 403) return { status: "recusada", detail: "Chave inválida ou sem permissão para a Gemini API." };
    if (r.status === 402) return { status: "recusada", detail: "Chave válida, mas o projeto está sem créditos. Recarregue em ai.studio → Billing." };
    if (r.status === 429) return { status: "recusada", detail: "Chave válida, mas a cota do projeto acabou. Ative o faturamento ou aguarde a renovação." };
    return { status: "recusada", detail: `O Google recusou (HTTP ${r.status}).` };
  }
  if (p === "asaas") {
    const base = env === "teste" ? "https://api-sandbox.asaas.com" : "https://api.asaas.com";
    const r = await get(`${base}/v3/myAccount`, { access_token: secret });
    return r?.ok ? { status: "verificada", detail: `Conta Asaas (${env === "teste" ? "sandbox" : "produção"}) acessada.` } : { status: "recusada", detail: r ? `O Asaas recusou a chave (HTTP ${r.status}). Confira se é do ambiente escolhido.` : "O Asaas não respondeu." };
  }
  if (p === "mercadopago") {
    const r = await get("https://api.mercadopago.com/users/me", { Authorization: `Bearer ${secret}` });
    return r?.ok ? { status: "verificada", detail: "Conta Mercado Pago acessada." } : { status: "recusada", detail: r ? `O Mercado Pago recusou o Access Token (HTTP ${r.status}).` : "O Mercado Pago não respondeu." };
  }
  if (p === "zapsign") {
    const base = env === "teste" ? "https://sandbox.api.zapsign.com.br" : "https://api.zapsign.com.br";
    const r = await get(`${base}/api/v1/docs/?page=1`, { Authorization: `Bearer ${secret}` });
    return r?.ok ? { status: "verificada", detail: `Conta ZapSign (${env === "teste" ? "sandbox" : "produção"}) acessada.` } : { status: "recusada", detail: r ? `A ZapSign recusou o token (HTTP ${r.status}). Confira o ambiente.` : "A ZapSign não respondeu." };
  }
  // InfinitePay: a API pública não tem consulta de conta; testar exigiria criar um link de cobrança real.
  return /^[a-z0-9._-]{3,40}$/i.test(secret.replace(/^\$/, "")) ? { status: "nao_verificavel", detail: "Handle salva. A InfinitePay não oferece teste sem criar cobrança; confira a handle no app InfinitePay." } : { status: "recusada", detail: "Handle inválida (use só letras, números, ponto ou hífen)." };
}

/** Chave do escritório, já decifrada, só para uso no servidor. null se não houver ou se foi recusada no teste. */
export async function officeSecret(org: string, p: ProviderId) {
  const { data } = await supabaseAdmin().from("org_credentials").select("sealed,status").eq("organization_id", org).eq("provider", p).maybeSingle();
  if (!data || data.status === "recusada") return null;
  try { return openSecret(data.sealed); } catch { return null; }
}


