import type { Metadata } from "next";
import { SiteShell } from "@/components/marketing/site-shell";

export const metadata: Metadata = { title: { absolute: "Privacidade — LexSion" }, alternates: { canonical: "/privacidade" }, robots: { index: true, follow: true } };

// ponytail: texto provisório e honesto; a política definitiva precisa de revisão jurídica antes da operação real.
export default function PrivacidadePage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-semibold">Privacidade</h1>
        <p className="mt-2 text-sm text-warning">Versão provisória. A política definitiva será publicada após revisão jurídica, antes do início da operação com dados reais.</p>
        <h2 className="mt-8 text-xl font-semibold">Demonstração</h2>
        <p className="mt-2 text-fg-muted">A demonstração usa apenas dados fictícios. O que você altera fica guardado somente no seu navegador e pode ser apagado a qualquer momento em Configurações → Dados e LGPD. Nada é enviado aos nossos servidores.</p>
        <h2 className="mt-8 text-xl font-semibold">Formulário de contato</h2>
        <p className="mt-2 text-fg-muted">Nesta versão, o formulário de contato não envia nem guarda os dados preenchidos.</p>
        <h2 className="mt-8 text-xl font-semibold">Operação real</h2>
        <p className="mt-2 text-fg-muted">Na operação com escritórios contratantes, os dados de cada escritório ficarão separados, com acesso por função, registro de ações e atendimento aos direitos dos titulares previstos na LGPD.</p>
      </article>
    </SiteShell>
  );
}
