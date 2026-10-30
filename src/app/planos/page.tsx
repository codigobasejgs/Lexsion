import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Check, Minus } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { formatBRL } from "@/lib/money";
import { checkoutEnabled, publicPlans } from "@/lib/saas-catalog";

export const metadata: Metadata = {
  title: { absolute: "Planos — LexSion" },
  description: "Planos da LexSion para advocacia individual, escritórios com equipe e operações maiores.",
  alternates: { canonical: "/planos" }, robots: { index: true, follow: true },
};

// Planos, preços e recursos vêm do banco (o Super Admin edita sem código). Preço só aparece com aprovação do dono;
// "Contratar" só aparece com a contratação online liberada. Recurso sem integração ativa aparece como "em breve".
export default async function PlanosPage() {
  await connection();
  const plans = await publicPlans();
  const selling = checkoutEnabled();
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Planos</h1>
        <p className="mt-3 max-w-2xl text-fg-muted">Escolha pelo tamanho da equipe. Todos os planos incluem o sistema completo do escritório, portal do cliente e aplicativo com a sua marca.</p>
        {!plans.length && <p className="mt-8 text-fg-muted">Os planos serão publicados em breve. <Link href="/contato" className="text-accent underline underline-offset-2">Fale com a LexSion</Link>.</p>}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p, i) => (
            <section key={p.id} aria-labelledby={`p-${p.id}`} data-testid={`plano-${p.id}`} className={`panel flex flex-col p-5 ${i === 1 ? "border-brand" : ""}`}>
              <h2 id={`p-${p.id}`} className="text-xl font-semibold">{p.label}</h2>
              <p className="mt-1 text-sm text-fg-muted">{p.description} · até {p.max_users} {p.max_users === 1 ? "usuário" : "usuários"}</p>
              {p.approved
                ? <p className="mt-4"><span className="text-2xl font-semibold">{formatBRL(p.price_monthly)}</span><span className="text-sm text-fg-muted"> /mês</span>{p.price_yearly ? <span className="block text-sm text-fg-muted">ou {formatBRL(p.price_yearly)} por ano</span> : null}</p>
                : <p className="mt-4 text-lg font-semibold">Valores em breve</p>}
              {p.trial_days > 0 && p.approved && <p className="mt-1 text-sm text-success">{p.trial_days} dias para experimentar</p>}
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {p.features.map((f) => <li key={f.label} className={`flex gap-2 ${f.ok ? "" : "text-fg-muted"}`}>{f.ok ? <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> : <Minus aria-hidden className="mt-0.5 size-4 shrink-0" />}{f.label}{f.ok ? "" : " (em breve)"}</li>)}
              </ul>
              {selling && p.approved
                ? <Link href={`/contratar?plano=${p.id}`} className={`btn mt-5 ${i === 1 ? "btn-primary" : "btn-secondary"}`}>Contratar {p.label}</Link>
                : <Link href={`/contato?plano=${encodeURIComponent(p.label)}`} className={`btn mt-5 ${i === 1 ? "btn-primary" : "btn-secondary"}`}>Falar com a LexSion</Link>}
            </section>
          ))}
        </div>
        <p className="mt-6 text-sm text-fg-muted">Quer ver antes? <Link href="/demonstracao" className="text-accent underline underline-offset-2">Explore a demonstração</Link> com perfis fictícios. Pagamento por Pix ou cartão pela InfinitePay; renovação por cobrança enviada a cada período.</p>
      </section>
    </SiteShell>
  );
}
