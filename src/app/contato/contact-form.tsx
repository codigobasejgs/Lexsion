"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Info } from "lucide-react";

// Formulário de interesse. Envio real depende do backend (e-mail/CRM da plataforma): por ora NÃO envia nada
// e diz isso com clareza. Nenhum dado é guardado.
export function ContactForm() {
  const plano = useSearchParams().get("plano") ?? "";
  const [f, setF] = useState({ nome: "", email: "", escritorio: "", tamanho: "", mensagem: plano ? `Tenho interesse no plano ${plano}.` : "", consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.nome.trim().length < 2) er.nome = "Informe seu nome.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = "Informe um e-mail válido.";
    if (!f.consent) er.consent = "É preciso concordar com o contato.";
    setErrors(er);
    if (!Object.keys(er).length) setDone(true);
  };
  if (done)
    return (
      <div role="status" className="mt-8 rounded-[var(--radius-panel)] border border-info/30 bg-info-bg p-5 text-info">
        <p className="flex items-start gap-2 font-medium"><Info aria-hidden className="mt-0.5 size-4 shrink-0" /> O envio de contatos pelo site ainda não está ativo.</p>
        <p className="mt-2 text-sm">Seus dados não foram enviados nem guardados. Enquanto isso, você pode explorar o sistema completo na demonstração.</p>
        <Link href="/demonstracao" className="btn btn-secondary mt-4">Conhecer a demonstração</Link>
      </div>
    );
  const field = (k: "nome" | "email" | "escritorio", label: string, type = "text", auto = "") => (
    <div>
      <label htmlFor={`c-${k}`} className="label">{label}</label>
      <input id={`c-${k}`} type={type} autoComplete={auto} className="field" value={f[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `c-${k}-e` : undefined} />
      {errors[k] && <p id={`c-${k}-e`} className="mt-1 text-sm text-danger">{errors[k]}</p>}
    </div>
  );
  return (
    <form className="mt-8 space-y-4" noValidate onSubmit={submit}>
      {field("nome", "Nome", "text", "name")}
      {field("email", "E-mail", "email", "email")}
      {field("escritorio", "Escritório (opcional)", "text", "organization")}
      <div>
        <label htmlFor="c-tamanho" className="label">Tamanho da equipe (opcional)</label>
        <select id="c-tamanho" className="field" value={f.tamanho} onChange={(e) => set("tamanho", e.target.value)}>
          <option value="">Prefiro não informar</option><option>Só eu</option><option>2 a 5 pessoas</option><option>6 a 20 pessoas</option><option>Mais de 20</option>
        </select>
      </div>
      <div><label htmlFor="c-msg" className="label">Mensagem (opcional)</label><textarea id="c-msg" rows={4} className="field py-2" value={f.mensagem} onChange={(e) => set("mensagem", e.target.value)} /></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} aria-describedby={errors.consent ? "c-consent-e" : undefined} /><span>Concordo em ser contatado(a) pela LexSion sobre esta solicitação, conforme a <Link href="/privacidade" className="text-accent underline underline-offset-2">política de privacidade</Link>.</span></label>
      {errors.consent && <p id="c-consent-e" className="text-sm text-danger">{errors.consent}</p>}
      <button type="submit" className="btn btn-primary min-h-12 w-full">Solicitar apresentação</button>
    </form>
  );
}
