"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Avatar, Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui";
import { users } from "@/mocks/fixtures";
import { maskDoc } from "@/lib/formatting";

export default function ClientesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const clients = useCollection("clients");
  const cases = useCollection("cases");

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (clients.data ?? []).filter((c) => !n || `${c.name} ${c.city} ${c.phone}`.toLowerCase().includes(n)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [clients.data, q]);

  const setQ = (v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set("q", v);
    else p.delete("q");
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  return (
    <Guard area="clientes">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          title="Clientes"
          description="Todas as pessoas e empresas atendidas pelo escritório."
          actions={<Link href="/app/clientes/novo" className="btn btn-primary"><Plus aria-hidden className="size-4" /> Novo cliente</Link>}
        />
        <label className="relative mb-4 block max-w-md">
          <span className="sr-only">Buscar cliente</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
          <input className="field pl-9" placeholder="Nome, cidade ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {clients.isError ? (
          <ErrorBlock message="Não foi possível carregar os clientes locais." retry={() => clients.refetch()} />
        ) : clients.isPending ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhum cliente encontrado" text={q ? "Tente outro termo de busca." : "Cadastre o primeiro cliente para começar."} action={<Link href="/app/clientes/novo" className="btn btn-secondary">Novo cliente</Link>} />
        ) : (
          <>
            {/* Tabela ≥ md */}
            <div className="panel hidden overflow-hidden md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Lista de clientes</caption>
                <thead className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wider text-fg-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Cliente</th>
                    <th scope="col" className="px-4 py-3 font-medium">Documento</th>
                    <th scope="col" className="px-4 py-3 font-medium">Cidade</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Casos</th>
                    <th scope="col" className="px-4 py-3 font-medium">Responsável</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-muted/60">
                      <td className="px-4 py-3">
                        <Link href={`/app/clientes/${c.id}`} className="flex items-center gap-3 font-medium hover:underline">
                          <Avatar name={c.name} size={32} />
                          <span className="min-w-0 [overflow-wrap:anywhere]">{c.name}</span>
                        </Link>
                      </td>
                      <td className="num px-4 py-3 text-fg-muted">{maskDoc(c.document)}</td>
                      <td className="px-4 py-3 text-fg-muted">{c.city}/{c.uf}</td>
                      <td className="num px-4 py-3 text-right">{(cases.data ?? []).filter((k) => k.clientId === c.id).length}</td>
                      <td className="px-4 py-3 text-fg-muted">{users.find((u) => u.id === c.ownerId)?.name}</td>
                      <td className="px-4 py-3 text-right"><ChevronRight aria-hidden className="inline size-4 text-fg-muted" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Cartões < md */}
            <ul className="space-y-2 md:hidden">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/clientes/${c.id}`} className="panel flex items-center gap-3 p-3">
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium [overflow-wrap:anywhere]">{c.name}</p>
                      <p className="text-sm text-fg-muted">{c.city}/{c.uf} · {(cases.data ?? []).filter((k) => k.clientId === c.id).length} caso(s)</p>
                    </div>
                    {c.kind === "PJ" && <Badge icon={false}>PJ</Badge>}
                    <ChevronRight aria-hidden className="size-4 text-fg-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Guard>
  );
}
