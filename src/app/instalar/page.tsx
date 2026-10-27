import type { Metadata } from "next";
import { SiteShell } from "@/components/marketing/site-shell";
import { InstallCard } from "@/components/pwa";

export const metadata: Metadata = {
  title: { absolute: "Instalar o aplicativo — LexSion" },
  description: "Como instalar a LexSion no celular, tablet ou computador.",
  alternates: { canonical: "/instalar" }, robots: { index: true, follow: true },
};

export default function InstalarPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-semibold">Instalar o aplicativo</h1>
        <p className="mt-3 text-fg-muted">A LexSion funciona no navegador e também pode ser instalada como aplicativo, abrindo em tela cheia pelo ícone. Não é preciso loja de aplicativos.</p>
        <div className="mt-6"><InstallCard force /></div>
        <h2 className="mt-10 text-xl font-semibold">Passo a passo</h2>
        <dl className="mt-4 space-y-4">
          <div className="panel p-4"><dt className="font-semibold">Android (Chrome)</dt><dd className="mt-1 text-fg-muted">Abra o endereço do sistema → toque no menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”.</dd></div>
          <div className="panel p-4"><dt className="font-semibold">iPhone e iPad (Safari)</dt><dd className="mt-1 text-fg-muted">Abra no Safari → toque em Compartilhar → “Adicionar à Tela de Início” → Adicionar. Ainda não validado em aparelho físico nesta fase.</dd></div>
          <div className="panel p-4"><dt className="font-semibold">Computador (Chrome ou Edge)</dt><dd className="mt-1 text-fg-muted">Clique no ícone de instalar na barra de endereço, ou no menu → “Instalar LexSion”.</dd></div>
        </dl>
        <p className="mt-6 text-sm text-fg-muted">Cada escritório tem o próprio aplicativo, com nome e ícone do escritório: o administrador encontra o QR Code em Configurações → Identidade visual e Meu aplicativo.</p>
      </article>
    </SiteShell>
  );
}
