import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { publicPlans } from "@/lib/saas-catalog";
import { currentTemplate, supplierSnapshot } from "@/lib/saas-contract-server";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: { absolute: "Contratar — LexSion" }, robots: { index: false, follow: false } };

// Contratação com contrato dinâmico. Plano resolvido NO SERVIDOR pelo slug (catálogo aprovado); slug inválido
// oferece os planos válidos. Modelo de contrato e dados da contratada vêm do banco (snapshot por contrato).
export default async function ContratarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  await connection();
  const [{ plano }, plans] = await Promise.all([searchParams, publicPlans()]);
  const sellable = plans.filter((p) => p.approved);
  const valid = sellable.some((p) => p.id === plano);
  const [tpl, supplier] = sellable.length ? await Promise.all([currentTemplate(), supplierSnapshot()]) : [null, null];
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-5 py-10">
        <Link href="/planos" className="btn btn-ghost -ml-3"><ArrowLeft aria-hidden className="size-4" /> Voltar aos planos</Link>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Contratar a LexSion</h1>
        {sellable.length && supplier && tpl ? (
          <>
            {plano && !valid && <p role="status" className="mt-3 rounded border border-warning/40 bg-warning-bg p-3 text-sm text-warning">O plano “{plano.slice(0, 30)}” não está disponível. Escolha um dos planos abaixo.</p>}
            <p className="mt-3 max-w-3xl text-fg-muted">Escolha o plano, informe os dados do contratante e leia o contrato completo antes de aceitar. O pagamento (ou o teste grátis) só começa depois do aceite.</p>
            <SignupForm plans={sellable} initialPlan={valid ? plano! : sellable[0].id} supplier={supplier} template={{ title: tpl.title, clauses: tpl.clauses, version: tpl.version, status: tpl.status }} />
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
