"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { LexSionLogo } from "@/components/brand";
import { authRepository, type AuthAudience } from "@/services/auth";

// Login profissional. Autenticação real ainda NÃO está conectada (fase backend): o formulário valida,
// tenta o adaptador e mostra o estado honesto “indisponível”. Nada de senha é guardado no navegador.
export default function EntrarPage() {
  const [audience, setAudience] = useState<AuthAudience>("escritorio");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [result, setResult] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Informe um e-mail válido, por exemplo nome@escritorio.com.br.";
    if (password.length < 8) next.password = "A senha tem pelo menos 8 caracteres.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const r = await authRepository.signIn({ email: email.trim(), password, audience });
    setBusy(false);
    setPassword(""); // nunca mantém a senha em memória após a tentativa
    if (!r.ok) setResult(r.error.message);
  };

  return (
    <main id="conteudo" className="grid min-h-dvh grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="order-2 flex flex-col justify-between gap-8 bg-[radial-gradient(120%_80%_at_20%_10%,#232934_0%,#0e1014_55%,#090a0d_100%)] p-6 text-[#f7f2e8] lg:order-1 lg:p-12">
        <LexSionLogo className="hidden h-12 lg:block" variant="dark" />
        <div className="max-w-md">
          <p className="text-sm font-medium tracking-[0.25em] text-[#f6d88c]">TODA A ADVOCACIA. UMA PLATAFORMA.</p>
          <p className="mt-3 text-2xl font-semibold leading-snug lg:text-3xl">Atendimento, processos, prazos, documentos, honorários e clientes conectados.</p>
          <p className="mt-3 text-[#b9b4aa]">Cada escritório com sua própria identidade, equipe e aplicativo.</p>
        </div>
        <p className="text-sm text-[#b9b4aa]">Ainda não é cliente? <Link href="/planos" className="text-[#f6d88c] underline underline-offset-2">Conheça os planos</Link></p>
      </section>

      <section className="order-1 flex flex-col justify-center px-5 py-10 sm:px-10 lg:order-2">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" aria-label="LexSion — voltar ao site" className="mb-8 inline-block"><LexSionLogo className="h-10" /></Link>
          <h1 className="text-2xl font-semibold">Entrar</h1>
          <p className="mt-1 text-fg-muted">Acesse com o e-mail cadastrado pelo seu escritório.</p>

          <div role="radiogroup" aria-label="Tipo de acesso" className="mt-6 grid grid-cols-2 gap-1 rounded-[var(--radius-control)] border border-line p-1">
            {([["escritorio", "Sou do escritório"], ["cliente", "Sou cliente"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={audience === k} onClick={() => setAudience(k)} className={`min-h-10 rounded-[calc(var(--radius-control)-2px)] text-sm ${audience === k ? "bg-selection font-medium text-fg" : "text-fg-muted hover:text-fg"}`}>{l}</button>
            ))}
          </div>

          <form className="mt-6 space-y-4" noValidate onSubmit={submit}>
            <div>
              <label htmlFor="email" className="label">E-mail</label>
              <input id="email" type="email" autoComplete="username" inputMode="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-erro" : undefined} />
              {errors.email && <p id="email-erro" className="mt-1 text-sm text-danger">{errors.email}</p>}
            </div>
            <div>
              <div className="flex items-baseline justify-between"><label htmlFor="senha" className="label">Senha</label><Link href="/recuperar-acesso" className="text-sm text-accent underline underline-offset-2">Esqueci minha senha</Link></div>
              <div className="relative">
                <input id="senha" type={show ? "text" : "password"} autoComplete="current-password" className="field pr-12" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? "senha-erro" : undefined} />
                <button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-fg-muted hover:text-fg" aria-label={show ? "Ocultar senha" : "Mostrar senha"} aria-pressed={show} onClick={() => setShow(!show)}>
                  {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                </button>
              </div>
              {errors.password && <p id="senha-erro" className="mt-1 text-sm text-danger">{errors.password}</p>}
            </div>
            <button type="submit" className="btn btn-primary min-h-12 w-full text-base" disabled={busy}>
              {busy ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Verificando…</> : <>Entrar <ArrowRight aria-hidden className="size-4" /></>}
            </button>
          </form>

          <div aria-live="polite">
            {result && (
              <div role="alert" className="mt-4 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info">
                <p>{result}</p>
                <Link href="/demonstracao" className="mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-2">Explorar a demonstração <ArrowRight aria-hidden className="size-3.5" /></Link>
              </div>
            )}
          </div>

          <p className="mt-6 flex items-start gap-2 text-sm text-fg-muted"><Info aria-hidden className="mt-0.5 size-4 shrink-0" /> Acesso real em preparação. Enquanto isso, <Link href="/demonstracao" className="text-accent underline underline-offset-2">explore a demonstração</Link> com perfis fictícios.</p>
          <p className="mt-4 text-center text-sm"><Link href="/" className="text-fg-muted underline underline-offset-2 hover:text-fg">Voltar ao site</Link></p>
        </div>
      </section>
    </main>
  );
}
