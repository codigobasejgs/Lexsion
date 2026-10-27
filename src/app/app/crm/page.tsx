"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRightLeft, Columns3, List, Megaphone, Plus, Search, UserRound } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useInvalidate, useSession } from "@/components/providers";
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui";
import { MoveStageDialog, NewLeadDialog } from "@/modules/crm/lead-dialogs";
import { crmService } from "@/services/mock/crm-repo";
import { formatPhone, STAGE_LABEL, STAGES } from "@/domain/crm";
import { diffDays } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import { users } from "@/mocks/fixtures";
import type { Lead, StageKey } from "@/domain/types";

const EVIDENCE = { confirmada: { label: "Origem confirmada", tone: "success" }, declarada: { label: "Origem declarada", tone: "info" }, nao_identificada: { label: "Origem não identificada", tone: "neutral" } } as const;

function aging(l: Lead) {
  return Math.max(0, diffDays(l.stageEnteredAt.slice(0, 10), DEMO_TODAY));
}

export default function CrmPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { ctx } = useSession();
  const invalidate = useInvalidate();
  const leads = useCollection("leads");
  const view = sp.get("ver") === "lista" ? "lista" : "quadro";
  const q = sp.get("q") ?? "";
  const origin = sp.get("origem") ?? "";
  const showLost = sp.get("perdidos") === "1";
  const [moving, setMoving] = useState<{ lead: Lead; to?: StageKey } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropMsg, setDropMsg] = useState<string | null>(null);
  const newOpen = sp.get("novo") === "1";

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(sp);
    if (v) p.set(k, v);
    else p.delete(k);
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (leads.data ?? []).filter((l) => (!n || `${l.name} ${l.phone} ${l.service}`.toLowerCase().includes(n)) && (!origin || l.firstTouch.origin === origin));
  }, [leads.data, q, origin]);
  const origins = [...new Set((leads.data ?? []).map((l) => l.firstTouch.origin))].sort();
  const stages = STAGES.filter((s) => s.key !== "perdido" || showLost);

  // Arrastar: soltar numa coluna abre o mesmo fluxo do menu quando há regra (perda/contratado); senão move direto.
  const drop = async (to: StageKey) => {
    const lead = rows.find((l) => l.id === dragId);
    setDragId(null);
    if (!lead || lead.stage === to || !ctx) return;
    if (to === "perdido" || to === "contratado") return setMoving({ lead, to });
    const r = await crmService.moveStage(lead.id, to, ctx);
    setDropMsg(r.ok ? `${lead.name} movido para ${STAGE_LABEL[to]}.` : r.error.message);
    await invalidate("leads", "audit");
  };

  return (
    <Guard area="crm">
      <div className="mx-auto max-w-[1600px]">
        <PageHeader
          title="Funil comercial"
          description="Etapa comercial do interessado. Não confunda com a fase jurídica do caso."
          actions={<>
            <Link href="/app/crm/captura" className="btn btn-secondary"><Megaphone aria-hidden className="size-4" /> Simular formulário de campanha</Link>
            <button className="btn btn-primary" data-tour="novo-lead" onClick={() => set("novo", "1")}><Plus aria-hidden className="size-4" /> Novo lead</button>
          </>}
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <span className="sr-only">Buscar lead</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
            <input className="field min-h-10 pl-9 text-sm" placeholder="Nome, telefone ou serviço" value={q} onChange={(e) => set("q", e.target.value || null)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-fg-muted">Origem</span>
            <select className="field min-h-10 w-auto text-sm" value={origin} onChange={(e) => set("origem", e.target.value || null)}>
              <option value="">Todas</option>
              {origins.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm text-fg-muted">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={showLost} onChange={(e) => set("perdidos", e.target.checked ? "1" : null)} /> Mostrar perdidos
          </label>
          <div role="radiogroup" aria-label="Visualização" className="ml-auto inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm">
            <button role="radio" aria-checked={view === "quadro"} onClick={() => set("ver", null)} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === "quadro" ? "bg-brand text-on-brand" : "text-fg-muted"}`}><Columns3 aria-hidden className="size-4" /> Quadro</button>
            <button role="radio" aria-checked={view === "lista"} onClick={() => set("ver", "lista")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === "lista" ? "bg-brand text-on-brand" : "text-fg-muted"}`}><List aria-hidden className="size-4" /> Lista</button>
          </div>
        </div>
        <p role="status" aria-live="polite" className="sr-only">{dropMsg}</p>

        {leads.isError ? <ErrorBlock message="Não foi possível carregar os leads locais." retry={() => leads.refetch()} /> : leads.isPending ? <LoadingBlock rows={5} /> : rows.length === 0 ? (
          <EmptyState title="Nenhum lead encontrado" text="Ajuste os filtros ou cadastre um novo lead." action={<button className="btn btn-secondary" onClick={() => set("novo", "1")}>Novo lead</button>} />
        ) : view === "quadro" ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" role="list" aria-label="Etapas do funil" tabIndex={0} data-tour="funil">
            {stages.map((s) => {
              const col = rows.filter((l) => l.stage === s.key);
              return (
                <section
                  key={s.key}
                  role="listitem"
                  aria-label={`${s.label}, ${col.length} lead(s)`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(s.key)}
                  className={`flex w-[min(300px,85vw)] shrink-0 snap-start flex-col rounded-[var(--radius-panel)] border bg-surface ${dragId ? "border-dashed border-brand/50" : "border-line"}`}
                >
                  <header className="flex items-center justify-between border-b border-line px-3 py-2.5">
                    <h2 className="text-sm font-semibold">{s.label}</h2>
                    <span className="num rounded-full bg-surface-muted px-2 text-xs text-fg-muted">{col.length}</span>
                  </header>
                  <ul className="flex-1 space-y-2 p-2">
                    {col.map((l) => <LeadCard key={l.id} l={l} onMove={() => setMoving({ lead: l })} onDragStart={() => setDragId(l.id)} />)}
                    {col.length === 0 && <li className="px-2 py-6 text-center text-xs text-fg-muted">Sem leads</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Leads</caption>
              <thead className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wider text-fg-muted">
                <tr><th scope="col" className="px-4 py-3">Lead</th><th scope="col" className="px-4 py-3">Etapa</th><th scope="col" className="px-4 py-3">Origem</th><th scope="col" className="px-4 py-3 text-right">Dias na etapa</th><th scope="col" className="px-4 py-3">Responsável</th><th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3"><Link href={`/app/crm/leads/${l.id}`} className="font-medium hover:underline">{l.name}</Link><span className="block text-fg-muted">{l.service}</span></td>
                    <td className="px-4 py-3">{STAGE_LABEL[l.stage]}</td>
                    <td className="px-4 py-3"><span className="block">{l.firstTouch.origin}</span>{l.firstTouch.campaign && <span className="text-xs text-fg-muted">{l.firstTouch.campaign}</span>}</td>
                    <td className="num px-4 py-3 text-right">{aging(l)}</td>
                    <td className="px-4 py-3 text-fg-muted">{users.find((u) => u.id === l.ownerId)?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right"><button className="btn btn-ghost min-h-9" onClick={() => setMoving({ lead: l })}>Mover</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewLeadDialog open={newOpen} onClose={() => set("novo", null)} onCreated={(id) => router.push(`/app/crm/leads/${id}`)} />
      {moving && <MoveStageDialog lead={moving.lead} to={moving.to} onClose={() => setMoving(null)} />}
    </Guard>
  );
}

function LeadCard({ l, onMove, onDragStart }: { l: Lead; onMove: () => void; onDragStart: () => void }) {
  const owner = users.find((u) => u.id === l.ownerId);
  const days = aging(l);
  return (
    <li draggable onDragStart={onDragStart} className="rounded-[var(--radius-control)] border border-line bg-surface-raised p-3 hover:border-line-strong">
      <Link href={`/app/crm/leads/${l.id}`} className="block font-medium [overflow-wrap:anywhere] hover:underline">{l.name}</Link>
      <p className="text-xs text-fg-muted">{l.service} · {formatPhone(l.phone)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={EVIDENCE[l.firstTouch.evidence].tone} icon={false}>{l.firstTouch.origin}</Badge>
        {l.clientId && <Badge tone="success">Cliente</Badge>}
        {l.stage === "perdido" && l.lostReason && <Badge tone="neutral" icon={false}>{l.lostReason}</Badge>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-fg-muted">
        <span className={`num whitespace-nowrap ${days > 7 && l.stage !== "perdido" && l.stage !== "contratado" ? "text-warning" : ""}`} title="Dias nesta etapa">{days === 0 ? "hoje" : `${days} d`} na etapa</span>
        {owner ? <span className="flex items-center gap-1 truncate"><UserRound aria-hidden className="size-3 shrink-0" />{owner.name.split(" ")[0]}</span> : <span className="truncate">Sem resp.</span>}
        <button onClick={onMove} className="btn btn-ghost ml-auto min-h-8 px-2 text-xs" aria-label={`Mover ${l.name} para outra etapa`}><ArrowRightLeft aria-hidden className="size-3.5" /> Mover</button>
      </div>
    </li>
  );
}
