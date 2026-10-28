"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Plus, ShieldCheck } from "lucide-react";
import { useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, PageHeader } from "@/components/ui";
import { TenantLogo } from "@/components/brand";
import { useUrlState } from "@/modules/shared";
import { tenantRepo } from "@/services/mock/tenant-repo";
import { PLAN_LABEL, STATUS_LABEL, type BillingCycle, type PlanId, type Tenant, type TenantStatus } from "@/domain/tenancy";
import { formatInstant } from "@/lib/dates";
import { TenantWizard } from "../tenant-wizard";

const TONE: Record<TenantStatus, "success" | "info" | "warning" | "danger" | "neutral"> = { ativa: "success", trial: "info", suspensa: "warning", inadimplente: "danger", cancelada: "neutral", removida: "neutral" };

export default function ContratantesPage() {
  const { user, mode } = useSession();
  const qc = useQueryClient();
  const url = useUrlState();
  const status = url.get("status") ?? "";
  const busca = url.get("q") ?? "";
  const [wizard, setWizard] = useState(false);
  const [suspend, setSuspend] = useState<Tenant | null>(null);
  const [planFor, setPlanFor] = useState<Tenant | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tenants = useQuery({ queryKey: ["tenants"], queryFn: () => tenantRepo.list() });
  const usage = useQuery({ queryKey: ["tenants", "usage"], enabled: !!tenants.data, queryFn: async () => Object.fromEntries(await Promise.all(tenants.data!.map(async (t) => [t.id, await tenantRepo.getUsage(t.id)] as const))) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tenants"] });
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const list = (tenants.data ?? []).filter((t) => t.status !== "removida" && (!status || t.status === status) && (!busca || norm(`${t.name} ${t.slug} ${t.ownerName ?? ""}`).includes(norm(busca))));

  return (
    <>
      <PageHeader title="Contratantes" description="Escritórios da plataforma: plano, situação e consumo agregado." actions={<button className="btn btn-primary" data-tour="sa-novo" onClick={() => setWizard(true)}><Plus aria-hidden className="size-4" /> Novo escritório</button>} />
      <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info"><ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" /> O Super Admin vê só dados agregados. Documentos, conversas e casos dos escritórios não ficam acessíveis; suporte com acesso exigirá autorização do escritório e auditoria (fase backend).</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <input type="search" className="field max-w-xs" aria-label="Buscar escritório" placeholder="Buscar por nome, endereço ou responsável" defaultValue={busca} onChange={(e) => url.set("q", e.target.value || null)} />
        <select className="field w-auto" aria-label="Filtrar por situação" value={status} onChange={(e) => url.set("status", e.target.value || null)}>
          <option value="">Todas as situações</option>
          {(Object.keys(STATUS_LABEL) as TenantStatus[]).filter((s) => s !== "removida").map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <div aria-live="polite">{notice && <p role="status" className="mb-3 text-sm text-success">{notice}</p>}</div>
      {tenants.data && list.length === 0 && <EmptyState title="Nenhum escritório encontrado" text="Ajuste a busca ou o filtro de situação." />}
      <ul className="space-y-3">
        {list.map((t) => {
          const u = usage.data?.[t.id];
          return (
            <li key={t.id} className="panel flex flex-wrap items-center gap-4 p-4 text-sm" data-testid={`tenant-${t.slug}`}>
              <TenantLogo src={t.settings.logoLight} name={t.name} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.name}</p>
                <p className="text-fg-muted">/{t.slug} · {PLAN_LABEL[t.plan]} ({t.cycle}){t.status === "trial" && t.trialEndsAt ? ` · teste até ${formatInstant(t.trialEndsAt).split(" ")[0]}` : ""}</p>
                {t.suspensionReason && <p className="text-warning">Motivo: {t.suspensionReason}</p>}
              </div>
              <span className="num">{u ? `${u.members} membros · ${u.clients} clientes` : "—"}</span>
              <Badge tone={TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              <div className="flex flex-wrap gap-1">
                <button className="btn btn-ghost min-h-9" onClick={() => setPlanFor(t)}>Plano</button>
                {(t.status === "ativa" || t.status === "trial" || t.status === "inadimplente") && <button className="btn btn-ghost min-h-9" onClick={() => setSuspend(t)}><Pause aria-hidden className="size-4" /> Suspender</button>}
                {(t.status === "suspensa" || t.status === "cancelada") && <button className="btn btn-ghost min-h-9" onClick={async () => { await tenantRepo.reactivate(t.id, user?.id); await refresh(); setNotice(`${t.name} reativado. Os dados foram preservados.`); }}><Play aria-hidden className="size-4" /> Reativar</button>}
                {mode === "demo" && <Link className="btn btn-ghost min-h-9" href={`/demo/tenant/${t.slug}`} target="_blank">Abrir demonstração</Link>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-fg-muted">A assinatura LexSion é cobrada do escritório; os honorários que o escritório cobra dos clientes dele ficam em contas, provedores e relatórios separados.</p>
      <TenantWizard open={wizard} onClose={() => setWizard(false)} onCreated={(t) => setNotice(mode === "real" ? `${t.name} criado. Convite enviado ao responsável (${t.ownerEmail ?? "e-mail informado"}).` : `${t.name} criado. Endereço demonstrativo: /demo/tenant/${t.slug}`)} />
      <SuspendDialog tenant={suspend} onClose={() => setSuspend(null)} onDone={async (msg) => { await refresh(); setNotice(msg); }} />
      <PlanDialog tenant={planFor} onClose={() => setPlanFor(null)} onDone={async (msg) => { await refresh(); setNotice(msg); }} />
    </>
  );
}

function SuspendDialog({ tenant, onClose, onDone }: { tenant: Tenant | null; onClose: () => void; onDone: (m: string) => void }) {
  const { user } = useSession();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={!!tenant} onClose={() => { setReason(""); setError(null); onClose(); }} title={`Suspender ${tenant?.name ?? ""}?`}>
      <p className="text-sm">A equipe do escritório verá “Acesso suspenso” ao entrar. Nenhum dado é apagado e a reativação é imediata.</p>
      <label className="mt-3 block"><span className="label">Motivo (registrado na auditoria)</span><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn btn-ghost" autoFocus onClick={onClose}>Cancelar</button>
        <button className="btn btn-danger" onClick={async () => { const r = await tenantRepo.suspend(tenant!.id, reason, user?.id); if (!r.ok) return setError(r.error.message); setReason(""); onClose(); onDone(`${tenant!.name} suspenso.`); }}>Suspender</button>
      </div>
    </Dialog>
  );
}

function PlanDialog({ tenant, onClose, onDone }: { tenant: Tenant | null; onClose: () => void; onDone: (m: string) => void }) {
  const { user, mode } = useSession();
  const [plan, setPlan] = useState<PlanId | "">("");
  const [cycle, setCycle] = useState<BillingCycle | "">("");
  const p = (plan || tenant?.plan) as PlanId;
  const c = (cycle || tenant?.cycle) as BillingCycle;
  return (
    <Dialog open={!!tenant} onClose={() => { setPlan(""); setCycle(""); onClose(); }} title={`Plano de ${tenant?.name ?? ""}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Plano</span><select className="field" value={p} onChange={(e) => setPlan(e.target.value as PlanId)}>{(Object.keys(PLAN_LABEL) as PlanId[]).map((x) => <option key={x} value={x}>{PLAN_LABEL[x]}</option>)}</select></label>
        <label className="block"><span className="label">Ciclo</span><select className="field" value={c} onChange={(e) => setCycle(e.target.value as BillingCycle)}><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select></label>
      </div>
      <p className="mt-3 text-xs text-fg-muted">{mode === "real" ? "Muda o plano e as cotas. Nenhuma cobrança é emitida: o faturamento automático da assinatura ainda não está ativo." : "Simulação: a cobrança proporcional aparece em Financeiro da plataforma. Nada é cobrado de verdade."}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={async () => { await tenantRepo.changePlan(tenant!.id, p, c, user?.id); onClose(); onDone(`Plano de ${tenant!.name}: ${PLAN_LABEL[p]} (${c}).`); }}>Salvar plano</button>
      </div>
    </Dialog>
  );
}
