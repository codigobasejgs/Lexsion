"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { formatBRL } from "@/lib/money";
import type { PublicPlan } from "@/domain/saas";

const slugify = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// Cadastro → aceite do contrato → link do pagamento. Validação final é do servidor (mensagem por campo).
export function SignupForm({ plans, initialPlan, contractVersion }: { plans: PublicPlan[]; initialPlan: string; contractVersion: string }) {
  const [f, setF] = useState({ plan: initialPlan, cycle: "mensal", name: "", email: "", office: "", slug: "", document: "", phone: "", accept: false });
  const [slugTouched, setSlugTouched] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [trialDone, setTrialDone] = useState<{ days: number; ok: boolean } | null>(null);
  const plan = plans.find((p) => p.id === f.plan)!;
  const trial = plan.trial_days > 0;
  const price = f.cycle === "anual" && plan.price_yearly ? plan.price_yearly : plan.price_monthly;
  const set = (patch: Partial<typeof f>) => setF((cur) => ({ ...cur, ...patch, ...(patch.office !== undefined && !slugTouched ? { slug: slugify(patch.office) } : {}) }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    if (!f.accept) return setErr({ field: "accept", message: "É preciso aceitar os termos de contratação." });
    setBusy(true);
    const r = await fetch("/api/contratar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, contractVersion }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok && typeof r.data?.url === "string" && r.data.url.startsWith("https://checkout.infinitepay.io/")) { location.assign(r.data.url); return; }
    if (r?.ok && r.data?.trial) { setTrialDone({ days: r.data.days, ok: r.data.activation === "concluida" }); return; }
    setBusy(false);
    setErr({ field: r?.error?.field, message: r?.error?.message ?? "Sem conexão. Nada foi cobrado; tente de novo." });
  };
  const field = (k: "name" | "email" | "office" | "slug" | "document" | "phone", label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`s-${k}`} className="label">{label}</label>
      <input id={`s-${k}`} className="field" value={f[k]} aria-invalid={err?.field === k} aria-describedby={err?.field === k ? "s-err" : undefined}
        onChange={(e) => { if (k === "slug") setSlugTouched(true); set({ [k]: k === "slug" ? slugify(e.target.value) : e.target.value }); }} {...extra} />
    </div>
  );
  if (trialDone) return (
    <div role="status" className="mt-8 rounded-[var(--radius-panel)] border border-success/30 bg-success-bg p-5 text-success">
      <p className="font-medium">{trialDone.ok ? `Escritório criado. Teste grátis de ${trialDone.days} dias, sem cobrança.` : "Cadastro recebido. O escritório está sendo preparado pela equipe LexSion."}</p>
      <p className="mt-2 text-sm text-fg">Enviamos ao e-mail do(a) titular o link para criar a senha. Antes do fim do teste, você recebe o link da primeira mensalidade.</p>
      <Link href="/entrar" className="btn btn-primary mt-4">Entrar</Link>
    </div>
  );
  return (
    <form className="mt-8 space-y-4" noValidate onSubmit={submit}>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label">Plano</legend>
        <select aria-label="Plano" className="field" value={f.plan} onChange={(e) => set({ plan: e.target.value, cycle: "mensal" })}>{plans.map((p) => <option key={p.id} value={p.id}>{p.label} — até {p.max_users} {p.max_users === 1 ? "usuário" : "usuários"}</option>)}</select>
        <select aria-label="Ciclo" className="field" value={f.cycle} onChange={(e) => set({ cycle: e.target.value })}><option value="mensal">Mensal</option>{plan.price_yearly && <option value="anual">Anual</option>}</select>
      </fieldset>
      {field("name", "Nome completo do(a) titular", { autoComplete: "name", required: true })}
      {field("email", "E-mail do(a) titular (receberá o acesso)", { type: "email", autoComplete: "email", required: true })}
      {field("office", "Nome do escritório", { autoComplete: "organization", required: true })}
      {field("slug", "Endereço do escritório (letras, números e hífen)", { required: true, inputMode: "url" })}
      {field("document", "CPF ou CNPJ do contratante", { inputMode: "numeric", required: true })}
      {field("phone", "Celular com DDD (opcional)", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={f.accept} onChange={(e) => set({ accept: e.target.checked })} aria-invalid={err?.field === "accept"} />
        <span>Li e aceito os <Link href="/termos#contratacao" target="_blank" className="text-accent underline underline-offset-2">termos de contratação</Link> (versão {contractVersion}) e a <Link href="/privacidade" target="_blank" className="text-accent underline underline-offset-2">política de privacidade</Link>.</span></label>
      <div className="panel p-4 text-sm"><p className="flex justify-between"><span>{plan.label} — {f.cycle === "anual" ? "12 meses" : "1 mês"}</span><strong>{trial ? `${plan.trial_days} dias grátis, depois ${formatBRL(price)}` : formatBRL(price)}</strong></p>
        <p className="mt-1 text-fg-muted">{trial ? "Nada é cobrado agora e não pedimos cartão. Antes do fim do teste, o link da primeira mensalidade chega ao seu e-mail (Pix ou cartão, pela InfinitePay)." : "Pix ou cartão (até 12x) na página segura da InfinitePay. A renovação é cobrada por link enviado ao seu e-mail antes do vencimento."}</p></div>
      {err && <p id="s-err" role="alert" className="text-sm text-danger">{err.message}</p>}
      <button type="submit" className="btn btn-primary min-h-12 w-full" disabled={busy}>{busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Lock aria-hidden className="size-4" />} {trial ? "Começar o teste grátis" : "Ir para o pagamento"}</button>
    </form>
  );
}
