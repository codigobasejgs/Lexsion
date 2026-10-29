"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Segundo fator (TOTP, gratuito no Supabase Auth) obrigatório para a plataforma na OPERAÇÃO REAL.
// A tela só orienta: quem decide é o banco (is_platform exige aal2), então pular esta tela não dá acesso a nada.
type State = { phase: "loading" } | { phase: "ok" } | { phase: "verify"; factorId: string } | { phase: "enroll"; factorId: string; qr: string; secret: string };

export function usePlatformMfa(active: boolean) {
  const [st, setSt] = useState<State>({ phase: "loading" });
  const check = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") return setSt({ phase: "ok" });
    const { data: f } = await sb.auth.mfa.listFactors();
    const totp = ((f?.totp ?? []) as { id: string; status: string }[]).find((x) => x.status === "verified");
    if (totp) return setSt({ phase: "verify", factorId: totp.id });
    // Fator pendente de cadastro anterior é descartado (o QR antigo não é mais exibido).
    for (const x of (f?.all ?? []) as { id: string; status: string }[]) if (x.status === "unverified") await sb.auth.mfa.unenroll({ factorId: x.id });
    const { data: e, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `LexSion ${new Date().toISOString().slice(0, 10)}` });
    if (error || !e) return setSt({ phase: "loading" });
    setSt({ phase: "enroll", factorId: e.id, qr: e.totp.qr_code, secret: e.totp.secret });
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta assíncrona ao Auth; o estado muda só após a resposta
  useEffect(() => { if (active) void check(); }, [active, check]);
  return { st, recheck: check };
}

export function PlatformMfaGate({ st, onDone }: { st: State; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (st.phase === "loading" || st.phase === "ok") return <div className="grid min-h-dvh place-items-center bg-canvas" aria-busy="true"><Loader2 aria-hidden className="size-6 animate-spin text-fg-muted" /></div>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setErr("Digite os 6 números do aplicativo autenticador.");
    setBusy(true); setErr(null);
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId: st.factorId, code });
    setBusy(false);
    if (error) return setErr("Código inválido ou expirado. Confira o horário do celular e tente de novo.");
    onDone();
  };
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><ShieldCheck aria-hidden className="size-6 text-brand" /> Verificação em duas etapas</h1>
      {st.phase === "enroll" ? (
        <>
          <p className="mt-2 text-fg-muted">O Super Admin exige um segundo fator. Escaneie o código com um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password, Authy) e digite o número gerado.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG em data: URL gerado pelo Supabase Auth */}
          <img src={st.qr} alt="QR code para cadastrar o autenticador" className="mx-auto mt-5 size-48 rounded-lg bg-white p-2" />
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-fg-muted">Não consigo escanear</summary><p className="mt-2">Chave para digitar no aplicativo: <code className="break-all rounded bg-surface-muted px-1.5 py-0.5">{st.secret}</code></p></details>
        </>
      ) : (
        <p className="mt-2 text-fg-muted">Digite o código de 6 números do seu aplicativo autenticador.</p>
      )}
      <form className="mt-5 space-y-3" onSubmit={submit} noValidate>
        <label className="block"><span className="label">Código do autenticador</span>
          <input className="field num text-center text-lg tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-invalid={!!err} aria-describedby={err ? "mfa-erro" : undefined} autoFocus />
        </label>
        {err && <p id="mfa-erro" role="alert" className="text-sm text-danger">{err}</p>}
        <button className="btn btn-primary min-h-12 w-full" disabled={busy}>{busy ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Verificando…</> : <><KeyRound aria-hidden className="size-4" /> Confirmar</>}</button>
      </form>
      <p className="mt-4 text-xs text-fg-muted">Sem este código o banco recusa toda ação da plataforma, mesmo com a senha correta.</p>
    </main>
  );
}
