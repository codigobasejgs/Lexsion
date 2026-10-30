"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Download, FileText, Loader2, Lock, Printer, ShieldCheck } from "lucide-react";
import { formatBRL } from "@/lib/money";
import type { PublicPlan } from "@/domain/saas";
import { DRAFT_BANNER, renderContract, validateParty, type Party, type Supplier, type TemplateVersion } from "@/domain/saas-contract";

// Jornada: Plano → Dados do contratante → Revisar contrato → Aceite (código por e-mail) → Pagamento ou teste grátis.
// A prévia ao vivo é só conforto: o TEXTO que vale (e o hash) vem do servidor no passo “Revisar”.
// Rascunho local (sessionStorage) para não perder o preenchimento ao voltar; nada de CPF em URL.
const STEPS = ["Plano", "Seus dados", "Contrato", "Aceite", "Pagamento"] as const;
const slugify = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const EMPTY_ADDR = { cep: "", street: "", number: "", complement: "", district: "", city: "", uf: "" };
type Form = { plan: string; cycle: "mensal" | "anual"; kind: "PF" | "PJ"; slug: string; marketing: boolean;
  pf: { name: string; cpf: string; email: string; phone: string; oab: string; trade_name: string };
  pj: { legal_name: string; trade_name: string; cnpj: string; rep: { name: string; cpf: string; role: string; email: string; phone: string; oab: string }; rep_powers: boolean };
  address: typeof EMPTY_ADDR };
