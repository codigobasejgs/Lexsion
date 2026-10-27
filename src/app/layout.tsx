import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa";
import { TourProvider } from "@/tours/runner";
import { TenantTheme } from "@/components/tenant-theme";
import { CONTEXT_HEADER, TENANT_HEADER } from "@/lib/tenant-resolver";
import { manifestHref, type ManifestKey } from "@/lib/pwa-manifest";
import { tenants } from "@/mocks/tenants";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });

// Manifesto, ícones e título dependem do contexto resolvido no proxy (cabeçalho de requisição, não do navegador).
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const ctx = h.get(CONTEXT_HEADER) ?? "platform";
  const t = tenants.find((x) => x.slug === h.get(TENANT_HEADER));
  const key: ManifestKey = ctx === "admin" ? "admin" : t ? (ctx === "portal" ? `portal-${t.slug}` : `erp-${t.slug}`) : "lexsion";
  const brand = t && (ctx === "tenant" || ctx === "portal") ? t.settings.brandName : "LexSion";
  const icons = t && brand !== "LexSion"
    ? { icon: [{ url: `/tenants/${t.slug}/icon-192.png`, sizes: "192x192" }], apple: `/tenants/${t.slug}/apple-touch-icon.png` }
    : { icon: [{ url: "/brand/lexsion/lexsion-favicon.svg", type: "image/svg+xml" }, { url: "/icons/favicon-32.png", sizes: "32x32" }], apple: "/icons/apple-touch-icon.png" };
  return {
    title: { default: brand === "LexSion" ? "LexSion — Plataforma Jurídica Inteligente" : brand, template: `%s · ${brand}` },
    description: "LexSion — Toda a advocacia. Uma plataforma. Ambiente demonstrativo com dados fictícios.",
    applicationName: brand,
    manifest: manifestHref(key),
    appleWebApp: { capable: true, title: brand, statusBarStyle: "black-translucent" },
    icons,
    openGraph: { title: "LexSion — Plataforma Jurídica Inteligente", description: "Toda a advocacia. Uma plataforma.", images: ["/brand/lexsion/lexsion-logo-horizontal-black-gold.png"], locale: "pt_BR", type: "website" },
    robots: { index: false, follow: false }, // demonstração: não indexar
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090A0D" },
    { media: "(prefers-color-scheme: light)", color: "#FCFAF6" },
  ],
};

// Tema antes da pintura (sem flash). Chave legada "siwiltec.theme" preservada (preferência já salva pelos usuários).
const themeScript = `try{var t=localStorage.getItem('siwiltec.theme')||'dark';if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <a href="#conteudo" className="sr-only z-50 rounded bg-brand px-3 py-2 text-on-brand focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Pular para o conteúdo
        </a>
        <Providers>
          <TenantTheme />
          <TourProvider>{children}</TourProvider>
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
