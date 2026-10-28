import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

/** Cliente por requisição (nunca compartilhado), com a sessão do usuário nos cookies. RLS aplica as permissões. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Em Server Components os cookies são somente leitura: o proxy renova a sessão.
        }
      },
    },
  });
}

/** Usuário autenticado VALIDADO no servidor do Supabase (getUser consulta o Auth; não confia só no cookie). */
export async function currentUser() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  return error ? null : data.user;
}
