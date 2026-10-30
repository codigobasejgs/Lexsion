"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { readAll } from "@/services/mock/db";
import { formatInstant } from "@/lib/dates";
import { useLive } from "@/modules/shared";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Ev = { id: number; at: string; organization_id: string | null; action: string; detail: string | null; reason: string | null; actor_role: string | null };

// Auditoria da plataforma. Real: audit_logs do banco (só-acréscimo; leitura para proprietário, operações e auditor).
// Demonstração: registro local das fixtures.
export default function AuditoriaPage() {
  const live = useLive();
  const demo = useQuery({ queryKey: ["audit", "platform"], enabled: !live, queryFn: async () => (await readAll("audit")).filter((a) => a.organizationId === "platform").reverse() });
  const real = useQuery({
    queryKey: ["audit-real"], enabled: live,
    queryFn: async () => {
      const sb = supabaseBrowser();
      const [{ data: ev, error }, { data: orgs }] = await Promise.all([
        sb.from("audit_logs").select("id,at,organization_id,action,detail,reason,actor_role").order("at", { ascending: false }).limit(300),
        sb.from("organizations").select("id,name"),
      ]);
      if (error) throw new Error(error.message);
      return { ev: (ev ?? []) as Ev[], name: new Map<string, string>(((orgs ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name])) };
    },
  });
  if (live) return (
    <>
      <PageHeader title="Auditoria da plataforma" description="Registro imutável no banco: quem fez, quando, o quê, antes/depois e motivo. Ninguém altera nem apaga." />
      {real.isPending ? <LoadingBlock rows={5} /> : real.error ? <p role="alert" className="text-sm text-danger">Sem permissão ou sem conexão: {(real.error as Error).message}</p>
        : !real.data!.ev.length ? <EmptyState title="Sem eventos ainda" text="As ações do Super Admin e das rotinas aparecem aqui." />
        : <ul className="panel divide-y divide-line text-sm" data-testid="auditoria-real">{real.data!.ev.map((a) => <li key={a.id} className="flex flex-wrap gap-x-3 p-3"><span className="num text-fg-muted">{formatInstant(a.at)}</span><span className="font-mono text-xs">{a.action}</span><span className="min-w-0 flex-1">{a.detail}{a.reason ? <span className="block text-xs text-fg-muted">Motivo: {a.reason}</span> : null}</span><span className="text-fg-muted">{a.organization_id ? real.data!.name.get(a.organization_id) ?? "escritório" : "plataforma"}{a.actor_role ? ` · ${a.actor_role}` : ""}</span></li>)}</ul>}
    </>
  );
  return (
    <>
      <PageHeader title="Auditoria da plataforma" description="Ações do Super Admin na demonstração (registro local, dados fictícios)." />
      {demo.data?.length === 0 && <EmptyState title="Sem eventos ainda" text="Crie, suspenda ou altere o plano de um escritório para ver o registro." />}
      <ul className="panel divide-y divide-line text-sm">
        {demo.data?.map((a) => <li key={a.id} className="flex flex-wrap gap-x-3 p-3"><span className="num text-fg-muted">{formatInstant(a.at)}</span><span className="font-mono text-xs">{a.action}</span><span className="flex-1">{a.detail}</span><span className="text-fg-muted">{a.entityId}</span></li>)}
      </ul>
    </>
  );
}
