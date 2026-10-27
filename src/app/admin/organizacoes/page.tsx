"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, DollarSign, FlaskConical, LogOut, ShieldCheck, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useSession } from "@/components/providers";
import { Badge, PageHeader } from "@/components/ui";
import { tenantRepo } from "@/services/mock/tenant-repo";
import { PLAN_PRICES, PLAN_LABEL } from "@/domain/tenancy";
import { formatBRL } from "@/lib/money";

export default function OrganizacoesPage() {
  const { ready, user, signOut } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (ready && user?.role !== "superadmin") router.replace("/entrar");
  }, [ready, user, router]);

  const tenants = useQuery({
    queryKey: ["admin-tenants"],
    enabled: user?.role === "superadmin",
    queryFn: () => tenantRepo.list(),
  });

  const usage = useQuery({
    queryKey: ["admin-usage"],
    enabled: user?.role === "superadmin" && !!tenants.data,
    queryFn: async () => {
      const list = tenants.data ?? [];
      const results = await Promise.all(list.map(t => tenantRepo.getUsage(t.id)));
      return Object.fromEntries(list.map((t, i) => [t.id, results[i]]));
    },
  });

  // Métricas SaaS derivadas (demo: valores dos planos ativos)
  const metrics = useMemo(() => {
    if (!tenants.data) return null;
    const active = tenants.data.filter(t => t.status === "ativa");
    const trial = tenants.data.filter(t => t.status === "trial");
    const suspended = tenants.data.filter(t => t.status === "suspensa");

    const mrr = active.reduce((sum, t) => {
      const price = PLAN_PRICES[t.plan]?.[t.cycle] ?? 0;
      const monthly = t.cycle === "mensal" ? price : t.cycle === "trimestral" ? price / 3 : t.cycle === "semestral" ? price / 6 : price / 12;
      return sum + monthly;
    }, 0);

    const arr = mrr * 12;
    const totalTenants = tenants.data.length;
    const arpa = totalTenants > 0 ? mrr / totalTenants : 0;

    // Churn demo: 0 (sem histórico de cancelamentos)
    const churnRate = 0;

    return { mrr, arr, arpa, churnRate, active: active.length, trial: trial.length, suspended: suspended.length, total: totalTenants };
  }, [tenants.data]);

  if (!ready || user?.role !== "superadmin") return <div className="min-h-dvh bg-canvas" />;

  return (
    <div className="min-h-dvh">
      <div className="flex items-center justify-center gap-2 bg-ai-bg px-4 py-1 text-xs text-ai">
        <FlaskConical aria-hidden className="size-3.5" /> Ambiente demonstrativo — dados fictícios
      </div>
      <main id="conteudo" className="mx-auto max-w-[1200px] px-4 py-6">
        <PageHeader
          title="Plataforma SaaS"
          description="Operação multi-tenant: métricas, planos, status e consumo agregado."
          actions={
            <button className="btn btn-ghost" onClick={signOut}>
              <LogOut aria-hidden className="size-4" /> Sair
            </button>
          }
        />

        <p className="mb-6 flex items-start gap-2 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          Sem acesso automático a documentos, conversas ou casos. Suporte futuro exigirá autorização temporária do tenant e auditoria.
        </p>

        {metrics && (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <DollarSign aria-hidden className="size-4" /> MRR
              </div>
              <p className="mt-1 text-2xl font-semibold num">{formatBRL(metrics.mrr)}</p>
              <p className="mt-0.5 text-xs text-fg-muted">Receita recorrente mensal</p>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <TrendingUp aria-hidden className="size-4" /> ARR
              </div>
              <p className="mt-1 text-2xl font-semibold num">{formatBRL(metrics.arr)}</p>
              <p className="mt-0.5 text-xs text-fg-muted">Receita recorrente anual</p>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <Users aria-hidden className="size-4" /> ARPA
              </div>
              <p className="mt-1 text-2xl font-semibold num">{formatBRL(metrics.arpa)}</p>
              <p className="mt-0.5 text-xs text-fg-muted">Receita média por tenant</p>
            </div>
            <div className="panel p-4">
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <TrendingDown aria-hidden className="size-4" /> Churn
              </div>
              <p className="mt-1 text-2xl font-semibold num">{metrics.churnRate.toFixed(1)}%</p>
              <p className="mt-0.5 text-xs text-fg-muted">{metrics.active} ativos, {metrics.trial} trial, {metrics.suspended} suspensos</p>
            </div>
          </div>
        )}

        <h2 className="mb-3 text-lg font-semibold">Organizações</h2>
        <ul className="space-y-3">
          {tenants.data?.map((t) => {
            const u = usage.data?.[t.id];
            return (
              <li key={t.id} className="panel flex flex-wrap items-center gap-4 p-4 text-sm">
                <Building2 aria-hidden className="size-6 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-fg-muted">
                    {PLAN_LABEL[t.plan]} · {t.cycle} · {t.status === "trial" && t.trialEndsAt ? `Trial até ${new Date(t.trialEndsAt).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <span className="num">{u?.members ?? "—"} membros</span>
                <span className="num">{u?.clients ?? "—"} clientes</span>
                <Badge tone={t.status === "ativa" ? "success" : t.status === "trial" ? "info" : "warning"}>{t.status}</Badge>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm text-fg-muted">
          Cobrança da assinatura SaaS é separada dos honorários cobrados pelos escritórios (contas e conciliações diferentes).
        </p>
      </main>
    </div>
  );
}
