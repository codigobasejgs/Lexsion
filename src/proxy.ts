import { NextResponse, type NextRequest } from "next/server";
import { resolveContext, demoSlugFromCookie, DEMO_COOKIE, TENANT_HEADER, CONTEXT_HEADER } from "@/lib/tenant-resolver";

// Resolve o contexto (plataforma, Super Admin, escritório, portal) ANTES de renderizar.
// Repassa ao servidor por cabeçalho de REQUISIÇÃO; descarta qualquer x-lexsion-* vindo do navegador.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADER);
  headers.delete(CONTEXT_HEADER);
  const r = resolveContext(request.nextUrl.hostname, request.nextUrl.pathname);
  // Demo num único endereço: o cookie só escolhe QUAL manifesto público (nome/ícone) exibir em /app e /portal.
  // Não dá acesso a dados; em produção o escritório vem do host verificado.
  const slug = r.slug ?? ((r.context === "tenant" || r.context === "portal") ? demoSlugFromCookie(request.cookies.get(DEMO_COOKIE)?.value) : null);
  headers.set(CONTEXT_HEADER, r.context);
  if (slug) headers.set(TENANT_HEADER, slug);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|sw.js|icons/|brand/|help/|favicon).*)"],
};
