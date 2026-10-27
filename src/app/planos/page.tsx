import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Planos — LexSion" },
  description: "Planos da LexSion para advocacia individual, escritórios em crescimento e operações maiores. Condições apresentadas no contato comercial.",
  alternates: { canonical: "/planos" }, robots: { index: true, follow: true },
};

// Sem valores: preços ainda não aprovados pelo proprietário. Recursos listados existem na demonstração.
const PLANS = [
  { name: "Essencial", for: "Advocacia individual e escritórios pequenos", items: ["Atendimento, clientes e casos", "Agenda, prazos e tarefas", "Honorários, parcelas e recibos", "Portal do cliente", "Aplicativo no celular"] },
  { name: "Profissional", for: "Escritórios com equipe", highlight: true, items: ["Tudo do Essencial", "Funções e permissões por pessoa", "Minutas com aprovação e exportação Word", "Previdenciário e cálculos", "Relatórios e automações", "Marca própria do escritório"] },
  { name: "Avançado", for: "Operações com várias equipes", items: ["Tudo do Profissional", "Marketing e campanhas", "Integrações (na implantação)", "Mais usuários e armazenamento"] },
  { name: "Enterprise", for: "Necessidades específicas", items: ["Domínio próprio", "Implantação e migração assistidas", "Condições sob medida"] },
];

export default function PlanosPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Planos</h1>
        <p className="mt-3 max-w-2xl text-fg-muted">Contratação mensal, trimestral ou anual. Valores, período de teste e condições são apresentados na conversa comercial, de acordo com o tamanho da equipe.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <section key={p.name} aria-labelledby={`p-${p.name}`} className={`panel flex flex-col p-5 ${p.highlight ? "border-brand" : ""}`}>
              <h2 id={`p-${p.name}`} className="text-xl font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm text-fg-muted">{p.for}</p>
              <p className="mt-4 text-lg font-semibold">Consulte condições</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">{p.items.map((i) => <li key={i} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{i}</li>)}</ul>
              <Link href={`/contato?plano=${encodeURIComponent(p.name)}`} className={`btn mt-5 ${p.highlight ? "btn-primary" : "btn-secondary"}`}>Solicitar proposta</Link>
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm text-fg-muted">Quer ver antes? <Link href="/demonstracao" className="text-accent underline underline-offset-2">Explore a demonstração</Link> com perfis fictícios.</p>
      </section>
    </SiteShell>
  );
}
