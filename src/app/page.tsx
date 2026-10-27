import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Check, Fingerprint, Layers, Smartphone, Users } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { ShotCard } from "@/components/marketing/shot-gallery";
import { LANDING_SHOTS } from "@/content/landing-shots";
import { AREAS, FAQ, FLOW, MODULES } from "@/content/marketing";

export const metadata: Metadata = {
  title: { absolute: "LexSion — Gestão completa para escritórios de advocacia" },
  description: "Atendimento, processos, prazos, documentos, honorários e portal do cliente em uma só plataforma, com a marca do seu escritório.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

const shot = (id: string) => LANDING_SHOTS.find((s) => s.id === id)!;

export default function Landing() {
  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[radial-gradient(110%_70%_at_15%_0%,#232934_0%,#0e1014_55%,#090a0d_100%)] text-[#f7f2e8]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:py-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-[#f6d88c]">TODA A ADVOCACIA. UMA PLATAFORMA.</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">A gestão completa do seu escritório. Em um só lugar.</h1>
            <p className="mt-5 text-lg text-[#c9c3b8]">Organize atendimentos, processos, prazos, documentos, honorários e clientes com uma experiência conectada, elegante e preparada para crescer.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demonstracao" className="btn min-h-12 bg-[#c59a4a] px-5 text-base text-[#090a0d] hover:bg-[#d6ad5f]">Conhecer a demonstração <ArrowRight aria-hidden className="size-4" /></Link>
              <Link href="/funcionalidades" className="btn min-h-12 border border-[#4a5263] px-5 text-base text-[#f7f2e8] hover:border-[#c59a4a]">Explorar funcionalidades</Link>
            </div>
            <p className="mt-4 text-sm text-[#b9b4aa]">Demonstração com dados fictícios, sem cadastro.</p>
          </div>
          <div className="text-fg"><ShotCard shot={shot("meu-dia")} priority /></div>
        </div>
      </section>

      {/* Valor */}
      <section aria-labelledby="valor" className="mx-auto max-w-6xl px-5 py-14">
        <h2 id="valor" className="text-2xl font-semibold sm:text-3xl">O dia do escritório, organizado do primeiro contato ao recebimento</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [Layers, "Tudo conectado", "Lead, cliente, caso, documentos, prazos e honorários ligados entre si — sem redigitar."],
            [Check, "Prazos sob controle", "Prazo proposto pela equipe e confirmado por advogado(a), com memória da contagem."],
            [Building2, "Financeiro visível", "Parcelas, baixas, caixa e recibos do escritório em tempo real."],
            [Users, "Cada função no seu lugar", "Advogado, atendimento, controladoria, financeiro e estagiário veem o que lhes cabe."],
            [BookOpen, "Treinamento embutido", "“Como usar esta tela?”, tours guiados e artigos com prints reais."],
            [Smartphone, "No bolso", "Funciona no celular e pode ser instalado como aplicativo do escritório."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Check;
            return <li key={t as string} className="panel p-5"><I aria-hidden className="size-5 text-accent" /><p className="mt-3 font-semibold">{t as string}</p><p className="mt-1 text-sm text-fg-muted">{d as string}</p></li>;
          })}
        </ul>
      </section>

      {/* Tour com prints reais */}
      <section aria-labelledby="tour" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 id="tour" className="text-2xl font-semibold sm:text-3xl">Veja o sistema por dentro</h2>
          <p className="mt-2 max-w-2xl text-fg-muted">Prints reais da LexSion, com dados fictícios. Clique para ampliar ou abra o módulo na demonstração.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">{LANDING_SHOTS.filter((s) => s.id !== "meu-dia").map((s) => <ShotCard key={s.id} shot={s} />)}</div>
        </div>
      </section>

      {/* Fluxo */}
      <section id="como-funciona" aria-labelledby="fluxo" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-14">
        <h2 id="fluxo" className="text-2xl font-semibold sm:text-3xl">Como funciona, de ponta a ponta</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map(([t, d], i) => <li key={t} className="panel p-5"><span className="num text-sm font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span><p className="mt-2 font-semibold">{t}</p><p className="mt-1 text-sm text-fg-muted">{d}</p></li>)}
        </ol>
      </section>

      {/* Especialidades */}
      <section aria-labelledby="areas" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 id="areas" className="text-2xl font-semibold sm:text-3xl">Para todas as áreas do Direito</h2>
          <p className="mt-2 max-w-2xl text-fg-muted">Triagem e catálogo com dezenas de áreas, com profundidade especial no previdenciário. A LexSion organiza o trabalho — as decisões jurídicas continuam com o profissional.</p>
          <ul className="mt-6 flex flex-wrap gap-2">{AREAS.map((a) => <li key={a} className="rounded-full border border-line px-3 py-1.5 text-sm">{a}</li>)}<li className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-fg-muted">e outras</li></ul>
          <Link href="/solucoes" className="mt-6 inline-flex items-center gap-1 text-accent underline underline-offset-2">Ver soluções por tipo de escritório <ArrowRight aria-hidden className="size-4" /></Link>
        </div>
      </section>

      {/* Módulos */}
      <section aria-labelledby="modulos" className="mx-auto max-w-6xl px-5 py-14">
        <h2 id="modulos" className="text-2xl font-semibold sm:text-3xl">Módulos que conversam entre si</h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {MODULES.map((m) => <li key={m.id} className="panel p-5"><p className="font-semibold">{m.title}</p><p className="mt-1 text-sm text-fg-muted">{m.text}</p></li>)}
        </ul>
        <Link href="/funcionalidades" className="btn btn-secondary mt-6">Ver todas as funcionalidades <ArrowRight aria-hidden className="size-4" /></Link>
      </section>

      {/* White-label + segurança */}
      <section aria-labelledby="marca" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-2">
          <div>
            <h2 id="marca" className="text-2xl font-semibold sm:text-3xl">Sua identidade. Sua equipe. Seu aplicativo.</h2>
            <p className="mt-3 text-fg-muted">Cada escritório usa a LexSion com o próprio logotipo, cores e nome — no sistema, no portal do cliente, nos documentos em Word e no aplicativo instalado no celular. As cores passam por verificação de contraste para continuarem legíveis.</p>
            <p className="mt-3 text-sm text-fg-muted">A instalação como aplicativo depende do navegador: Chrome e Edge oferecem “Instalar”; no iPhone, pelo Safari em “Adicionar à Tela de Início”.</p>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-xl font-semibold"><Fingerprint aria-hidden className="size-5 text-accent" /> Perfis e segurança</h3>
            <ul className="mt-3 space-y-2 text-sm text-fg-muted">
              <li>Funções com permissões próprias: administrador, advogado(a), atendimento, controladoria, financeiro, estagiário e cliente.</li>
              <li>Dados de cada escritório separados; rascunhos internos nunca aparecem para o cliente sem publicação.</li>
              <li>Na versão em produção: login com e-mail e senha, separação dos dados por escritório no servidor e registro das ações.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Planos (sem valores não aprovados) */}
      <section aria-labelledby="planos-home" className="mx-auto max-w-6xl px-5 py-14 text-center">
        <h2 id="planos-home" className="text-2xl font-semibold sm:text-3xl">Planos para o tamanho do seu escritório</h2>
        <p className="mx-auto mt-2 max-w-2xl text-fg-muted">Do advogado autônomo ao escritório com várias equipes. As condições são apresentadas na conversa comercial.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/planos" className="btn btn-secondary">Conhecer os planos</Link><Link href="/contato" className="btn btn-primary">Solicitar proposta</Link></div>
      </section>

      {/* FAQ */}
      <section id="perguntas" aria-labelledby="faq" className="scroll-mt-20 border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-14">
          <h2 id="faq" className="text-2xl font-semibold sm:text-3xl">Perguntas frequentes</h2>
          <div className="mt-6 divide-y divide-line">
            {FAQ.map(([q, a]) => <details key={q} className="group py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">{q}<span aria-hidden className="text-accent transition-transform group-open:rotate-45">+</span></summary><p className="mt-2 text-fg-muted">{a}</p></details>)}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section aria-labelledby="cta" className="bg-[#090a0d] text-[#f7f2e8]">
        <div className="mx-auto max-w-6xl px-5 py-14 text-center">
          <h2 id="cta" className="text-2xl font-semibold sm:text-3xl">Veja a LexSion funcionando</h2>
          <p className="mx-auto mt-2 max-w-xl text-[#c9c3b8]">Explore a demonstração agora ou fale com a equipe para uma apresentação do sistema com o seu escritório.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/demonstracao" className="btn min-h-12 bg-[#c59a4a] px-5 text-[#090a0d] hover:bg-[#d6ad5f]">Conhecer a demonstração</Link>
            <Link href="/contato" className="btn min-h-12 border border-[#4a5263] px-5 text-[#f7f2e8] hover:border-[#c59a4a]">Solicitar apresentação</Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
