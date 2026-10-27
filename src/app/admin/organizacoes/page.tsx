"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, FlaskConical, LogOut, ShieldCheck } from "lucide-react";
import { useSession } from "@/components/providers";
import { Badge, PageHeader } from "@/components/ui";
import { readAll } from "@/services/mock/db";
import { organizations } from "@/mocks/fixtures";

// Superadmin SaaS: organizações, planos, limites e consumo — SEM acesso ao conteúdo sigiloso dos escritórios.
const PLANS: Record<string, { plan: string; limit: number; status: string }> = {
  "org-aurora": { plan: "Profissional (demo)", limit: 10, status: "ativa" },
  "org-boreal": { plan: "Essencial (demo)", limit: 3, status: "ativa" },
};

export default function OrganizacoesPage() {
  const { ready, user, signOut } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (ready && user?.role !== "superadmin") router.replace("/entrar");
  }, [ready, user, router]);
  // Apenas contagens agregadas; nenhum registro é exibido.
  const usage = useQuery({
    queryKey: ["admin-usage"],
    enabled: user?.role === "superadmin",
    queryFn: async () => {
      const [users, clients, convs] = await Promise.all([readAll("users"), readAll("clients"), readAll("conversations")]);
      return Object.fromEntries(organizations.map((o) => [o.id, { members: users.filter((u) => u.organizationId === o.id && u.role !== "cliente").length, clients: clients.filter((c) => c.organizationId === o.id).length, conversations: convs.filter((c) => c.organizationId === o.id).length }]));
    },
  });
  if (!ready || user?.role !== "superadmin") return <div className="min-h-dvh bg-canvas" />;
  return (
    <div className="min-h-dvh">
      <div className="flex items-center justify-center gap-2 bg-ai-bg px-4 py-1 text-xs text-ai"><FlaskConical aria-hidden className="size-3.5" /> Ambiente demonstrativo — dados fictícios</div>
      <main id="conteudo" className="mx-auto max-w-[1000px] px-4 py-6">
        <PageHeader title="Organizações (SaaS)" description="Operação da plataforma: planos, limites, status e consumo agregado." actions={<button className="btn btn-ghost" onClick={signOut}><LogOut aria-hidden className="size-4" /> Sair</button>} />
        <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info"><ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" /> Sem acesso automático a documentos, conversas ou casos. Suporte futuro exigirá autorização temporária do escritório e auditoria.</p>
        <ul className="space-y-3">
          {organizations.map((o) => {
            const u = usage.data?.[o.id];
            const p = PLANS[o.id];
            return (
              <li key={o.id} className="panel flex flex-wrap items-center gap-4 p-4 text-sm">
                <Building2 aria-hidden className="size-6 text-accent" />
                <div className="min-w-0 flex-1"><p className="font-semibold">{o.name}</p><p className="text-fg-muted">{o.city} · {p.plan}</p></div>
                <span className="num">{u?.members ?? "—"}/{p.limit} membros</span>
                <span className="num">{u?.clients ?? "—"} clientes</span>
                <span className="num">{u?.conversations ?? "—"} conversas</span>
                <Badge tone="success">{p.status}</Badge>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm text-fg-muted">Cobrança da assinatura SaaS é separada dos honorários cobrados pelos escritórios (contas e conciliações diferentes).</p>
      </main>
    </div>
  );
}
