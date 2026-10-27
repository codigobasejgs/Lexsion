import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/marketing/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Soluções por tipo de escritório — LexSion" },
  description: "Como a LexSion se adapta à advocacia individual, a escritórios em crescimento, ao previdenciário e a equipes com várias funções.",
  alternates: { canonical: "/solucoes" }, robots: { index: true, follow: true },
};

const CASES = [
  { title: "Advocacia individual", text: "Agenda, prazos, clientes e honorários num só lugar, no computador e no celular. Menos planilhas e mensagens soltas.", focus: ["Meu dia com o que é urgente", "Cobranças e recibos simples", "Portal para o cliente acompanhar sem ligar"] },
  { title: "Escritório em crescimento", text: "Funções separadas para atendimento, controladoria, financeiro e estagiários, com aprovação de peças e publicação pelo(a) advogado(a).", focus: ["Distribuição de tarefas por pessoa", "Aprovação de minutas e propostas", "Relatórios por responsável"] },
  { title: "Previdenciário", text: "Triagem com checklist de documentos, análise por etapas, comparação de cenários e acompanhamento de RPV — sempre com revisão profissional.", focus: ["Pendências de CNIS e PPP", "Prazos de exigência do INSS", "Atualizações ao cliente em linguagem simples"] },
  { title: "Captação e atendimento", text: "Leads de campanhas com origem registrada, triagem por área, propostas e conversão em cliente e caso, respeitando as regras de publicidade da advocacia.", focus: ["Funil por etapa", "Motivos de perda", "Sem promessas de resultado"] },
];

export default function SolucoesPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Soluções</h1>
        <p className="mt-3 max-w-2xl text-fg-muted">A mesma plataforma, organizada para a rotina de cada tipo de escritório.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {CASES.map((c) => (
            <section key={c.title} className="panel p-6" aria-labelledby={c.title}>
              <h2 id={c.title} className="text-xl font-semibold">{c.title}</h2>
              <p className="mt-2 text-fg-muted">{c.text}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{c.focus.map((f) => <li key={f}>{f}</li>)}</ul>
            </section>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/demonstracao" className="btn btn-primary">Conhecer a demonstração</Link><Link href="/contato" className="btn btn-secondary">Falar com a equipe</Link></div>
      </section>
    </SiteShell>
  );
}
