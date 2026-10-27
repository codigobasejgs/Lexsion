import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Resolução de tenant: por host customizado ou por rota /demo/tenant/[slug].
// ponytail: JWT criptografado com tenant_id quando houver auth real; agora é cookie/header para demo.
export function proxy(request: NextRequest) {
  const { pathname, host } = request.nextUrl;

  // Super Admin sempre sem tenant
  if (pathname.startsWith("/admin")) {
    const response = NextResponse.next();
    response.headers.set("x-tenant-context", "superadmin");
    return response;
  }

  // Rotas públicas sem tenant
  if (pathname === "/" || pathname.startsWith("/entrar") || pathname.startsWith("/recuperar-acesso") || pathname === "/manifest.json" || pathname.startsWith("/_next") || pathname.startsWith("/icons")) {
    return NextResponse.next();
  }

  // Resolução por rota /demo/tenant/[slug]
  const demoMatch = pathname.match(/^\/demo\/tenant\/([a-z0-9-]+)/);
  if (demoMatch) {
    const slug = demoMatch[1];
    const response = NextResponse.next();
    response.cookies.set("siwiltec-tenant-slug", slug, { path: "/", sameSite: "lax", httpOnly: false });
    response.headers.set("x-tenant-slug", slug);
    return response;
  }

  // Resolução por host customizado (não implementado na demo; sempre localhost)
  // ponytail: aurora.adv.br → tenant aurora-advocacia quando DNS configurado.
  if (host !== "localhost:3000" && host !== "127.0.0.1:3000" && !host.startsWith("192.168.")) {
    // Exemplo: aurora.adv.br → slug=aurora-advocacia (lookup no backend)
    // const slug = await resolveDomain(host);
    const response = NextResponse.next();
    response.headers.set("x-tenant-unknown-domain", host);
    return response;
  }

  // Tenant por cookie (setado anteriormente)
  const tenantSlug = request.cookies.get("siwiltec-tenant-slug")?.value;
  if (tenantSlug) {
    const response = NextResponse.next();
    response.headers.set("x-tenant-slug", tenantSlug);
    return response;
  }

  // Sem tenant: contexto local single-org (Aurora padrão na demo)
  const response = NextResponse.next();
  response.headers.set("x-tenant-slug", "aurora-advocacia");
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|icons/|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)",
  ],
};
