import "server-only";
import crypto from "node:crypto";

// Cliente mínimo da Evolution API v2 (servidor). A chave global nunca sai do servidor.
// Regra de convivência: o servidor Evolution é compartilhado; a LexSion só cria/usa instâncias "lexsion-<slug>".
const URL_ = (process.env.EVOLUTION_URL ?? "").replace(/\/+$/, "");
const KEY = process.env.EVOLUTION_API_KEY ?? "";
export const evolutionConfigured = () => /^https:\/\//.test(URL_) && KEY.length >= 20;
export const instanceFor = (slug: string) => `lexsion-${slug}`.slice(0, 68);

async function call<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  if (!/^\/[a-zA-Z/]+\/lexsion-[a-z0-9-]+$|^\/instance\/create$/.test(path)) throw new Error("instância fora do escopo LexSion");
  const r = await fetch(`${URL_}${path}`, {
    method, headers: { apikey: KEY, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000), cache: "no-store",
  }).catch(() => null);
  if (!r) return { ok: false, status: 0, data: null };
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => null)) as T | null };
}

export type EvoState = "open" | "close" | "connecting";
export async function connectionState(instance: string) {
  const r = await call<{ instance?: { state?: EvoState } }>("GET", `/instance/connectionState/${instance}`);
  return r.status === 404 ? "missing" : (r.data?.instance?.state ?? "erro");
}
/** Cria a instância (se não existir) com webhook para a LexSion e devolve o QR (base64) para parear o aparelho do escritório. */
export async function createOrConnect(instance: string, webhookUrl: string) {
  if ((await connectionState(instance)) === "missing") {
    const c = await call<{ qrcode?: { base64?: string } }>("POST", "/instance/create", {
      instanceName: instance, integration: "WHATSAPP-BAILEYS", qrcode: true, groupsIgnore: true, rejectCall: false, readMessages: false,
      webhook: { url: webhookUrl, byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "SEND_MESSAGE"] },
    });
    if (!c.ok) return { ok: false as const, error: `criação recusada (HTTP ${c.status})` };
    if (c.data?.qrcode?.base64) return { ok: true as const, qr: c.data.qrcode.base64 };
  }
  const q = await call<{ base64?: string; code?: string }>("GET", `/instance/connect/${instance}`);
  return q.ok ? { ok: true as const, qr: q.data?.base64 ?? null } : { ok: false as const, error: `conexão recusada (HTTP ${q.status})` };
}
export async function logout(instance: string) {
  return (await call("DELETE", `/instance/logout/${instance}`)).ok;
}
/** Envia texto. number = só dígitos com DDI (55…). */
export async function sendText(instance: string, number: string, text: string) {
  const r = await call<{ key?: { id?: string }; status?: string }>("POST", `/message/sendText/${instance}`, { number, text });
  return r.ok && r.data?.key?.id ? { ok: true as const, id: r.data.key.id } : { ok: false as const, status: r.status };
}

export const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
/** Remove a instância (só usada para limpar instâncias de teste "lexsion-qa-…"). */
export async function deleteInstance(instance: string) {
  if (!/^lexsion-qa-[a-z0-9-]+$/.test(instance)) throw new Error("só instâncias de teste podem ser removidas");
  return (await call("DELETE", `/instance/delete/${instance}`)).ok;
}
