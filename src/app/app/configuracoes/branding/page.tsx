"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Upload } from "lucide-react";
import { useSession } from "@/components/providers";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/ui";
import { tenantRepo } from "@/services/mock/tenant-repo";
import type { TenantBranding } from "@/domain/tenancy";
import { contrast } from "@/lib/contrast";

const TEMPLATES = [
  { id: "executivo" as const, label: "Executivo", desc: "Elegante e profissional" },
  { id: "classico" as const, label: "Clássico", desc: "Tradicional e confiável" },
  { id: "minimal" as const, label: "Minimal", desc: "Limpo e moderno" },
  { id: "moderno" as const, label: "Moderno", desc: "Ousado e criativo" },
];

const DENSITIES = [
  { id: "compacta" as const, label: "Compacta", desc: "Mais informação por tela" },
  { id: "confortavel" as const, label: "Confortável", desc: "Equilíbrio" },
  { id: "espaçosa" as const, label: "Espaçosa", desc: "Mais respiro visual" },
];

const TEXT_SIZES = [
  { id: "padrao" as const, label: "Padrão" },
  { id: "grande" as const, label: "Grande" },
  { id: "extra-grande" as const, label: "Extra grande" },
];

export default function BrandingPage() {
  const { tenant, ready } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TenantBranding>(tenant?.settings ?? {
    primaryColor: "#d6ae62",
    accentColor: "#f1d397",
    template: "executivo",
    density: "confortavel",
    textSize: "padrao",
  });

  if (!ready || !tenant) return null;

  const handleSave = async () => {
    setSaving(true);
    await tenantRepo.update(tenant.id, { settings });
    await qc.invalidateQueries({ queryKey: ["admin-tenants"] });
    setSaving(false);
    router.refresh();
  };

  const primaryContrast = contrast(settings.primaryColor, "#ffffff");
  const accentContrast = contrast(settings.accentColor, "#ffffff");

  return (
    <Guard area="configuracoes">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title="Identidade da empresa"
          description="Personalize cores, logotipo e aparência do sistema. As mudanças se aplicam a toda organização."
          actions={
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Check aria-hidden className="size-4" /> {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          }
        />

        <div className="space-y-6">
          {/* Logo */}
          <section className="panel p-5">
            <h2 className="mb-3 font-semibold">Logotipo</h2>
            <p className="mb-4 text-sm text-fg-muted">
              PNG ou SVG, até 2 MB, recomendado 512×512px. Aparece no cabeçalho, emails e documentos.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-lg border-2 border-dashed border-line bg-surface-muted text-fg-muted">
                {settings.logo ? <img src={settings.logo} alt="Logo" className="max-h-full max-w-full" /> : "Logo"}
              </div>
              <button className="btn btn-secondary" disabled>
                <Upload aria-hidden className="size-4" /> Upload (demo bloqueado)
              </button>
            </div>
          </section>

          {/* Cores */}
          <section className="panel p-5">
            <h2 className="mb-3 font-semibold">Cores da marca</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="primary-color">Cor principal</label>
                <div className="flex gap-2">
                  <input
                    id="primary-color"
                    type="color"
                    className="size-11 cursor-pointer rounded-[var(--radius-control)] border border-line"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="field flex-1"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                  />
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  Contraste com branco: {primaryContrast.toFixed(2)}:1 {primaryContrast >= 4.5 ? "✓ AA" : "⚠ Baixo"}
                </p>
              </div>
              <div>
                <label className="label" htmlFor="accent-color">Cor de destaque</label>
                <div className="flex gap-2">
                  <input
                    id="accent-color"
                    type="color"
                    className="size-11 cursor-pointer rounded-[var(--radius-control)] border border-line"
                    value={settings.accentColor}
                    onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="field flex-1"
                    value={settings.accentColor}
                    onChange={(e) => setSettings({ ...settings, accentColor: e.target.value })}
                  />
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  Contraste com branco: {accentContrast.toFixed(2)}:1 {accentContrast >= 4.5 ? "✓ AA" : "⚠ Baixo"}
                </p>
              </div>
            </div>
          </section>

          {/* Template */}
          <section className="panel p-5">
            <h2 className="mb-3 font-semibold">Estilo visual</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border-2 p-3 transition-colors ${
                    settings.template === t.id ? "border-brand bg-selection" : "border-line hover:border-line-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={settings.template === t.id}
                    onChange={() => setSettings({ ...settings, template: t.id })}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-sm text-fg-muted">{t.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Densidade */}
          <section className="panel p-5">
            <h2 className="mb-3 font-semibold">Densidade de informação</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {DENSITIES.map((d) => (
                <label
                  key={d.id}
                  className={`flex cursor-pointer flex-col gap-1 rounded-[var(--radius-control)] border-2 p-3 transition-colors ${
                    settings.density === d.id ? "border-brand bg-selection" : "border-line hover:border-line-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="density"
                    value={d.id}
                    checked={settings.density === d.id}
                    onChange={() => setSettings({ ...settings, density: d.id })}
                    className="sr-only"
                  />
                  <p className="font-medium">{d.label}</p>
                  <p className="text-xs text-fg-muted">{d.desc}</p>
                </label>
              ))}
            </div>
          </section>

          {/* Tamanho texto */}
          <section className="panel p-5">
            <h2 className="mb-3 font-semibold">Tamanho do texto</h2>
            <div className="flex gap-3">
              {TEXT_SIZES.map((s) => (
                <label
                  key={s.id}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border-2 p-3 transition-colors ${
                    settings.textSize === s.id ? "border-brand bg-selection font-medium" : "border-line hover:border-line-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="textSize"
                    value={s.id}
                    checked={settings.textSize === s.id}
                    onChange={() => setSettings({ ...settings, textSize: s.id })}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </section>

          {/* Acessibilidade */}
          <section className="panel p-5">
            <h2 className="mb-3 font-semibold">Acessibilidade</h2>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={settings.reducedMotion ?? false}
                onChange={(e) => setSettings({ ...settings, reducedMotion: e.target.checked })}
              />
              <div>
                <p className="font-medium">Reduzir animações</p>
                <p className="text-sm text-fg-muted">Para quem tem sensibilidade a movimento</p>
              </div>
            </label>
            <label className="mt-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={settings.simpleLanguage ?? false}
                onChange={(e) => setSettings({ ...settings, simpleLanguage: e.target.checked })}
              />
              <div>
                <p className="font-medium">Linguagem simplificada</p>
                <p className="text-sm text-fg-muted">Textos mais diretos e objetivos</p>
              </div>
            </label>
          </section>
        </div>
      </div>
    </Guard>
  );
}
