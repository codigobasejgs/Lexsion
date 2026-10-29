"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Info, Loader2 } from "lucide-react";
import { LexSionLogo } from "@/components/brand";
import { authRepository } from "@/services/auth";

// Recuperação de acesso real (Supabase Auth envia o link). Mensagem nunca revela se a conta existe.
export default function RecuperarAcessoPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    // Lê o campo do formulário (não só o estado): texto digitado/colado antes da hidratação (Safari lento) não se perde.
    const value = String(new FormData(e.currentTarget as HTMLFormElement).get("email") ?? email).trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return setError("Informe um e-mail válido.");
    setError(null);
    setBusy(true);
    const r = await authRepository.requestPasswordReset({ email: value });
    setBusy(false);
    setResult(r.ok ? "Se houver uma conta com esse e-mail, as instruções chegarão em alguns minutos." : r.error.message);
  };
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link href="/" aria-label="LexSion — voltar ao site" className="mb-8"><LexSionLogo className="h-10" /></Link>
      <h1 className="text-2xl font-semibold">Recuperar acesso</h1>
      <p className="mt-1 text-fg-muted">Informe o e-mail cadastrado. Enviaremos um link para criar uma nova senha.</p>
      <form className="mt-6 space-y-4" noValidate onSubmit={submit}>
        <div>
          <label htmlFor="rec-email" className="label">E-mail</label>
          <input id="rec-email" name="email" type="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "rec-erro" : undefined} />
          {error && <p id="rec-erro" className="mt-1 text-sm text-danger">{error}</p>}
        </div>
        <button type="submit" className="btn btn-primary min-h-12 w-full" disabled={busy}>{busy ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Enviando…</> : "Enviar link"}</button>
      </form>
      <div aria-live="polite">{result && <p role="status" className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />{result}</p>}</div>
      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <Link href="/entrar" className="inline-flex items-center gap-1 text-accent underline underline-offset-2"><ArrowLeft aria-hidden className="size-4" /> Voltar para entrar</Link>
        <Link href="/demonstracao" className="text-fg-muted underline underline-offset-2 hover:text-fg">Explorar a demonstração</Link>
      </div>
    </main>
  );
}
