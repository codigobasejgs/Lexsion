import crypto from "node:crypto";

// TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) com crypto nativo — só para os testes do Super Admin sintético.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function totp(secret: string, at = Date.now()): string {
  const bits = secret.replace(/=+$/, "").toUpperCase().split("").map((c) => B32.indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = crypto.createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Hora do servidor de Auth (cabeçalho Date): o relógio da máquina de teste pode estar adiantado/atrasado. */
export async function serverNow(supabaseUrl: string): Promise<number> {
  const r = await fetch(`${supabaseUrl}/auth/v1/health`).catch(() => null);
  const d = r?.headers.get("date");
  return d ? Date.parse(d) + 500 : Date.now();
}
