"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { Badge, EmptyState, LoadingBlock } from "@/components/ui";
import { formatBRL } from "@/lib/money";
import { useUrlState } from "@/modules/shared";
import { daysLeft, fmtDate, fmtDateTime, lifecycle, loadOrgs, type OrgRow } from "./real-api";

// Contratantes REAIS (função platform_orgs): filtros por ciclo de vida, busca, paginação e CSV. Cada linha abre a
// ficha 360º. Nada da demonstração aparece aqui.
const FILTERS: [string, string, (o: OrgRow) => boolean][] = [
  ["", "Todos", () => true],
  ["teste", "Em teste", (o) => lifecycle(o).key === "teste"],
  ["expira7", "Teste expira em 7 dias", (o) => o.status === "trial" && (daysLeft(o.trial_ends_at) ?? 99) >= 0 && (daysLeft(o.trial_ends_at) ?? 99) <= 7],
  ["teste_expirado", "Teste expirado", (o) => lifecycle(o).key === "teste_expirado" || (o.status === "suspensa" && /teste/i.test(o.status_reason ?? ""))],
  ["pagante", "Pagantes", (o) => lifecycle(o).key === "pagante"],
  ["cortesia", "Cortesia", (o) => lifecycle(o).key === "cortesia"],
  ["atraso", "Em atraso", (o) => lifecycle(o).key === "atraso"],
  ["suspenso", "Suspensos", (o) => o.status === "suspensa"],
  ["cancelado", "Cancelados", (o) => o.status === "cancelada"],
  ["sem_acesso", "Titular sem primeiro acesso", (o) => !o.owner_last_sign_in],
];
const PAGE = 25;

