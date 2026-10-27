"use client";

import Link from "next/link";
import { useState } from "react";
import { FlaskConical } from "lucide-react";

// Recuperação simulada: nenhum e-mail é enviado. Mensagem neutra (não revela se a conta existe).
export default function RecuperarAcessoPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const valid = /^\S+@\S+\.\S+$/.test(email);
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-semibold">Recuperar acesso</h1>
      <p className="mt-1 text-fg-muted">Informe o e-mail cadastrado. Enviaremos um link para criar nova senha.</p>
      <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-dashed border-accent/50 p-3 text-sm text-accent"><FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" /> Ambiente demonstrativo — nenhum e-mail é enviado.</p>
      {sent ? (
        <p role="status" className="mt-6 rounded-[var(--radius-control)] border border-success/30 bg-success-bg p-3 text-success">Se houver uma conta com esse e-mail, as instruções chegarão em alguns minutos. (Simulação: nada foi enviado.)</p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) setSent(true); }}>
          <label className="block"><span className="label">E-mail</span><input type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn btn-primary min-h-12 w-full" disabled={!valid}>Enviar link (simulação)</button>
        </form>
      )}
      <Link href="/entrar" className="mt-6 text-center text-sm text-accent underline underline-offset-2">Voltar para entrar</Link>
    </main>
  );
}