type Server = { token: string; number: string; binding: boolean; templateVersion: string; templateStatus: string; text: string; hash: string; holderEmail: string; status: string; accepted_at: string | null; plan: { label: string; cycle: string; amount: number; trial_days: number } };
const DRAFT_KEY = "lexsion.contratar";
const load = (): Partial<Form> | null => { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null"); } catch { return null; } };

export function SignupForm({ plans, initialPlan, supplier, template }: { plans: PublicPlan[]; initialPlan: string; contractVersion?: string; supplier: Supplier; template: Pick<TemplateVersion, "title" | "clauses" | "version" | "status"> | null }) {
  const [f, setF] = useState<Form>(() => ({ plan: initialPlan, cycle: "mensal", kind: "PF", slug: "", marketing: false, pf: { name: "", cpf: "", email: "", phone: "", oab: "", trade_name: "" }, pj: { legal_name: "", trade_name: "", cnpj: "", rep: { name: "", cpf: "", role: "", email: "", phone: "", oab: "" }, rep_powers: false }, address: EMPTY_ADDR }));
  const [step, setStep] = useState(0);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [srv, setSrv] = useState<Server | null>(null);
  const [token, setToken] = useState("");
  const [read, setRead] = useState(false), [agree, setAgree] = useState(false), [otp, setOtp] = useState(""), [otpSent, setOtpSent] = useState<string | null>(null);
  const [done, setDone] = useState<{ kind: string; url?: string; message?: string; activation?: string | null } | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const head = useRef<HTMLHeadingElement>(null);

  // Retoma rascunho e token desta aba (não sai do navegador; CPF nunca vai para URL).
  useEffect(() => {
    const d = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restauração única do rascunho desta aba
    // O plano escolhido agora (?plano=) prevalece sobre o do rascunho; os dados digitados são preservados.
    if (d) setF((cur) => ({ ...cur, ...d, plan: cur.plan, cycle: d.plan === cur.plan ? (d.cycle ?? cur.cycle) : "mensal" }));
    try { const t = sessionStorage.getItem(`${DRAFT_KEY}.token`); if (t) setToken(t); } catch {}
  }, [plans]);
  useEffect(() => { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch {} }, [f]);
  useEffect(() => { head.current?.focus(); }, [step]);

  const plan = plans.find((p) => p.id === f.plan) ?? plans[0];
  const price = f.cycle === "anual" && plan.price_yearly ? plan.price_yearly : plan.price_monthly;
  const party: Party = f.kind === "PF" ? { kind: "PF", ...f.pf, address: f.address } : { kind: "PJ", ...f.pj, address: f.address };
  const office = f.kind === "PF" ? (f.pf.trade_name || f.pf.name) : (f.pj.trade_name || f.pj.legal_name);
  const set = (patch: Partial<Form>) => setF((cur) => ({ ...cur, ...patch }));
  const setPf = (k: keyof Form["pf"], v: string) => setF((cur) => ({ ...cur, pf: { ...cur.pf, [k]: v }, ...(!slugTouched && (k === "trade_name" || k === "name") ? { slug: slugify(k === "trade_name" ? v || cur.pf.name : cur.pf.trade_name || v) } : {}) }));
  const setPj = (k: keyof Form["pj"], v: string | boolean) => setF((cur) => ({ ...cur, pj: { ...cur.pj, [k]: v }, ...(!slugTouched && (k === "trade_name" || k === "legal_name") && typeof v === "string" ? { slug: slugify(k === "trade_name" ? v || cur.pj.legal_name : cur.pj.trade_name || v) } : {}) }));
  const setRep = (k: keyof Form["pj"]["rep"], v: string) => setF((cur) => ({ ...cur, pj: { ...cur.pj, rep: { ...cur.pj.rep, [k]: v } } }));
  const setAddr = (k: keyof typeof EMPTY_ADDR, v: string) => setF((cur) => ({ ...cur, address: { ...cur.address, [k]: k === "uf" ? v.toUpperCase().slice(0, 2) : v } }));

  // Prévia ao vivo (mesmo renderizador do servidor), com tarja de minuta.
  const preview = useMemo(() => template ? renderContract(template, { supplier, party, plan: { id: plan.id, label: plan.label, version: plan.version, price_monthly: plan.price_monthly, price_yearly: plan.price_yearly, max_users: plan.max_users, trial_days: plan.trial_days, features: plan.features }, cycle: f.cycle, number: srv?.number ?? "LX-(gerado na revisão)", date: new Date().toLocaleDateString("pt-BR"), templateVersion: template.version, draft: true }) : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, supplier, JSON.stringify(party), plan, f.cycle, srv?.number]);

  const cep = async () => {
    const d = f.address.cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    // ViaCEP (pública): só preenche; o usuário confere e edita. Falha não bloqueia.
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: AbortSignal.timeout(6000) }).then((x) => x.json()).catch(() => null);
    if (r && !r.erro) setF((cur) => ({ ...cur, address: { ...cur.address, street: cur.address.street || r.logradouro || "", district: cur.address.district || r.bairro || "", city: cur.address.city || r.localidade || "", uf: cur.address.uf || r.uf || "" } }));
  };

  const call = async (body: Record<string, unknown>) => fetch("/api/contrato", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) }).then(async (x) => ({ status: x.status, j: await x.json().catch(() => null) })).catch(() => ({ status: 0, j: null }));

  const toReview = async () => {
    setMsg(null);
    const v = validateParty(party);
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(f.slug)) v.slug = "Endereço: 3 a 40 letras minúsculas, números ou hífen.";
    setErrs(v);
    if (Object.keys(v).length) { setMsg("Corrija os campos indicados."); document.getElementById(`c-${Object.keys(v)[0]}`)?.focus(); return; }
    setBusy(true);
    const { status, j } = await call({ action: "save", plan: f.plan, cycle: f.cycle, party, slug: f.slug, marketing: f.marketing });
    setBusy(false);
    if (j?.ok) { setSrv(j.data); setToken(j.data.token); try { sessionStorage.setItem(`${DRAFT_KEY}.token`, j.data.token); } catch {} setRead(false); setAgree(false); setOtp(""); setOtpSent(null); setStep(2); return; }
    if (status === 409 && j?.error?.code === "locked") { try { sessionStorage.removeItem(`${DRAFT_KEY}.token`); } catch {} setToken(""); }
    setErrs(j?.error?.fields ?? (j?.error?.field ? { [j.error.field]: j.error.message } : {}));
    setMsg(j?.error?.message ?? "Sem conexão. Nada foi gravado; tente de novo.");
  };
  const sendOtp = async () => {
    setMsg(null); setBusy(true);
    const { j } = await call({ action: "otp", hash: srv!.hash });
    setBusy(false);
    if (j?.ok) setOtpSent(j.data.sentTo); else setMsg(j?.error?.message ?? "Sem conexão.");
  };
  const accept = async () => {
    setMsg(null); setBusy(true);
    const { j } = await call({ action: "accept", hash: srv!.hash, read, agree, otp });
    setBusy(false);
    if (!j?.ok) { setErrs(j?.error?.field ? { [j.error.field]: j.error.message } : {}); setMsg(j?.error?.message ?? "Sem conexão."); return; }
    setSrv((s) => ({ ...s!, ...j.data })); setDone(j.data.next); setStep(4);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
  };

  const E = ({ k }: { k: string }) => errs[k] ? <p id={`e-${k}`} className="mt-1 text-sm text-danger">{errs[k]}</p> : null;
  const input = (k: string, label: string, value: string, on: (v: string) => void, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label htmlFor={`c-${k}`} className="label">{label}</label><input id={`c-${k}`} className="field" value={value} onChange={(e) => on(e.target.value)} aria-invalid={!!errs[k]} aria-describedby={errs[k] ? `e-${k}` : undefined} {...extra} /><E k={k} /></div>
  );
  const binding = srv?.binding ?? template?.status === "PUBLICADO";

  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Etapas da contratação">
          {STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={`flex items-center gap-1.5 ${i === step ? "font-semibold text-accent" : i < step ? "text-fg" : "text-fg-muted"}`}><span className={`grid size-6 place-items-center rounded-full border text-xs ${i < step ? "border-success bg-success-bg text-success" : i === step ? "border-brand" : "border-line"}`}>{i < step ? <Check aria-hidden className="size-3.5" /> : i + 1}</span>{s}</li>)}
        </ol>
        <div className="h-1 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Progresso da contratação" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step + 1}><div className="h-full bg-brand transition-all" style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>
        <h2 ref={head} tabIndex={-1} className="text-xl font-semibold outline-none">{["Escolha o plano", "Dados do contratante", "Revise o contrato", "Aceite eletrônico", "Concluir"][step]}</h2>
        {msg && <p role="alert" className="rounded border border-danger/40 bg-danger-bg p-3 text-sm text-danger">{msg}</p>}

        {step === 0 && (
          <section className="space-y-4">
            <fieldset><legend className="label">Plano</legend>
              <div className="grid gap-2 sm:grid-cols-3">{plans.map((p) => (
                <label key={p.id} className={`flex cursor-pointer flex-col rounded-[var(--radius-control)] border p-3 ${f.plan === p.id ? "border-brand bg-selection" : "border-line"}`}>
                  <span className="flex items-center gap-2"><input type="radio" name="plano" value={p.id} checked={f.plan === p.id} onChange={() => set({ plan: p.id, cycle: "mensal" })} className="size-4 accent-[var(--brand)]" /><strong>{p.label}</strong></span>
                  <span className="mt-1 text-sm">{formatBRL(p.price_monthly)}/mês · até {p.max_users} {p.max_users === 1 ? "usuário" : "usuários"}</span>
                  {p.trial_days > 0 && <span className="text-xs text-success">{p.trial_days} dias grátis</span>}
                </label>))}</div>
            </fieldset>
            <fieldset><legend className="label">Ciclo</legend>
              <div className="flex gap-2"><label className="flex items-center gap-2"><input type="radio" name="ciclo" checked={f.cycle === "mensal"} onChange={() => set({ cycle: "mensal" })} className="size-4" /> Mensal</label>
                {plan.price_yearly ? <label className="flex items-center gap-2"><input type="radio" name="ciclo" checked={f.cycle === "anual"} onChange={() => set({ cycle: "anual" })} className="size-4" /> Anual ({formatBRL(plan.price_yearly)})</label> : <span className="text-sm text-fg-muted">Anual não disponível neste plano.</span>}</div>
            </fieldset>
            <button className="btn btn-primary min-h-12" onClick={() => setStep(1)}>Continuar</button>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4" aria-describedby="finalidade">
            <p id="finalidade" className="text-sm text-fg-muted">Usamos estes dados só para gerar o contrato, criar o acesso do titular e emitir as cobranças, conforme a <Link href="/privacidade" target="_blank" className="text-accent underline">política de privacidade</Link>.</p>
            <fieldset><legend className="label">Você contrata como</legend>
              <div className="inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-sm" role="radiogroup">
                {(["PF", "PJ"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set({ kind: k })} className={`min-h-10 rounded-md px-3 ${f.kind === k ? "bg-brand text-on-brand" : "text-fg-muted"}`}>{k === "PF" ? "Advogado(a) — pessoa física" : "Escritório — pessoa jurídica"}</button>)}
              </div>
            </fieldset>
            {f.kind === "PF" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {input("name", "Nome completo", f.pf.name, (v) => setPf("name", v), { autoComplete: "name" })}
                {input("cpf", "CPF", f.pf.cpf, (v) => setPf("cpf", v), { inputMode: "numeric", autoComplete: "off" })}
                {input("email", "E-mail (receberá o acesso e o código de aceite)", f.pf.email, (v) => setPf("email", v), { type: "email", autoComplete: "email" })}
                {input("phone", "Celular/WhatsApp com DDD", f.pf.phone, (v) => setPf("phone", v), { type: "tel", inputMode: "tel", autoComplete: "tel" })}
                {input("oab", "OAB/UF (opcional, ex.: 123456/SP)", f.pf.oab, (v) => setPf("oab", v))}
                {input("trade_name", "Nome do escritório (opcional)", f.pf.trade_name, (v) => setPf("trade_name", v), { autoComplete: "organization" })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {input("legal_name", "Razão social", f.pj.legal_name, (v) => setPj("legal_name", v), { autoComplete: "organization" })}
                {input("trade_name", "Nome fantasia (opcional)", f.pj.trade_name, (v) => setPj("trade_name", v))}
                {input("cnpj", "CNPJ", f.pj.cnpj, (v) => setPj("cnpj", v), { inputMode: "numeric" })}
                <div className="sm:col-span-2 mt-2 font-medium">Responsável legal (receberá o acesso de titular)</div>
                {input("rep.name", "Nome completo", f.pj.rep.name, (v) => setRep("name", v), { autoComplete: "name" })}
                {input("rep.cpf", "CPF", f.pj.rep.cpf, (v) => setRep("cpf", v), { inputMode: "numeric", autoComplete: "off" })}
                {input("rep.role", "Cargo/função (ex.: sócio-administrador)", f.pj.rep.role, (v) => setRep("role", v))}
                {input("rep.email", "E-mail", f.pj.rep.email, (v) => setRep("email", v), { type: "email", autoComplete: "email" })}
                {input("rep.phone", "Celular com DDD", f.pj.rep.phone, (v) => setRep("phone", v), { type: "tel", inputMode: "tel", autoComplete: "tel" })}
                {input("rep.oab", "OAB/UF (opcional)", f.pj.rep.oab, (v) => setRep("oab", v))}
                <label className="flex items-start gap-2 text-sm sm:col-span-2"><input id="c-rep_powers" type="checkbox" className="mt-1 size-4" checked={f.pj.rep_powers} onChange={(e) => setPj("rep_powers", e.target.checked)} aria-invalid={!!errs.rep_powers} /> Declaro que tenho poderes para contratar em nome da pessoa jurídica.</label><E k="rep_powers" />
              </div>
            )}
            <fieldset className="grid gap-3 sm:grid-cols-6"><legend className="label sm:col-span-6">Endereço {f.kind === "PJ" ? "da sede" : ""}</legend>
              <div className="sm:col-span-2">{input("address.cep", "CEP", f.address.cep, (v) => setAddr("cep", v), { inputMode: "numeric", autoComplete: "postal-code", onBlur: () => void cep() })}</div>
              <div className="sm:col-span-4">{input("address.street", "Logradouro", f.address.street, (v) => setAddr("street", v), { autoComplete: "address-line1" })}</div>
              <div className="sm:col-span-2">{input("address.number", "Número", f.address.number, (v) => setAddr("number", v))}</div>
              <div className="sm:col-span-4">{input("address.complement", "Complemento (opcional)", f.address.complement, (v) => setAddr("complement", v), { autoComplete: "address-line2" })}</div>
              <div className="sm:col-span-2">{input("address.district", "Bairro", f.address.district, (v) => setAddr("district", v))}</div>
              <div className="sm:col-span-3">{input("address.city", "Cidade", f.address.city, (v) => setAddr("city", v), { autoComplete: "address-level2" })}</div>
              <div className="sm:col-span-1">{input("address.uf", "UF", f.address.uf, (v) => setAddr("uf", v), { autoComplete: "address-level1", maxLength: 2 })}</div>
            </fieldset>
            {input("slug", "Endereço do escritório na LexSion (letras, números e hífen)", f.slug, (v) => { setSlugTouched(true); set({ slug: slugify(v) }); })}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={f.marketing} onChange={(e) => set({ marketing: e.target.checked })} /> Quero receber novidades e conteúdos da LexSion por e-mail (opcional; não interfere na contratação).</label>
            <div className="flex flex-wrap gap-2"><button className="btn btn-ghost" onClick={() => setStep(0)}><ArrowLeft aria-hidden className="size-4" /> Voltar</button><button className="btn btn-primary min-h-12" disabled={busy} onClick={() => void toReview()}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <FileText aria-hidden className="size-4" />} Revisar contrato</button></div>
          </section>
        )}

        {step === 2 && srv && (
          <section className="space-y-4">
            {!srv.binding && <p role="status" className="rounded border border-warning/40 bg-warning-bg p-3 text-sm text-warning"><strong>Pendente de aprovação jurídica.</strong> Esta é uma minuta para leitura; o aceite será liberado quando a versão final for aprovada por advogado(a). Nenhum valor é cobrado e nenhum aceite é registrado agora.</p>}
            <ContractPaper text={srv.text} number={srv.number} hash={srv.hash} big />
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost" onClick={() => setStep(1)}><ArrowLeft aria-hidden className="size-4" /> Corrigir dados</button>
              <a className="btn btn-secondary" href="#" onClick={(e) => { e.preventDefault(); void downloadPdf(token); }}><Download aria-hidden className="size-4" /> Baixar {srv.binding ? "PDF" : "minuta em PDF"}</a>
              <button className="btn btn-secondary" onClick={() => print()}><Printer aria-hidden className="size-4" /> Imprimir</button>
              {srv.binding && <button className="btn btn-primary min-h-12" onClick={() => setStep(3)}>Continuar para o aceite</button>}
            </div>
          </section>
        )}

        {step === 3 && srv && (
          <section className="space-y-4">
            <p className="text-sm">Contrato <strong>{srv.number}</strong> · modelo {srv.templateVersion} · impressão digital SHA-256 <code className="break-all text-xs">{srv.hash}</code></p>
            <label className="flex items-start gap-2"><input id="c-read" type="checkbox" className="mt-1 size-4" checked={read} onChange={(e) => setRead(e.target.checked)} /> Li o contrato integral, incluindo o Quadro-Resumo e os anexos.</label>
            <label className="flex items-start gap-2"><input id="c-agree" type="checkbox" className="mt-1 size-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-invalid={!!errs.agree} /> Aceito o contrato nesta versão, em nome {f.kind === "PJ" ? "da pessoa jurídica contratante" : "próprio"}.</label><E k="agree" />
            <div className="panel space-y-3 p-4 text-sm">
              <p>Para comprovar o aceite, enviamos um código de uso único ao e-mail do titular ({srv.holderEmail}). Ele vale por 10 minutos e só para esta versão do contrato.</p>
              <button className="btn btn-secondary" disabled={busy || !read || !agree} onClick={() => void sendOtp()}>{otpSent ? "Reenviar código" : "Enviar código"}</button>
              {otpSent && <p role="status" className="text-success">Código enviado para {otpSent}.</p>}
              {otpSent && input("otp", "Código recebido por e-mail", otp, (v) => setOtp(v.replace(/\D/g, "").slice(0, 6)), { inputMode: "numeric", autoComplete: "one-time-code" })}
            </div>
            <div className="flex flex-wrap gap-2"><button className="btn btn-ghost" onClick={() => setStep(2)}><ArrowLeft aria-hidden className="size-4" /> Reler contrato</button>
              <button className="btn btn-primary min-h-12" disabled={busy || !read || !agree || otp.length !== 6} onClick={() => void accept()}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ShieldCheck aria-hidden className="size-4" />} Aceitar eletronicamente</button></div>
            <p className="text-xs text-fg-muted">Registramos data e hora, versão e impressão digital do texto, e-mail, navegador e um código derivado do IP. Isso é um aceite eletrônico comprovável; não é assinatura digital ICP-Brasil.</p>
          </section>
        )}

        {step === 4 && done && (
          <section role="status" className="space-y-3">
            <p className="flex items-center gap-2 text-success"><Check aria-hidden className="size-5" /> Aceite eletrônico registrado (contrato {srv?.number}).</p>
            {done.kind === "trial" && <p>{done.activation === "concluida" ? `Escritório criado em teste grátis de ${plan.trial_days} dias, sem cobrança. Enviamos ao e-mail do titular o link para criar a senha.` : "Cadastro recebido; o escritório está sendo preparado pela equipe LexSion. Você não será cobrado(a) agora."}</p>}
            {done.kind === "payment" && done.url && <p><a className="btn btn-primary min-h-12" href={done.url} rel="noopener"><Lock aria-hidden className="size-4" /> Ir para pagamento ({formatBRL(price)})</a></p>}
            {done.kind === "blocked" && <p className="text-warning">{done.message}</p>}
            <p className="flex flex-wrap gap-2"><a className="btn btn-secondary" href="#" onClick={(e) => { e.preventDefault(); void downloadPdf(token); }}><Download aria-hidden className="size-4" /> Baixar contrato aceito (PDF)</a>{done.kind === "trial" && <Link href="/entrar" className="btn btn-ghost">Entrar</Link>}</p>
          </section>
        )}
      </div>

      <aside className="h-fit space-y-4 lg:sticky lg:top-6" aria-label="Resumo da contratação">
        <div className="panel space-y-1 p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-fg-muted">Resumo</p>
          <p className="text-lg font-semibold">{plan.label} · {f.cycle}</p>
          <p>{plan.trial_days > 0 ? <>{plan.trial_days} dias grátis, depois <strong>{formatBRL(price)}</strong>/{f.cycle === "anual" ? "ano" : "mês"}</> : <><strong>{formatBRL(price)}</strong>/{f.cycle === "anual" ? "ano" : "mês"}</>}</p>
          <p className="text-fg-muted">Até {plan.max_users} {plan.max_users === 1 ? "usuário" : "usuários"}{office ? ` · ${office}` : ""}</p>
          <p className="text-fg-muted">{plan.trial_days > 0 ? "Sem cartão no cadastro. " : ""}Cobrança por link a cada período (Pix ou cartão, InfinitePay). Sem débito automático.</p>
        </div>
        {step < 2 && template && (
          <details className="lg:open" open>
            <summary className="cursor-pointer text-sm font-medium">Prévia do contrato (atualiza enquanto você preenche)</summary>
            <div className="mt-2"><ContractPaper text={preview} number={srv?.number ?? ""} hash="" /></div>
          </details>
        )}
        {!binding && <p className="text-xs text-warning">Contrato pendente de aprovação jurídica: aceite e pagamento só serão liberados depois da aprovação.</p>}
      </aside>
    </div>
  );
}

