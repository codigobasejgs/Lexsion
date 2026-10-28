"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { LexSionLogo } from "@/components/brand";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Destino dos links de convite e de redefinição enviados pelo Supabase Auth.
// O link traz um código de uso único (PKCE ?code= ou #access_token); aqui ele vira sessão e o usuário define a senha.
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [state, setState] = useState<"verificando" | "pronto" | "invalido">("verificando");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const q = new URLSearchParams(location.search);
      const code = q.get("code");
      const tokenHash = q.get("token_hash");
      const type = q.get("type");
      if (tokenHash && (type === "invite" || type === "recovery")) await sb.auth.verifyOtp({ token_hash: tokenHash, type });
      else if (code) await sb.auth.exchangeCodeForSession(code);
      const hash = new URLSearchParams(location.hash.slice(1));
      if (hash.get("access_token") && hash.get("refresh_token")) await sb.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
      history.replaceState(null, "", "/redefinir-senha"); // tira o token da barra de endereço
      const { data } = await sb.auth.getUser();
      setState(data.user ? "pronto" : "invalido");
    })().catch(() => setState("invalido"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 10) return setError("Use pelo menos 10 caracteres.");
    if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return setError("Misture letras e números.");
    if (pw !== pw2) return setError("As senhas não conferem.");
    setError(null);
    setBusy(true);
    const { error: err } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    setPw("");
    setPw2("");
    if (err) return setError(err.message.includes("different") ? "Escolha uma senha diferente da anterior." : "Não foi possível salvar a senha. Peça um novo link.");
    router.replace("/entrar?senha=definida");
  };

  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link href="/" aria-label="LexSion — voltar ao site" className="mb-8"><LexSionLogo className="h-10" /></Link>
      <h1 className="text-2xl font-semibold">Definir senha</h1>
      {state === "verificando" && <p className="mt-4 flex items-center gap-2 text-fg-muted" role="status"><Loader2 aria-hidden className="size-4 animate-spin" /> Conferindo o link…</p>}
      {state === "invalido" && (
        <div role="alert" className="mt-4 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning">
          Link inválido ou expirado. <Link href="/recuperar-acesso" className="underline">Peça um novo link</Link>.
        </div>
      )}
      {state === "pronto" && (
        <form className="mt-6 space-y-4" noValidate onSubmit={submit}>
          <label className="block"><span className="label">Nova senha</span><input type="password" autoComplete="new-password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <label className="block"><span className="label">Repita a senha</span><input type="password" autoComplete="new-password" className="field" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" className="btn btn-primary min-h-12 w-full" disabled={busy}>{busy ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Salvando…</> : "Salvar senha"}</button>
          <p className="text-xs text-fg-muted">Mínimo de 10 caracteres, com letras e números.</p>
        </form>
      )}
    </main>
  );
}
