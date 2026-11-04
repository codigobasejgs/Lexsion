"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserMinus } from "lucide-react";
import { useSession } from "@/components/providers";
import { Badge, LoadingBlock, PageHeader } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ROLE_LABEL, PLATFORM_ROLES } from "@/domain/permissions";
import { PLATFORM_MODULES, PLATFORM_ROLE_HELP } from "@/domain/platform-modules";
import { formatInstant } from "@/lib/dates";
import type { Role } from "@/domain/types";

type Staff = { user_id: string; email: string; full_name: string | null; role: Role; denied_modules: string[]; expires_at: string | null; note: string | null; created_at: string; last_sign_in_at: string | null };
const MODULES = PLATFORM_MODULES.filter((m) => m.id !== "equipe"); // equipe da plataforma é só do Super Admin
const empty = { email: "", role: "platform_support" as Role, denied: [] as string[], until: "", reason: "" };

// Equipe da plataforma (Super Admin): quem administra a LexSion, com qual papel, até quando e quais módulos do painel
// vê. Contas já cadastradas (busca por e-mail). O banco aplica tudo (platform_staff_set) e audita com antes/depois.
export default function EquipePlataformaPage() {
  const { mode, user } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["platform-staff"], enabled: mode === "real", queryFn: async () => { const r = await supabaseBrowser().rpc("platform_staff"); if (r.error) throw new Error(r.error.message); return (r.data ?? []) as Staff[]; } });
  const [f, setF] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (mode !== "real") return <><PageHeader title="Equipe da plataforma" /><p className="panel p-4 text-sm">Disponível na operação real.</p></>;
  if (user?.role !== "superadmin") return <><PageHeader title="Equipe da plataforma" /><p role="alert" className="panel p-4 text-sm">Somente o Super Admin gerencia a equipe da plataforma.</p></>;

  const save = async (revoke = false, who?: Staff) => {
    setBusy(true); setMsg(null);
    const email = who?.email ?? f.email.trim();
    const reason = revoke ? (prompt(`Motivo para revogar o acesso de ${email} à plataforma:`) ?? "") : f.reason.trim();
    if (revoke && reason.trim().length < 5) { setBusy(false); return setMsg({ ok: false, text: "Revogação cancelada: informe um motivo com 5 ou mais caracteres." }); }
    const r = await supabaseBrowser().rpc("platform_staff_set", { p_email: email, p_role: revoke ? null : f.role, p_denied: revoke ? null : f.denied, p_expires: !revoke && f.until ? new Date(`${f.until}T23:59:59-03:00`).toISOString() : null, p_reason: reason, p_revoke: revoke });
    setBusy(false);
    if (r.error) return setMsg({ ok: false, text: r.error.message.replace(/^.*?:\s*/, "") });
    setMsg({ ok: true, text: revoke ? `Acesso de ${email} à plataforma revogado.` : `${email}: ${ROLE_LABEL[f.role]} salvo. A pessoa vê a mudança ao recarregar a página.` });
    setF(empty); setEditing(null);
    await qc.invalidateQueries({ queryKey: ["platform-staff"] });
  };
  const edit = (s: Staff) => { setEditing(s.user_id); setMsg(null); setF({ email: s.email, role: s.role, denied: s.denied_modules, until: s.expires_at ? s.expires_at.slice(0, 10) : "", reason: "" }); };
  const toggle = (id: string) => setF((x) => ({ ...x, denied: x.denied.includes(id) ? x.denied.filter((d) => d !== id) : [...x.denied, id] }));

  return (
    <div className="space-y-6">
      <PageHeader title="Equipe da plataforma" description="Quem administra a LexSion. Dê um papel a uma conta já cadastrada, escolha os módulos do painel que ela vê e até quando. Nenhum papel da plataforma acessa o conteúdo jurídico dos escritórios." />
      {q.isPending ? <LoadingBlock /> : q.isError ? <p role="alert" className="panel p-4 text-sm text-danger">{String((q.error as Error).message)}</p> : (
        <ul className="divide-y divide-line rounded border border-line text-sm" data-testid="equipe-plataforma">
          {q.data!.map((s) => (
            <li key={s.user_id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.full_name || s.email}{s.user_id === user.id ? " (você)" : ""}</p>
                <p className="truncate text-xs text-fg-muted">{s.email} · {s.expires_at ? `até ${formatInstant(s.expires_at)}` : "sem prazo"}{s.denied_modules.length ? ` · sem: ${s.denied_modules.map((d) => MODULES.find((m) => m.id === d)?.label ?? d).join(", ")}` : ""}{s.last_sign_in_at ? ` · último acesso ${formatInstant(s.last_sign_in_at)}` : ""}</p>
              </div>
              <Badge tone={s.role === "superadmin" ? "warning" : "info"}>{ROLE_LABEL[s.role]}</Badge>
              {s.user_id !== user.id && <>
                <button className="btn btn-ghost min-h-9" onClick={() => edit(s)}>Editar</button>
                <button className="btn btn-ghost min-h-9 text-danger" disabled={busy} onClick={() => save(true, s)}><UserMinus aria-hidden className="size-4" /> Revogar</button>
              </>}
            </li>
          ))}
        </ul>
      )}

      <section className="panel space-y-3 p-4 text-sm" aria-labelledby="dar-h">
        <h2 id="dar-h" className="flex items-center gap-2 font-semibold"><ShieldCheck aria-hidden className="size-4" /> {editing ? "Alterar acesso" : "Dar acesso à plataforma"}</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block sm:col-span-2"><span className="label">E-mail da conta já cadastrada</span><input type="email" className="field" disabled={!!editing} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value.trim() })} placeholder="pessoa@exemplo.com.br" /></label>
          <label className="block"><span className="label">Válido até (opcional)</span><input type="date" className="field" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></label>
        </div>
        <fieldset><legend className="label">Papel</legend>
          <div className="grid gap-1 sm:grid-cols-2">{PLATFORM_ROLES.map((r) => (
            <label key={r} className="flex items-start gap-2 rounded border border-line p-2"><input type="radio" name="papel" className="mt-1 accent-[var(--brand)]" checked={f.role === r} onChange={() => setF({ ...f, role: r })} /><span><strong>{ROLE_LABEL[r]}</strong><span className="block text-xs text-fg-muted">{PLATFORM_ROLE_HELP[r]}</span></span></label>
          ))}</div>
        </fieldset>
        <fieldset><legend className="label">Módulos do painel que a pessoa vê</legend>
          <p className="mb-1 text-xs text-fg-muted">Desmarque para retirar. O papel continua limitando o que cada módulo permite fazer (ex.: suporte não vê valores).</p>
          <div className="grid gap-1 sm:grid-cols-3">{MODULES.map((m) => <label key={m.id} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={!f.denied.includes(m.id)} onChange={() => toggle(m.id)} />{m.label}</label>)}</div>
        </fieldset>
        <label className="block"><span className="label">Motivo (fica na auditoria)</span><input className="field" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ex.: atendimento de suporte em novembro" /></label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy || !/^\S+@\S+\.\S+$/.test(f.email) || f.reason.trim().length < 5} onClick={() => save(false)}>{busy ? "Salvando…" : editing ? "Salvar alteração" : "Dar acesso"}</button>
          {editing && <button className="btn btn-ghost" onClick={() => { setEditing(null); setF(empty); }}>Cancelar</button>}
        </div>
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}
      </section>
    </div>
  );
}