async function downloadPdf(token: string) {
  const r = await fetch("/api/contrato", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pdf", token }) });
  if (!r.ok) return alert("Não foi possível gerar o PDF agora.");
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: (r.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]) ?? "contrato-lexsion.pdf" });
  a.click(); URL.revokeObjectURL(url);
}

/** Documento em papel marfim (qualquer tema), cláusulas legíveis; tarja vermelha quando é minuta. */
function ContractPaper({ text, number, hash, big }: { text: string; number: string; hash: string; big?: boolean }) {
  const [title, ...rest] = text.split("\n");
  return (
    <article className={`contract-paper rounded-[var(--radius-panel)] p-5 text-[15px] leading-relaxed sm:p-8 ${big ? "max-h-[75vh] overflow-y-auto" : "max-h-[60vh] overflow-y-auto text-[13px]"}`} tabIndex={0} aria-label={`Texto do contrato${number ? ` ${number}` : ""}`} data-testid="contrato-texto">
      <h3 className="text-center text-base font-bold">{title}</h3>
      {rest.map((l, i) => l === DRAFT_BANNER ? <p key={i} className="my-3 rounded border-2 border-red-700 py-1 text-center text-sm font-bold text-red-800">{l}</p>
        : /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .,()\-/:—]+$/.test(l) && l.length > 3 ? <h4 key={i} className="mt-4 font-bold">{l}</h4>
        : l ? <p key={i} className="mt-1.5 whitespace-pre-wrap break-words">{l}</p> : null)}
      {hash && <p className="mt-6 break-all border-t border-[#ddd6c8] pt-2 text-xs">SHA-256 do texto: {hash}</p>}
    </article>
  );
}
