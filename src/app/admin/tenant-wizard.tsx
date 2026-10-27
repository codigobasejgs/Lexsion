"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/providers";
import { Dialog } from "@/components/ui";
import { slugError, tenantRepo } from "@/services/mock/tenant-repo";
import { DEFAULT_BRANDING, PLAN_LABEL, type BillingCycle, type PlanId, type Tenant } from "@/domain/tenancy";
import { DEMO_TODAY } from "@/mocks/clock";

const STEPS = ["Escritório", "Responsável", "Plano", "Identidade", "Resumo"];
const slugify = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// Assistente de novo escritório. Tudo demonstrativo: nenhum convite ou cobrança é enviado.
export function TenantWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: Tenant) => void }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: "", slug: "", document: "", ownerName: "", ownerEmail: "", plan: "trial" as PlanId, cycle: "mensal" as BillingCycle, trialDays: 15, primary: "#1f4e79" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => { setError(null); setF({ ...f, ...p }); };
  const reset = () => { setStep(0); setError(null); setF({ name: "", slug: "", document: "", ownerName: "", ownerEmail: "", plan: "trial", cycle: "mensal", trialDays: 15, primary: "#1f4e79" }); };

  const check = async (): Promise<string | null> => {
    if (step === 0) {
      if (f.name.trim().length < 3) return "Informe o nome do escritório (mínimo 3 letras).";
      return slugError(f.slug, (await tenantRepo.list()).map((t) => t.slug));
    }
    if (step === 1 && (!f.ownerName.trim() || !/^\S+@\S+\.\S+$/.test(f.ownerEmail))) return "Informe o nome e um e-mail válido do responsável.";
    return null;
  };
  const next = async () => { const e = await check(); if (e) return setError(e); setStep(step + 1); };
  const create = async () => {
    setBusy(true);
    const trialEnd = new Date(`${DEMO_TODAY}T23:59:59-03:00`);
    trialEnd.setDate(trialEnd.getDate() + f.trialDays);
    const r = await tenantRepo.create({
      slug: f.slug, name: f.name.trim(), status: f.plan === "trial" ? "trial" : "ativa", plan: f.plan, cycle: f.cycle,
      trialEndsAt: f.plan === "trial" ? trialEnd.toISOString() : undefined, ownerName: f.ownerName.trim(), ownerEmail: f.ownerEmail.trim(), document: f.document.trim() || undefined,
      hostname: `${f.slug}.lexsion.com.br`,
      settings: { ...DEFAULT_BRANDING, brandName: f.name.trim(), pwaShortName: f.name.trim().split(/\s+/)[0].slice(0, 12), primary: f.primary },
    }, user?.id);
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    await qc.invalidateQueries({ queryKey: ["tenants"] });
    await qc.invalidateQueries({ queryKey: ["organizations"] });
    onCreated(r.data);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} title="Novo escritório">
      <ol className="mb-4 flex flex-wrap gap-1 text-xs" aria-label="Etapas">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-full px-2 py-1 ${i === step ? "bg-selection font-medium text-fg" : "text-fg-muted"}`}>{i + 1}. {s}</li>)}
      </ol>
      <div className="space-y-3">
        {step === 0 && (<>
          <label className="block"><span className="label">Nome do escritório</span><input className="field" value={f.name} onChange={(e) => set({ name: e.target.value, slug: f.slug && f.slug !== slugify(f.name) ? f.slug : slugify(e.target.value) })} /></label>
          <label className="block"><span className="label">Endereço (slug)</span><input className="field font-mono" value={f.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} aria-describedby="slug-h" /><span id="slug-h" className="text-xs text-fg-muted">Demonstração: /demo/tenant/{f.slug || "…"} · Futuro: {f.slug || "…"}.lexsion.com.br</span></label>
          <label className="block"><span className="label">CNPJ (opcional, fictício na demo)</span><input className="field" value={f.document} onChange={(e) => set({ document: e.target.value })} /></label>
        </>)}
        {step === 1 && (<>
          <label className="block"><span className="label">Nome do responsável</span><input className="field" value={f.ownerName} onChange={(e) => set({ ownerName: e.target.value })} /></label>
          <label className="block"><span className="label">E-mail do responsável</span><input type="email" className="field" value={f.ownerEmail} onChange={(e) => set({ ownerEmail: e.target.value })} /></label>
          <p className="text-xs text-fg-muted">Nenhum convite é enviado nesta demonstração.</p>
        </>)}
        {step === 2 && (<>
          <label className="block"><span className="label">Plano</span><select className="field" value={f.plan} onChange={(e) => set({ plan: e.target.value as PlanId })}>{(Object.keys(PLAN_LABEL) as PlanId[]).map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}</select></label>
          {f.plan === "trial" ? (
            <label className="block"><span className="label">Duração do teste</span><select className="field" value={f.trialDays} onChange={(e) => set({ trialDays: Number(e.target.value) })}>{[7, 15, 30].map((d) => <option key={d} value={d}>{d} dias</option>)}</select></label>
          ) : (
            <label className="block"><span className="label">Ciclo</span><select className="field" value={f.cycle} onChange={(e) => set({ cycle: e.target.value as BillingCycle })}><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select></label>
          )}
        </>)}
        {step === 3 && (
          <label className="block"><span className="label">Cor principal inicial</span><input type="color" className="h-11 w-20 rounded border border-line" value={f.primary} onChange={(e) => set({ primary: e.target.value })} /><span className="block text-xs text-fg-muted">O escritório ajusta logotipo e cores depois, em Configurações → Identidade visual.</span></label>
        )}
        {step === 4 && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
            <dt className="text-fg-muted">Escritório</dt><dd>{f.name}</dd>
            <dt className="text-fg-muted">Endereço</dt><dd className="font-mono">/demo/tenant/{f.slug}</dd>
            <dt className="text-fg-muted">Responsável</dt><dd>{f.ownerName} · {f.ownerEmail}</dd>
            <dt className="text-fg-muted">Plano</dt><dd>{PLAN_LABEL[f.plan]}{f.plan === "trial" ? ` · ${f.trialDays} dias` : ` · ${f.cycle}`}</dd>
          </dl>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between gap-2 pt-2">
          <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button>
          {step < 4 ? <button className="btn btn-primary" onClick={next}>Continuar</button> : <button className="btn btn-primary" disabled={busy} onClick={create}>{busy ? "Criando…" : "Criar escritório"}</button>}
        </div>
      </div>
    </Dialog>
  );
}
