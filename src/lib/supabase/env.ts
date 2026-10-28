// Configuração pública do Supabase. Só URL e chave PUBLICÁVEL (segura no navegador; RLS protege os dados).
// A chave secreta nunca entra aqui: fica em SUPABASE_SECRET_KEY, lida apenas em código de servidor.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const supabaseConfigured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
