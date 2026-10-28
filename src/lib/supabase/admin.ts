import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Cliente com a chave SECRETA: ignora RLS. Uso restrito a operações que o servidor já autorizou
 * (ex.: enviar convite pelo Auth Admin depois de conferir no banco que o pedinte é titular/plataforma).
 * Nunca importar em componente de cliente — `server-only` quebra o build se isso acontecer.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY ausente no servidor");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