export function RealOrgs() {
  const url = useUrlState();
  const f = url.get("f") ?? "", q = url.get("q") ?? "", plano = url.get("plano") ?? "", page = Number(url.get("p") ?? "1");
  const orgs = useQuery({ queryKey: ["platform-orgs"], queryFn: loadOrgs });
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const list = useMemo(() => (orgs.data ?? []).filter((o) => (FILTERS.find(([k]) => k === f)?.[2] ?? (() => true))(o) && (!plano || o.plan === plano)
    && (!q || norm(`${o.name} ${o.slug} ${o.owner_name ?? ""} ${o.owner_email ?? ""}`).includes(norm(q)))), [orgs.data, f, q, plano]);
  if (orgs.isPending) return <LoadingBlock rows={5} />;
  if (orgs.error) return <p role="alert" className="panel p-5 text-sm text-danger">Não foi possível ler os escritórios reais: {(orgs.error as Error).message}</p>;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice((page - 1) * PAGE, page * PAGE);
  const csv = () => {
    const head = ["nome", "endereco", "titular", "email", "situacao", "plano", "fim_teste", "usuarios", "limite", "criado_em", "ultimo_pagamento", "proximo_vencimento"];
    const rows = list.map((o) => [o.name, o.slug, o.owner_name ?? "", o.owner_email ?? "", lifecycle(o).label, o.plan, fmtDate(o.trial_ends_at), o.members, o.max_users ?? "", fmtDate(o.created_at), fmtDate(o.last_paid_at), o.period_end ?? ""]);
    const text = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv" })), download: `escritorios-lexsion-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros rápidos">
        {FILTERS.map(([k, label, fn]) => <button key={k} onClick={() => url.set("f", k || null)} aria-pressed={f === k} className={`btn min-h-9 ${f === k ? "btn-primary" : "btn-ghost border border-line"}`}>{label} <span className="num text-xs opacity-80">{(orgs.data ?? []).filter(fn).length}</span></button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" className="field max-w-xs" aria-label="Buscar escritório" placeholder="Nome, endereço, titular ou e-mail" defaultValue={q} onChange={(e) => url.set("q", e.target.value || null)} />
        <button className="btn btn-ghost" onClick={csv} disabled={!list.length}><Download aria-hidden className="size-4" /> Exportar CSV ({list.length})</button>
        <Link href="/admin/organizacoes?novo=1" className="btn btn-primary ml-auto"><Plus aria-hidden className="size-4" /> Novo escritório</Link>
      </div>
      {!list.length ? <EmptyState title={orgs.data?.length ? "Nenhum escritório neste filtro" : "Nenhum escritório real ainda"} text={orgs.data?.length ? "Troque o filtro ou a busca." : "Quando alguém contratar pelo site ou você criar um escritório, ele aparece aqui."} /> : (
        <>
          <ul className="space-y-2 md:hidden" aria-label="Escritórios">
            {shown.map((o) => { const s = lifecycle(o); return (
              <li key={o.id}><Link href={`/admin/organizacoes/${o.id}`} className="panel block p-3 text-sm" data-testid={`org-${o.slug}`}>
                <span className="flex items-center justify-between gap-2"><strong className="truncate">{o.name}</strong><Badge tone={s.tone}>{s.label}</Badge></span>
                <span className="mt-1 block text-fg-muted">{o.plan} · {o.members}/{o.max_users ?? "—"} usuários · titular {o.owner_last_sign_in ? `entrou ${fmtDate(o.owner_last_sign_in)}` : "sem acesso"}</span>
              </Link></li>); })}
          </ul>
          <div className="hidden overflow-x-auto md:block" tabIndex={0} aria-label="Escritórios (role horizontalmente)">
            <table className="w-full text-sm" data-testid="tabela-escritorios"><caption className="sr-only">Escritórios contratantes reais</caption>
              <thead><tr className="text-left text-xs text-fg-muted"><th className="py-2">Escritório</th><th>Titular</th><th>Situação</th><th>Plano</th><th>Teste até</th><th>Usuários</th><th>Último pagamento</th><th>Criado</th></tr></thead>
              <tbody>{shown.map((o) => { const s = lifecycle(o); return (
                <tr key={o.id} className="border-t border-line align-top" data-testid={`org-${o.slug}`}>
                  <td className="py-2"><Link href={`/admin/organizacoes/${o.id}`} className="font-medium text-accent underline-offset-2 hover:underline">{o.name}</Link><span className="block text-xs text-fg-muted">/{o.slug}{o.origem ? ` · ${o.origem}` : ""}</span></td>
                  <td>{o.owner_name ?? "—"}<span className="block text-xs text-fg-muted">{o.owner_email ?? ""}{o.owner_last_sign_in ? ` · entrou ${fmtDateTime(o.owner_last_sign_in)}` : " · sem primeiro acesso"}</span></td>
                  <td><Badge tone={s.tone}>{s.label}</Badge>{o.status_reason && <span className="block max-w-[22ch] text-xs text-fg-muted">{o.status_reason}</span>}</td>
                  <td>{o.plan}{o.sub_cycle ? ` · ${o.sub_cycle}` : ""}{o.sub_price != null ? <span className="block text-xs text-fg-muted">{formatBRL(o.sub_price)}</span> : null}</td>
                  <td className="num">{o.trial_ends_at ? <>{fmtDate(o.trial_ends_at)}<span className="block text-xs text-fg-muted">{daysLeft(o.trial_ends_at)} d</span></> : "—"}</td>
                  <td className="num">{o.members}/{o.max_users ?? "—"}</td>
                  <td>{fmtDate(o.last_paid_at)}{o.open_order ? <span className="block text-xs text-warning">pedido em aberto</span> : null}</td>
                  <td>{fmtDate(o.created_at)}</td>
                </tr>); })}</tbody>
            </table>
          </div>
          {pages > 1 && <nav aria-label="Páginas" className="flex items-center gap-2 text-sm"><button className="btn btn-ghost min-h-9" disabled={page <= 1} onClick={() => url.set("p", String(page - 1))}>Anterior</button><span>Página {page} de {pages}</span><button className="btn btn-ghost min-h-9" disabled={page >= pages} onClick={() => url.set("p", String(page + 1))}>Próxima</button></nav>}
        </>
      )}
    </div>
  );
}
