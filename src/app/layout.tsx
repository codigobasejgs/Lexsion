import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa";
import { TourProvider } from "@/tours/runner";
import { TenantTheme } from "@/components/tenant-theme";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "SIWILTEC", template: "%s · SIWILTEC" },
  description: "Gestão inteligente de escritórios de advocacia — ambiente demonstrativo.",
  applicationName: "SIWILTEC",
  appleWebApp: { capable: true, title: "SIWILTEC", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090807" },
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
  ],
};

// Aplica o tema antes da pintura (sem flash). Padrão: escuro. "system" segue o SO.
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
