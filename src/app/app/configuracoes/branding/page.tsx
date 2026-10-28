"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ImageUp, RotateCcw, Smartphone, Trash2, Undo2 } from "lucide-react";
import { useSession } from "@/components/providers";
import { Guard } from "@/components/guard";
import { Badge, PageHeader } from "@/components/ui";
import { useDirtyGuard } from "@/components/pwa";
import { tenantRepo } from "@/services/mock/tenant-repo";
import { DEFAULT_BRANDING, normalizeHex, type TenantBranding } from "@/domain/tenancy";
import { tenantTheme } from "@/lib/tenant-tokens";
import { processLogo } from "@/lib/logo-upload";
import { qrSvg } from "@/lib/qr";
import { allowed } from "@/domain/permissions";
import { tenants as seedTenants } from "@/mocks/tenants";

const TEMPLATES: [TenantBranding["template"], string, Partial<TenantBranding>][] = [
  ["executivo", "Executivo", { density: "confortavel", radius: "suave" }],
  ["classico", "Clássico", { density: "confortavel", radius: "reto" }],
  ["minimal", "Minimal", { density: "espacosa", radius: "suave" }],
  ["moderno", "Moderno", { density: "compacta", radius: "arredondado" }],
  ["personalizado", "Personalizado", {}],
];
const COLORS: [keyof TenantBranding, string][] = [["primary", "Cor principal (botões)"], ["secondary", "Cor secundária"], ["accent", "Cor de destaque (links e rótulos)"], ["backgroundDark", "Fundo do aplicativo (tela inicial)"]];

