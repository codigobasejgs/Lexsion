"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, UserMinus, UserPlus, Wand2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ALL_ROLES, ROLE_LABEL, isPlatformRole } from "@/domain/permissions";
import { weakPassword } from "@/domain/passwords";
import type { Role } from "@/domain/types";

type Member = { user_id: string; full_name?: string; email?: string; role: string };
type R = { ok: boolean; error?: { message: string } };
const call = async (body: object): Promise<R> => (await fetch("/api/equipe/acessos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null)) ?? { ok: false, error: { message: "Sem conexão. Nada foi alterado; tente de novo." } };
/** Senha forte gerada no navegador (não sai daqui até você salvar). */
const genPassword = () => { const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const v = crypto.getRandomValues(new Uint32Array(14)); let s = ""; for (const x of v) s += a[x % a.length]; return /\d/.test(s) && /[A-Za-z]/.test(s) ? s : `${s.slice(0, 12)}7k`; };

/** Titular/gestor cria o login da equipe (e-mail + senha), troca senha e remove acesso. Nenhum e-mail é enviado. */
export function TeamAccess({ organizationId, myRole, myId }: { organizationId: string; myRole: Role; myId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["equipe-acessos", organizationId],
    queryFn: async () => {
      const t = await supabaseBrowser().rpc("org_team", { p_org: organizationId });
      return { team: ((t.data ?? []) as Member[]).filter((m) => m.role !== "cliente") };
    },
  });
  const [f, setF] = useState({ fullName: "", email: "", password: "", role: "advogado" as Role });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);
  const roles = ALL_ROLES.filter((r) => !isPlatformRole(r) && r !== "cliente" && (r !== "admin" || myRole === "admin"));
  const team = q.data?.team ?? [];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email);
  const refresh = () => qc.invalidateQueries({ queryKey: ["equipe-acessos", organizationId] });

  const create = async () => {
    setBusy(true); setMsg(null); setShown(null);
    const r = await call({ organizationId, action: "create", ...f, fullName: f.fullName.trim(), email: f.email.trim().toLowerCase() });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error?.message ?? "Falhou." });
    setShown({ email: f.email.trim().toLowerCase(), password: f.password });
    setF({ fullName: "", email: "", password: "", role: f.role });
    await refresh();
  };
  const action = async (m: Member, kind: "password" | "remove") => {
    setMsg(null); setShown(null);
    if (kind === "remove" && !confirm(`Remover o acesso de ${m.full_name || m.email}? A pessoa deixa de entrar no escritório na hora. Os registros que ela criou continuam.`)) return;
    const password = kind === "password" ? genPassword() : undefined;
    const r = await call({ organizationId, action: kind, userId: m.user_id, password });
    if (!r.ok) return setMsg({ ok: false, text: r.error?.message ?? "Falhou." });
    if (password) setShown({ email: m.email ?? "", password });
    else setMsg({ ok: true, text: "Acesso removido. As sessões abertas dessa pessoa foram encerradas." });
    await refresh();
  };
  const canTouch = (m: Member) => m.user_id !== myId && m.role !== "admin" && (m.role !== "tenant_admin" || myRole === "admin");

  return (
    <section className="panel space-y-4 p-4 text-sm" aria-labelledby="acessos-h" data-testid="acessos-equipe">
      <div>
        <h2 id="acessos-h" className="font-semibold">Acessos da equipe</h2>
        <p className="mt-1 text-fg-muted">Crie o login de cada pessoa com e-mail e senha. O e-mail é só o nome de usuário: pode ser um endereço do escritório sem caixa de entrada; nada é enviado para ele. Entregue a senha pessoalmente.</p>
      </div>

      <ul className="divide-y divide-line rounded border border-line">
        {team.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center gap-2 p-2">
            <div className="min-w-0 flex-1"><p className="font-medium">{m.full_name || "—"}{m.user_id === myId ? " (você)" : ""}</p><p className="truncate text-xs text-fg-muted">{m.email} · {ROLE_LABEL[m.role as Role] ?? m.role}</p></div>
            {canTouch(m) && <>
              <button className="btn btn-ghost min-h-9" onClick={() => action(m, "password")}><KeyRound aria-hidden className="size-4" /> Nova senha</button>
              <button className="btn btn-ghost min-h-9 text-danger" onClick={() => action(m, "remove")}><UserMinus aria-hidden className="size-4" /> Remover</button>
            </>}
          </li>
        ))}
      </ul>

      <fieldset className="space-y-2">
        <legend className="font-medium">Criar acesso</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="label">Nome</span><input className="field" autoComplete="off" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></label>
          <label className="block"><span className="label">E-mail de login</span><input type="email" inputMode="email" autoComplete="off" className="field" placeholder="maria@seuescritorio.com.br" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value.trim() })} /></label>
          <label className="block"><span className="label">Senha</span>
            <div className="flex gap-2"><input className="field font-mono" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-describedby="senha-regra" /><button type="button" className="btn btn-ghost min-h-11 shrink-0" onClick={() => setF({ ...f, password: genPassword() })}><Wand2 aria-hidden className="size-4" /> Gerar</button></div>
            <span id="senha-regra" className={`mt-1 block text-xs ${f.password && weakPassword(f.password) ? "text-danger" : "text-fg-muted"}`}>10 ou mais caracteres, com letras e números.</span>
          </label>
          <label className="block"><span className="label">Perfil</span><select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
        </div>
        <button className="btn btn-primary" disabled={busy || f.fullName.trim().length < 3 || !emailOk || weakPassword(f.password)} onClick={create}><UserPlus aria-hidden className="size-4" /> {busy ? "Criando…" : "Criar acesso"}</button>
      </fieldset>

      {shown && (
        <div role="status" className="space-y-1 rounded border border-success/40 bg-success-bg p-3 text-success" data-testid="acesso-criado">
          <p className="font-medium">Acesso pronto. Anote e entregue à pessoa (esta senha não será mostrada de novo):</p>
          <p className="font-mono text-fg">Endereço: lexsion.com.br/entrar · E-mail: {shown.email} · Senha: {shown.password}</p>
          <button className="btn btn-ghost min-h-9" onClick={() => navigator.clipboard?.writeText(`Acesso LexSion\nEndereço: https://lexsion.com.br/entrar\nE-mail: ${shown.email}\nSenha: ${shown.password}`)}><Copy aria-hidden className="size-4" /> Copiar</button>
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}
    </section>
  );
}
