"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useSession } from "@/components/providers";
import { Badge, LoadingBlock } from "@/components/ui";

type Item = { id: string; name: string; owner: "plataforma" | "escritorio"; state: "operacional" | "pendente_escritorio" | "desligada" | "nao_contratada" | "erro"; detail: string; action?: string; href?: string };
const STATE = {
  operacional: { label: "Funcionando", tone: "success" },
  pendente_escritorio: { label: "Falta configurar", tone: "warning" },
  desligada: { label: "Aguardando liberação", tone: "neutral" },
  nao_contratada: { label: "Não disponível", tone: "neutral" },
  erro: { label: "Com problema", tone: "danger" },
} as const;

/** Operação: estado verificado no servidor agora, por integração, com a ação que resolve. */
export function RealIntegrations() {
  const { ctx } = useSession();
  const q = useQuery({
    queryKey: ["integracoes-saude", ctx?.organizationId],
    enabled: !!ctx,
    queryFn: async () => (await (await fetch(`/api/integracoes/saude?org=${ctx!.organizationId}`)).json()) as { ok: boolean; items: Item[] },
  });
  if (q.isPending) return <LoadingBlock />;
  if (!q.data?.ok) return <p role="alert" className="panel p-4 text-sm text-danger">Não foi possível verificar as integrações agora. <button className="underline" onClick={() => q.refetch()}>Tentar novamente</button></p>;
  return (
    <>
      <div className="mb-3 flex justify-end"><button className="btn btn-ghost min-h-9" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCw aria-hidden className="size-4" /> {q.isFetching ? "Verificando…" : "Verificar de novo"}</button></div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="integracoes-reais">
        {q.data.items.map((i) => (
          <li key={i.id} className="panel flex flex-col gap-2 p-4 text-sm" data-testid={`integracao-${i.id}`}>
            <div className="flex items-start gap-2"><h2 className="flex-1 font-semibold">{i.name}</h2><Badge tone={STATE[i.state].tone}>{STATE[i.state].label}</Badge></div>
            <p className="text-fg-muted">{i.detail}</p>
            <p className="mt-auto text-xs text-fg-muted">{i.owner === "plataforma" ? "Gerenciado pela LexSion" : "Configurado pelo escritório"}</p>
            {i.href && <Link href={i.href} className={i.action ? "btn btn-primary min-h-9 w-fit" : "btn btn-ghost min-h-9 w-fit"}>{i.action ?? "Abrir"}</Link>}
          </li>
        ))}
      </ul>
    </>
  );
}
