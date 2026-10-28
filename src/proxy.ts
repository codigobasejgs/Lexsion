import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveContext, demoSlugFromCookie, DEMO_COOKIE, TENANT_HEADER, CONTEXT_HEADER } from "@/lib/tenant-resolver";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

// Resolve o contexto (plataforma, Super Admin, escritório, portal) ANTES de renderizar.
// Repassa ao servidor por cabeçalho de REQUISIÇÃO; descarta qualquer x-lexsion-* vindo do navegador.
// Também renova a sessão do Supabase (cookies httpOnly) — autorização de dados continua na RLS.
export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  headers.delete(CONTEXT_HEADER);
  const r = resolveContext(request.nextUrl.hostname, request.nextUrl.pathname);
  // Demo num único endereço: o cookie só escolhe QUAL manifesto público (nome/ícone) exibir em /app e /portal.
  // Não dá acesso a dados; em produção o escritório vem do host verificado.
  const slug = r.slug ?? ((r.context === "tenant" || r.context === "portal") ? demoSlugFromCookie(request.cookies.get(DEMO_COOKIE)?.value) : null);
  headers.set(CONTEXT_HEADER, r.context);
  if (slug) headers.set(TENANT_HEADER, slug);
  let response = NextResponse.next({ request: { headers } });
  if (!supabaseConfigured() || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return response;
  const sb = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers } });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await sb.auth.getUser(); // renova o token se expirou; não decide acesso aqui
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw.js|icons/|brand/|help/|favicon).*)"],
};
