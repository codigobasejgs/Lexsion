import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/marketing/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Sobre — LexSion" },
  description: "A LexSion é uma plataforma de gestão para escritórios de advocacia: toda a advocacia, uma plataforma.",
  alternates: { canonical: "/sobre" }, robots: { index: true, follow: true },
};

export default function SobrePage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Sobre a LexSion</h1>
        <p className="mt-4 text-lg text-fg-muted">Toda a advocacia. Uma plataforma.</p>
        <p className="mt-6">A LexSion nasceu para reunir num só lugar o que um escritório de advocacia faz todos os dias: atender, organizar casos e prazos, produzir documentos, acompanhar honorários e manter o cliente informado.</p>
        <p className="mt-4">O sistema foi desenhado para ser claro também para quem não tem familiaridade com tecnologia: cada tela explica o que fazer, há tours guiados por função e uma central de ajuda com prints reais.</p>
        <p className="mt-4">Cada escritório usa a plataforma com a própria marca — no sistema, no portal do cliente, nos documentos e no aplicativo instalado.</p>
        <h2 className="mt-10 text-xl font-semibold">O que a LexSion não faz</h2>
        <p className="mt-2 text-fg-muted">A LexSion é software. Não presta serviços jurídicos, não promete resultados e não substitui a análise do profissional: cálculos, prazos e minutas são apoios que dependem de revisão do(a) advogado(a).</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/demonstracao" className="btn btn-primary">Conhecer a demonstração</Link><Link href="/contato" className="btn btn-secondary">Contato</Link></div>
      </article>
    </SiteShell>
  );
}
