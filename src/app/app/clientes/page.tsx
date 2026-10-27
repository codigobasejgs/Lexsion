"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Cake, ChevronRight, Plus, Search } from "lucide-react";
import { upcomingBirthdays } from "@/domain/recurrence";
import { DEMO_TODAY } from "@/mocks/clock";
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
  const bday = params.get("aniversario"); // "30" = aniversariantes dos próximos 30 dias
  const clients = useCollection("clients");
  const cases = useCollection("cases");

  const birthdays = useMemo(() => new Map(upcomingBirthdays(clients.data ?? [], DEMO_TODAY, Number(bday ?? 30)).map((b) => [b.person.id, b])), [clients.data, bday]);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const base = (clients.data ?? []).filter((c) => (!n || `${c.name} ${c.city} ${c.phone}`.toLowerCase().includes(n)) && (!bday || birthdays.has(c.id)));
    return bday ? base.sort((a, b) => birthdays.get(a.id)!.inDays - birthdays.get(b.id)!.inDays) : base.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [clients.data, q, bday, birthdays]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };
  const setQ = (v: string) => setParam("q", v);
  const bdayLabel = (id: string) => { const b = birthdays.get(id); return b ? `🎂 ${b.inDays === 0 ? "hoje" : b.inDays === 1 ? "amanhã" : `em ${b.inDays} dias`} (${b.date.slice(8, 10)}/${b.date.slice(5, 7)}) · ${b.age} anos` : null; };

  return (
    <Guard area="clientes">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          title="Clientes"
          description="Todas as pessoas e empresas atendidas pelo escritório."
          actions={<Link href="/app/clientes/novo" className="btn btn-primary"><Plus aria-hidden className="size-4" /> Novo cliente</Link>}
        />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative block w-full max-w-md">
            <span className="sr-only">Buscar cliente</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
            <input className="field pl-9" placeholder="Nome, cidade ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm"><Cake aria-hidden className="size-4 text-fg-muted" /><span className="text-fg-muted">Aniversariantes</span>
            <select className="field min-h-10 w-auto text-sm" value={bday ?? ""} onChange={(e) => setParam("aniversario", e.target.value)}>
              <option value="">Todos os clientes</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option><option value="90">Próximos 90 dias</option>
            </select>
          </label>
        </div>
        {bday && <p className="mb-3 text-sm text-fg-muted">Só aparecem clientes com data de nascimento cadastrada. Contato de felicitação apenas com consentimento do cliente.</p>}
        {clients.isError ? (
          <ErrorBlock message="Não foi possível carregar os clientes locais." retry={() => clients.refetch()} />
        ) : clients.isPending ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title={bday ? "Nenhum aniversariante no período" : "Nenhum cliente encontrado"} text={bday ? "Escolha um período maior ou confira as datas de nascimento cadastradas." : q ? "Tente outro termo de busca." : "Cadastre o primeiro cliente para começar."} action={<Link href="/app/clientes/novo" className="btn btn-secondary">Novo cliente</Link>} />
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
                        {bday && <p className="mt-1 text-xs text-accent">{bdayLabel(c.id)}</p>}
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
                      {bday && <p className="text-xs text-accent">{bdayLabel(c.id)}</p>}
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
