import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { ShotCard } from "@/components/marketing/shot-gallery";
import { LANDING_SHOTS } from "@/content/landing-shots";
import { MODULES } from "@/content/marketing";

export const metadata: Metadata = {
  title: { absolute: "Funcionalidades — LexSion" },
  description: "Atendimento e CRM, casos e processos, prazos, documentos e minutas, previdenciário, honorários, portal do cliente e marca própria do escritório.",
  alternates: { canonical: "/funcionalidades" }, robots: { index: true, follow: true },
};

const PREPARING = ["Login com e-mail e senha e separação dos dados no servidor", "WhatsApp (Evolution API), e-mail transacional (Resend)", "Cobranças por Pix, boleto e cartão (Asaas, InfinitePay ou Mercado Pago)", "Assinatura eletrônica (ZapSign)", "Consulta a fontes processuais autorizadas (DataJud e tribunais)", "Assistente de IA com revisão humana obrigatória"];

export default function FuncionalidadesPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Funcionalidades</h1>
        <p className="mt-3 max-w-2xl text-fg-muted">Cada módulo abaixo existe na demonstração e pode ser explorado com perfis fictícios. Integrações externas estão listadas à parte, como em preparação.</p>
        <nav aria-label="Módulos" className="mt-6 flex flex-wrap gap-2">{MODULES.map((m) => <a key={m.id} href={`#${m.id}`} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-line-strong">{m.title}</a>)}</nav>
      </section>
      {MODULES.map((m, i) => {
        const s = LANDING_SHOTS.find((x) => x.id === m.shot)!;
        return (
          <section key={m.id} id={m.id} aria-labelledby={`h-${m.id}`} className={`scroll-mt-20 ${i % 2 ? "" : "border-y border-line bg-surface"}`}>
            <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 lg:grid-cols-2">
              <div>
                <h2 id={`h-${m.id}`} className="text-2xl font-semibold">{m.title}</h2>
                <p className="mt-3 text-fg-muted">{m.text}</p>
                <ul className="mt-4 space-y-2">{m.examples.map((e) => <li key={e} className="flex gap-2 text-sm"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{e}</li>)}</ul>
              </div>
              <ShotCard shot={s} />
            </div>
          </section>
        );
      })}
      <section aria-labelledby="prep" className="mx-auto max-w-6xl px-5 py-12">
        <h2 id="prep" className="text-2xl font-semibold">Em preparação para a implantação</h2>
        <p className="mt-2 max-w-2xl text-fg-muted">As telas e conexões já existem; estas integrações são ativadas com as contas do escritório na implantação. Na demonstração, nada é enviado, cobrado ou assinado de verdade.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">{PREPARING.map((p) => <li key={p} className="panel p-3 text-sm">{p}</li>)}</ul>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/demonstracao" className="btn btn-primary">Conhecer a demonstração <ArrowRight aria-hidden className="size-4" /></Link><Link href="/contato" className="btn btn-secondary">Solicitar apresentação</Link></div>
      </section>
    </SiteShell>
  );
}
