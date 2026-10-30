import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteShell } from "@/components/marketing/site-shell";
import { checkoutEnabled, CONTRACT_VERSION, publicPlans } from "@/lib/saas-catalog";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: { absolute: "Contratar — LexSion" }, robots: { index: false, follow: false } };

export default async function ContratarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  await connection();
  const [{ plano }, plans] = await Promise.all([searchParams, publicPlans()]);
  const sellable = plans.filter((p) => p.approved);
  return (
    <SiteShell>
      <section className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Contratar a LexSion</h1>
        {checkoutEnabled() && sellable.length ? (
          <>
            <p className="mt-3 text-fg-muted">Preencha os dados do escritório. Depois do pagamento confirmado pela InfinitePay, o escritório é criado e você recebe o acesso por e-mail.</p>
            <SignupForm plans={sellable} initialPlan={sellable.some((p) => p.id === plano) ? plano! : sellable[0].id} contractVersion={CONTRACT_VERSION} />
          </>
        ) : (
          <div role="status" className="mt-6 rounded-[var(--radius-panel)] border border-info/30 bg-info-bg p-5 text-info">
            <p className="font-medium">A contratação online ainda não foi liberada.</p>
            <p className="mt-2 text-sm">Os valores estão em aprovação. Nenhum pagamento é aceito por esta página enquanto isso.</p>
            <div className="mt-4 flex flex-wrap gap-2"><Link href="/contato" className="btn btn-secondary">Falar com a LexSion</Link><Link href="/demonstracao" className="btn btn-ghost">Ver a demonstração</Link></div>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