export default function IdentidadePage() {
  const { tenant, user, mode } = useSession();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<TenantBranding | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = tenant?.settings;
  // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia o rascunho quando a marca salva chega (troca de escritório recomeça)
  useEffect(() => { if (saved) setDraft(saved); }, [tenant?.id, saved]);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
  useDirtyGuard("identidade", dirty);
  const theme = useMemo(() => (draft ? tenantTheme(draft) : null), [draft]);
  if (!tenant || !draft || !theme) return null;
  const canEdit = allowed(user?.role, "gerir_marca");
  const set = (patch: Partial<TenantBranding>) => { setNotice(null); setDraft({ ...draft, ...patch }); };

  const save = async () => {
    setSaving(true);
    const r = await tenantRepo.update(tenant.id, { settings: { ...draft, brandingVersion: saved!.brandingVersion + 1 } }, user?.id, "Identidade visual atualizada");
    setSaving(false);
    if (!r.ok) return setError(r.error.message);
    await qc.invalidateQueries({ queryKey: ["tenants"] });
    setNotice("Identidade salva. Ela vale só para este escritório. Aplicativos já instalados podem levar algum tempo para trocar o ícone (depende do sistema).");
  };
  const upload = async (f: File | undefined) => {
    setError(null);
    if (!f) return;
    const r = await processLogo(f);
    if ("error" in r) return setError(r.error);
    set({ logoLight: r.dataUrl, logoDark: r.dataUrl, favicon: r.dataUrl, pwaIcon192: r.dataUrl, pwaIcon512: r.dataUrl, pwaMaskableIcon: r.dataUrl });
    setNotice(`Logotipo aceito (${r.width} × ${r.height} px), convertido para PNG seguro. Salve para aplicar.`);
  };
  const seed = seedTenants.find((t) => t.id === tenant.id)?.settings ?? DEFAULT_BRANDING;
  const logo = draft.logoLight;
  // Operação: QR abre o login do escritório (instalação do app). Demonstração: entrada pública do escritório demo.
  const appUrl = typeof location === "undefined" ? "" : mode === "real" ? `${location.origin}/entrar?escritorio=${tenant.slug}&origem=qr` : `${location.origin}/demo/tenant/${tenant.slug}?origem=qr`;
  const local = /localhost|127\.0\.0\.1|^http:\/\/(192\.168|10\.)/.test(appUrl);

  return (
    <Guard area="configuracoes">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          breadcrumb={[{ href: "/app/configuracoes", label: "Configurações" }]}
          title="Identidade visual e Meu aplicativo"
          description={`Marca de ${tenant.name}: aplicada no sistema do escritório, no portal do cliente, nos documentos e no aplicativo instalado. Não altera outros escritórios nem a plataforma LexSion.`}
          actions={canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" disabled={!dirty} onClick={() => { setDraft(saved!); setNotice("Alterações descartadas."); }}><Undo2 aria-hidden className="size-4" /> Descartar</button>
              <button className="btn btn-primary" disabled={!dirty || saving} onClick={save}><Check aria-hidden className="size-4" /> {saving ? "Salvando…" : "Salvar identidade"}</button>
            </div>
          ) : undefined}
        />
        {!canEdit && <p role="note" className="mb-4 rounded border border-info/30 bg-info-bg p-3 text-sm text-info">Somente o administrador do escritório altera a identidade. Você pode visualizar.</p>}
        <div aria-live="polite">
          {notice && <p role="status" className="mb-4 rounded border border-success/30 bg-success-bg p-3 text-sm text-success">{notice}</p>}
          {error && <p role="alert" className="mb-4 rounded border border-danger/30 bg-danger-bg p-3 text-sm text-danger">{error}</p>}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <fieldset disabled={!canEdit} className="min-w-0 space-y-6">
            <section className="panel space-y-3 p-5" aria-labelledby="t-nome">
              <h2 id="t-nome" className="font-semibold">Nome</h2>
              <label className="block"><span className="label">Nome exibido</span><input className="field" maxLength={60} value={draft.brandName} onChange={(e) => set({ brandName: e.target.value })} /></label>
              <label className="block"><span className="label">Nome curto do aplicativo</span><input className="field" maxLength={14} value={draft.pwaShortName} onChange={(e) => set({ pwaShortName: e.target.value })} aria-describedby="curto-h" /><span id="curto-h" className="text-xs text-fg-muted">Aparece embaixo do ícone no celular. Até 12 letras fica melhor.</span></label>
            </section>

            <section className="panel space-y-3 p-5" aria-labelledby="t-logo" data-tour="wl-logo">
              <h2 id="t-logo" className="font-semibold">Logotipo</h2>
              <p className="text-sm text-fg-muted">PNG, JPEG ou WebP, até 2 MB, de 64 a 4096 px. Para o ícone do aplicativo, prefira 512 × 512 px com fundo. SVG não é aceito no envio por segurança.</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data: URL local já reencodada em PNG */}
                  {logo ? <img src={logo} alt={`Logotipo de ${draft.brandName}`} className="max-h-full max-w-full" /> : <span className="text-xs text-fg-muted">Sem logotipo</span>}
                </div>
                <label className="btn btn-secondary cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"><ImageUp aria-hidden className="size-4" /> Enviar logotipo<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" data-testid="logo-input" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
                {logo && <button className="btn btn-ghost" onClick={() => set({ logoLight: seed.logoLight, logoDark: seed.logoDark, favicon: undefined, pwaIcon192: undefined, pwaIcon512: undefined, pwaMaskableIcon: undefined })}><Trash2 aria-hidden className="size-4" /> Voltar ao padrão</button>}
              </div>
            </section>

            <section className="panel space-y-3 p-5" aria-labelledby="t-cores" data-tour="wl-cores">
              <h2 id="t-cores" className="font-semibold">Cores</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {COLORS.map(([k, label]) => (
                  <ColorField key={k} label={label} value={draft[k] as string} onChange={(v) => set({ [k]: v, template: draft.template === "personalizado" ? "personalizado" : draft.template })} />
                ))}
              </div>
              {theme.adjusted.length > 0 ? (
                <div role="note" className="flex gap-2 rounded border border-warning/40 bg-warning-bg p-3 text-sm text-warning">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <div><p className="font-medium">Contraste insuficiente em algum tema — aplicamos uma variação legível automaticamente.</p><ul className="mt-1 list-disc pl-5">{theme.adjusted.map((a) => <li key={a}>{a}</li>)}</ul><p className="mt-1">Sua escolha original fica salva. Cores de sucesso, alerta e erro não mudam com a marca.</p></div>
                </div>
              ) : <p className="text-sm text-success">Contraste aprovado (WCAG AA) nos temas claro e escuro.</p>}
              <button className="btn btn-ghost" onClick={() => set({ primary: seed.primary, secondary: seed.secondary, accent: seed.accent, backgroundDark: seed.backgroundDark })}><RotateCcw aria-hidden className="size-4" /> Restaurar cores originais</button>
            </section>

            <section className="panel space-y-3 p-5" aria-labelledby="t-estilo">
              <h2 id="t-estilo" className="font-semibold">Estilo e leitura</h2>
              <div role="radiogroup" aria-label="Modelo visual" className="flex flex-wrap gap-2">
                {TEMPLATES.map(([id, label, preset]) => <button key={id} role="radio" aria-checked={draft.template === id} onClick={() => set({ template: id, ...preset })} className={`rounded-full border px-3 py-1.5 text-sm ${draft.template === id ? "border-brand bg-selection" : "border-line"}`}>{label}</button>)}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Choice label="Densidade" value={draft.density} options={[["compacta", "Compacta"], ["confortavel", "Confortável"], ["espacosa", "Espaçosa"]]} onChange={(v) => set({ density: v as TenantBranding["density"] })} />
                <Choice label="Tamanho do texto" value={draft.textSize} options={[["padrao", "Padrão"], ["grande", "Grande"], ["extra-grande", "Extra grande"]]} onChange={(v) => set({ textSize: v as TenantBranding["textSize"] })} />
                <Choice label="Cantos" value={draft.radius} options={[["reto", "Retos"], ["suave", "Suaves"], ["arredondado", "Arredondados"]]} onChange={(v) => set({ radius: v as TenantBranding["radius"] })} />
              </div>
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4" checked={!!draft.reducedMotion} onChange={(e) => set({ reducedMotion: e.target.checked })} /><span><span className="font-medium">Reduzir animações</span><span className="block text-sm text-fg-muted">Para quem se incomoda com movimento na tela.</span></span></label>
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4" checked={!!draft.simpleLanguage} onChange={(e) => set({ simpleLanguage: e.target.checked })} /><span><span className="font-medium">Linguagem simples</span><span className="block text-sm text-fg-muted">Troca termos técnicos por explicações curtas no portal e nos avisos.</span></span></label>
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4" checked={draft.showPoweredBy} onChange={(e) => set({ showPoweredBy: e.target.checked })} /><span><span className="font-medium">Mostrar “Tecnologia LexSion” no rodapé do portal</span><span className="block text-sm text-fg-muted">Discreto; a marca principal continua sendo a do escritório.</span></span></label>
            </section>
          </fieldset>

          <aside className="min-w-0 space-y-6" aria-label="Prévias">
            <Preview draft={draft} theme={theme} />
            <section className="panel space-y-3 p-5" aria-labelledby="t-app" data-tour="wl-app">
              <h2 id="t-app" className="flex items-center gap-2 font-semibold"><Smartphone aria-hidden className="size-4" /> Meu aplicativo</h2>
              <div className="flex items-center gap-3">
                <span className="inline-flex size-16 items-center justify-center overflow-hidden rounded-2xl" style={{ background: draft.backgroundDark }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- prévia do ícone */}
                  <img src={logo ?? `/tenants/${tenant.slug}/icon-192.png`} alt="" className="size-14 object-contain" />
                </span>
                <div className="min-w-0 text-sm"><p className="truncate font-medium">{draft.pwaShortName || "—"}</p><p className="text-fg-muted">Prévia do ícone na tela inicial</p></div>
              </div>
              <div className="w-fit rounded bg-white p-2" aria-label={`QR Code para ${appUrl}`} role="img" dangerouslySetInnerHTML={{ __html: appUrl ? qrSvg(appUrl, 3) : "" }} />
              <p className="break-all text-xs text-fg-muted">{appUrl}</p>
              <Badge tone="warning">Demonstração</Badge>
              {local && <p className="text-xs text-warning">Endereço local: só abre em aparelhos na mesma rede. A instalação fora de “localhost” exige HTTPS — disponível após a publicação.</p>}
              <p className="text-xs text-fg-muted">Endereço reservado para o futuro: <strong>{tenant.hostname ?? `${tenant.slug}.lexsion.com.br`}</strong> (ativa só com domínio configurado).</p>
              <details className="text-sm"><summary className="cursor-pointer font-medium">Como instalar</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-fg-muted">
                  <li><strong>Android (Chrome):</strong> abra o endereço → menu ⋮ → “Instalar app”.</li>
                  <li><strong>iPhone/iPad (Safari):</strong> Compartilhar → “Adicionar à Tela de Início”. Não testado em aparelho físico nesta fase.</li>
                  <li><strong>Computador (Chrome/Edge):</strong> ícone de instalar na barra de endereço.</li>
                </ul>
              </details>
            </section>
          </aside>
        </div>
      </div>
    </Guard>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o campo quando a cor muda por outro controle
  useEffect(() => setText(value), [value]);
  const valid = normalizeHex(text);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input type="color" aria-label={`${label} — seletor`} className="h-11 w-14 cursor-pointer rounded border border-line" value={value} onChange={(e) => onChange(e.target.value)} />
        <input className="field font-mono" aria-label={`${label} — código hexadecimal`} aria-invalid={!valid} value={text} onChange={(e) => { setText(e.target.value); const n = normalizeHex(e.target.value); if (n) onChange(n); }} />
      </div>
      {!valid && <p className="mt-1 text-xs text-danger">Use o formato #RRGGBB.</p>}
    </div>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return <label className="block"><span className="label">{label}</span><select className="field" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}

function Preview({ draft, theme }: { draft: TenantBranding; theme: ReturnType<typeof tenantTheme> }) {
  return (
    <section className="panel space-y-3 p-5" aria-labelledby="t-prev">
      <h2 id="t-prev" className="font-semibold">Prévia ao vivo</h2>
      {(["dark", "light"] as const).map((m) => {
        const t = theme[m];
        const bg = m === "dark" ? "#14171D" : "#ffffff";
        const fg = m === "dark" ? "#F7F2E8" : "#18202B";
        return (
          <div key={m} className="rounded-lg border border-line p-3" style={{ background: bg, color: fg }}>
            <p className="text-xs opacity-80">{m === "dark" ? "Tema escuro" : "Tema claro"}</p>
            <p className="mt-1 font-semibold">{draft.brandName}</p>
            <p className="text-sm" style={{ color: t.accent }}>Link de exemplo · Ver caso</p>
            <span className="mt-2 inline-block rounded px-3 py-1.5 text-sm font-medium" style={{ background: t.brand, color: t.onBrand }}>Botão principal</span>
          </div>
        );
      })}
      <p className="text-xs text-fg-muted">Celular, tablet e computador usam as mesmas cores; o layout se adapta à largura.</p>
    </section>
  );
}
