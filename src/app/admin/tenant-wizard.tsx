"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { tenantRepo } from "@/services/mock/tenant-repo";
import type { PlanId, BillingCycle, TenantBranding } from "@/domain/tenancy";
import { PLAN_LABEL } from "@/domain/tenancy";
import { Dialog } from "@/components/ui";

export function TenantWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<PlanId>("essencial");
  const [cycle, setCycle] = useState<BillingCycle>("mensal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setStep(1);
    setName("");
    setSlug("");
    setPlan("essencial");
    setCycle("mensal");
    setError("");
  };

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) {
      setError("Nome e slug obrigatórios");
      return;
    }
    setSubmitting(true);
    setError("");

    const branding: TenantBranding = {
      primaryColor: "#d6ae62",
      accentColor: "#f1d397",
      template: "executivo",
      density: "confortavel",
      textSize: "padrao",
    };

    const result = await tenantRepo.create({
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name: name.trim(),
      status: plan === "trial" ? "trial" : "ativa",
      plan,
      cycle,
      trialEndsAt: plan === "trial" ? new Date(Date.now() + 14 * 86400000).toISOString() : undefined,
      settings: branding,
    });

    setSubmitting(false);
    if (result.ok) {
      await qc.invalidateQueries({ queryKey: ["admin-tenants"] });
      reset();
      onClose();
    } else {
      setError(result.error.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nova organização">
      <div className="space-y-4">
        {step === 1 && (
          <>
            <div>
              <label className="label" htmlFor="tenant-name">Nome da organização</label>
              <input
                id="tenant-name"
                type="text"
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Escritório Exemplo Advocacia"
              />
            </div>
            <div>
              <label className="label" htmlFor="tenant-slug">Slug (URL)</label>
              <input
                id="tenant-slug"
                type="text"
                className="field"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="escritorio-exemplo"
              />
              <p className="mt-1 text-xs text-fg-muted">URL: /demo/tenant/{slug || "..."}</p>
            </div>
            <button className="btn btn-primary w-full" onClick={() => setStep(2)}>
              Próximo: Plano
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="label">Plano</label>
              <select className="field" value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
                <option value="trial">Trial (14 dias)</option>
                <option value="essencial">Essencial</option>
                <option value="profissional">Profissional</option>
                <option value="avancado">Avançado</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            {plan !== "trial" && plan !== "enterprise" && (
              <div>
                <label className="label">Ciclo de cobrança</label>
                <select className="field" value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => setStep(1)}>
                Voltar
              </button>
              <button className="btn btn-primary flex-1" onClick={handleCreate} disabled={submitting}>
                {submitting ? "Criando..." : "Criar organização"}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
