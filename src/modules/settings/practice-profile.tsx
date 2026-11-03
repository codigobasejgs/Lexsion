"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/providers";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { EMPTY_PROFILE, MODULES, POSITIONS, PRACTICE_MODELS, ROUTINE, SPECIALTIES, STRUCTURES, suggestedModules, validateProfile, type PracticeProfile, type SpecialtyId } from "@/domain/practice";

// Onboarding jurídico (fase 1): 6 etapas curtas, salva a cada etapa (dá para continuar depois). Grava no banco
// (org_practice_profiles; RLS e gatilho conferem). Na demonstração, guarda só nesta sessão do navegador.
const STEPS = ["Especialidades", "Modelo de atuação", "Estrutura", "Posição profissional", "Rotina", "Módulos"];
const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export function PracticeProfileWizard() {
  const { org, user, mode } = useSession();
  const live = mode === "real";
  const canEdit = user?.role === "admin" || user?.role === "tenant_admin";
  const [p, setP] = useState<PracticeProfile | null>(null);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!org) return;
    (async () => {
      if (!live) { try { setP({ ...EMPTY_PROFILE, ...JSON.parse(sessionStorage.getItem(`perfil-${org.id}`) ?? "{}") }); } catch { setP(EMPTY_PROFILE); } return; }
      const { data } = await supabaseBrowser().from("org_practice_profiles").select("*").eq("organization_id", org.id).maybeSingle();
      setP(data ? { ...EMPTY_PROFILE, ...(data as Partial<PracticeProfile>) } : EMPTY_PROFILE);
    })();
  }, [org, live]);
  if (!p || !org) return <p className="text-sm text-fg-muted" aria-busy="true">Carregando…</p>;
  const save = async (next: PracticeProfile, final = false) => {
    setBusy(true); setMsg(null);
    const row = { ...next, completed_at: final ? new Date().toISOString() : next.completed_at };
    if (final) { const e = validateProfile(row); if (e) { setBusy(false); return setMsg({ ok: false, text: e }); } }
    if (!live) { try { sessionStorage.setItem(`perfil-${org.id}`, JSON.stringify(row)); } catch {} setP(row); setBusy(false); return setMsg({ ok: true, text: final ? "Perfil salvo (demonstração: só nesta sessão)." : "Etapa salva." }); }
    const { error } = await supabaseBrowser().from("org_practice_profiles").upsert({ organization_id: org.id, ...row }, { onConflict: "organization_id" });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message.replace(/^.*?: /, "") || "Não foi possível salvar." });
    setP(row);
    setMsg({ ok: true, text: final ? "Perfil de atuação salvo. O painel e os atalhos passam a seguir sua especialidade." : "Etapa salva. Você pode continuar depois." });
  };
  const next = async () => { if (step === 0 && validateProfile({ ...p, modules: [] })?.match(/especialidade/i)) return setMsg({ ok: false, text: validateProfile({ ...p, modules: [] })! }); await save(p); setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const set = (patch: Partial<PracticeProfile>) => setP({ ...p, ...patch });
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-selection text-fg" : "border-line text-fg-muted hover:text-fg"}`;
  if (!canEdit) return <ProfileSummary p={p} />;
  return (
    <section className="panel space-y-4 p-5" aria-labelledby="pp-h" data-testid="perfil-atuacao">
      <div><h2 id="pp-h" className="font-semibold">Perfil de atuação do escritório</h2><p className="text-sm text-fg-muted">Etapa {step + 1} de {STEPS.length}: {STEPS[step]}. Cada etapa é salva; dá para continuar depois.</p></div>
      <ol className="flex flex-wrap gap-1 text-xs" aria-label="Etapas">{STEPS.map((s, i) => <li key={s}><button className={chip(i === step)} aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)}>{i + 1}. {s}</button></li>)}</ol>

      {step === 0 && (
        <fieldset className="space-y-3"><legend className="text-sm">Escolha uma ou mais especialidades e marque a principal.</legend>
          {SPECIALTIES.map((s) => {
            const on = p.areas.includes(s.id);
            return (
              <div key={s.id} className="rounded border border-line p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex flex-1 items-center gap-2"><input type="checkbox" className="size-4" checked={on} onChange={() => set({ areas: toggle(p.areas, s.id as SpecialtyId), primary_area: on && p.primary_area === s.id ? null : p.primary_area ?? (s.id as SpecialtyId) })} /> {s.label}</label>
                  {on && <label className="flex items-center gap-1 text-xs"><input type="radio" name="principal" checked={p.primary_area === s.id} onChange={() => set({ primary_area: s.id as SpecialtyId })} /> principal</label>}
                </div>
                {on && <div className="mt-2 flex flex-wrap gap-1">{s.subs.map((x) => <button key={x} type="button" aria-pressed={p.subareas.includes(`${s.id}:${x}`)} className={chip(p.subareas.includes(`${s.id}:${x}`))} onClick={() => set({ subareas: toggle(p.subareas, `${s.id}:${x}`) })}>{x}</button>)}</div>}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2"><label className="block flex-1"><span className="label">Outra área (personalizada)</span><input className="field" value={custom} maxLength={60} onChange={(e) => setCustom(e.target.value)} /></label>
            <button className="btn btn-secondary self-end" disabled={custom.trim().length < 2} onClick={() => { set({ custom_areas: [...new Set([...p.custom_areas, custom.trim()])] }); setCustom(""); }}>Adicionar</button></div>
          {p.custom_areas.length > 0 && <ul className="flex flex-wrap gap-1">{p.custom_areas.map((c) => <li key={c}><button className={chip(true)} aria-label={`Remover ${c}`} onClick={() => set({ custom_areas: p.custom_areas.filter((x) => x !== c) })}>{c} ×</button></li>)}</ul>}
        </fieldset>
      )}
      {step === 1 && <fieldset><legend className="mb-2 text-sm">Modelo de atuação (vários). Especialidade é a área; aqui é como você atua.</legend><div className="flex flex-wrap gap-1">{PRACTICE_MODELS.map((m) => <button key={m} aria-pressed={p.practice_models.includes(m)} className={chip(p.practice_models.includes(m))} onClick={() => set({ practice_models: toggle(p.practice_models, m) })}>{m}</button>)}</div></fieldset>}
      {step === 2 && <fieldset className="space-y-1"><legend className="mb-2 text-sm">Estrutura do escritório</legend>{STRUCTURES.map((x) => <label key={x} className="flex items-center gap-2 text-sm"><input type="radio" name="estrutura" checked={p.structure === x} onChange={() => set({ structure: x })} /> {x}</label>)}</fieldset>}
      {step === 3 && <fieldset className="space-y-1"><legend className="mb-2 text-sm">Sua posição profissional (não muda permissões: elas ficam em Equipe)</legend>{POSITIONS.map((x) => <label key={x} className="flex items-center gap-2 text-sm"><input type="radio" name="posicao" checked={p.position === x} onChange={() => set({ position: x })} /> {x}</label>)}</fieldset>}
      {step === 4 && <fieldset><legend className="mb-2 text-sm">Rotina do escritório</legend><div className="grid gap-1 sm:grid-cols-2">{ROUTINE.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={!!p.routine[k]} onChange={(e) => set({ routine: { ...p.routine, [k]: e.target.checked } })} /> {l}</label>)}</div></fieldset>}
      {step === 5 && (
        <fieldset className="space-y-3"><legend className="text-sm">Módulos que você quer usar. Só aparecem para seleção os que já existem; os demais ficam indicados.</legend>
          <button className="btn btn-ghost min-h-9" onClick={() => set({ modules: suggestedModules(p) })}>Sugerir pela minha especialidade e rotina</button>
          {[...new Set(MODULES.map((m) => m.group))].map((g) => (
            <div key={g}><p className="label">{g}</p><ul className="grid gap-1 sm:grid-cols-2">{MODULES.filter((m) => m.group === g).map((m) => (
              <li key={m.id}><label className={`flex items-center gap-2 text-sm ${m.status !== "disponivel" ? "text-fg-muted" : ""}`}><input type="checkbox" className="size-4" disabled={m.status !== "disponivel"} checked={p.modules.includes(m.id)} onChange={() => set({ modules: toggle(p.modules, m.id) })} /> {m.label}{m.status === "auditoria" ? " (em auditoria)" : m.status === "futuro" ? " (ainda não disponível)" : ""}</label></li>
            ))}</ul></div>
          ))}
          <p className="text-xs text-fg-muted">Escolher módulos não gera cobrança: os recursos do seu plano estão em Configurações → Assinatura LexSion.</p>
        </fieldset>
      )}
      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}</div>
      <div className="flex flex-wrap gap-2">
        {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Voltar</button>}
        {step < STEPS.length - 1 ? <button className="btn btn-primary" disabled={busy} onClick={() => void next()}>{busy ? "Salvando…" : "Salvar e continuar"}</button>
          : <button className="btn btn-primary" disabled={busy} onClick={() => void save(p, true)}>{busy ? "Salvando…" : "Concluir perfil"}</button>}
      </div>
      {p.completed_at && <ProfileSummary p={p} />}
    </section>
  );
}

