import type { Metadata } from "next";
import { SiteShell } from "@/components/marketing/site-shell";

export const metadata: Metadata = { title: { absolute: "Termos de uso — LexSion" }, alternates: { canonical: "/termos" }, robots: { index: true, follow: true } };

// ponytail: texto provisório; os termos de contratação dependem de revisão jurídica do proprietário.
export default function TermosPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-semibold">Termos de uso</h1>
        <p className="mt-2 text-sm text-warning">Versão provisória. Os termos de contratação serão publicados após revisão jurídica.</p>
        <p className="mt-6 text-fg-muted">A LexSion é um software de gestão para escritórios de advocacia. Não presta serviços jurídicos nem garante resultados. Cálculos, prazos, sugestões e minutas produzidos com o sistema dependem de revisão do profissional responsável.</p>
        <p className="mt-4 text-fg-muted">A demonstração pública é oferecida apenas para conhecer o sistema, com dados fictícios. Não insira dados reais de clientes na demonstração.</p>
      </article>
    </SiteShell>
  );
}