export function ProfileSummary({ p }: { p: PracticeProfile }) {
  const name = (id: string) => SPECIALTIES.find((s) => s.id === id)?.label ?? id;
  const mods = MODULES.filter((m) => p.modules.includes(m.id) && m.href);
  return (
    <div className="space-y-2 text-sm" data-testid="perfil-resumo">
      <p><strong>Especialidade principal:</strong> {p.primary_area ? name(p.primary_area) : "não definida"}{p.areas.length > 1 ? ` · também: ${p.areas.filter((a) => a !== p.primary_area).map(name).join(", ")}` : ""}{p.custom_areas.length ? ` · ${p.custom_areas.join(", ")}` : ""}</p>
      {p.practice_models.length > 0 && <p><strong>Atuação:</strong> {p.practice_models.join(", ")}</p>}
      {mods.length > 0 && <p className="flex flex-wrap gap-1"><strong className="mr-1">Atalhos:</strong>{mods.map((m) => <Link key={m.id} href={m.href!} className="btn btn-ghost min-h-8 px-2">{m.label}</Link>)}</p>}
    </div>
  );
}

/** Cartão do painel (Meu dia): especialidade e atalhos do escritório, ou convite para definir o perfil. Operação real. */
export function PracticeCard() {
  const { org, mode, tenant } = useSession();
  const [p, setP] = useState<PracticeProfile | null | undefined>(undefined);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    if (!org || mode !== "real") return;
    void supabaseBrowser().from("org_practice_profiles").select("*").eq("organization_id", org.id).maybeSingle().then(({ data }: { data: unknown }) => setP(data ? { ...EMPTY_PROFILE, ...(data as Partial<PracticeProfile>) } : null));
  }, [org, mode]);
  if (mode !== "real" || p === undefined) return null;
  const trialEnd = tenant?.trialEndsAt;
  const left = trialEnd && now ? Math.ceil((Date.parse(trialEnd) - now) / 86_400_000) : null;
  return (
    <section className="panel space-y-2 p-4 text-sm" data-testid="painel-especialidade">
      {tenant?.status === "trial" && left !== null && <p className="text-info">Teste grátis: {left > 0 ? `${left} dia(s) restantes, até ${new Date(trialEnd!).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "encerrado"}. <Link className="underline" href="/app/configuracoes?aba=assinatura">Assinatura</Link></p>}
      {p?.completed_at ? <ProfileSummary p={p} /> : <p>Defina as especialidades e os módulos do escritório para o painel seguir a sua rotina. <Link className="text-accent underline" href="/app/boas-vindas#perfil-atuacao">Definir perfil de atuação</Link></p>}
    </section>
  );
}
