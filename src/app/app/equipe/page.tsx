"use client";

import { useState } from "react";
import { MailPlus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Avatar, Badge, PageHeader, SimulatedBadge } from "@/components/ui";
import { ACTION_LABEL, ALL_ROLES, ROLE_LABEL, allowed, can, isPlatformRole, type Action, type Area } from "@/domain/permissions";
import { people as users } from "@/components/people";
import type { Role } from "@/domain/types";
import { TeamGovernance } from "@/modules/team/governance";

const AREAS: Area[] = ["atendimento", "crm", "clientes", "casos", "documentos", "previdenciario", "financeiro", "pagamentos", "minutas", "integracoes", "configuracoes"];
const ACTIONS: Action[] = ["aprovar_peca", "publicar_portal", "aprovar_proposta", "ver_honorarios", "ver_casos_sigilosos", "exportar", "gerir_equipe", "gerir_marca"];
const OFFICE_ROLES = ALL_ROLES.filter((r) => !isPlatformRole(r));

export default function EquipePage() {
  const { org, mode, user } = useSession();
  const tasks = useCollection("tasks");
  const [invited, setInvited] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const team = users.filter((u) => u.organizationId === org?.id && u.role !== "cliente");
  const roles = [...new Set(team.map((u) => u.role))] as Role[];
  return (
    <Guard area="equipe">
      <div className="mx-auto min-w-0 max-w-[1100px]">
        <PageHeader title="Equipe" description={mode === "real" ? "Membros, perfis e carga de trabalho. As permissões são garantidas no servidor e no banco de dados." : "Membros, perfis e carga de trabalho. Permissões desta demo são visuais; produção exige autorização no servidor."} />
        <ul className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((u) => (
            <li key={u.id} className="panel flex items-center gap-3 p-4 text-sm">
              <Avatar name={u.name} />
              <div className="min-w-0 flex-1"><p className="font-medium">{u.name}</p><p className="text-fg-muted">{ROLE_LABEL[u.role]}</p></div>
              <Badge icon={false}>{(tasks.data ?? []).filter((t) => t.assigneeId === u.id && !t.done).length} tarefas</Badge>
            </li>
          ))}
        </ul>
        <section className="panel relative mb-6 overflow-x-auto p-4" tabIndex={0} aria-label="Matriz de acesso por perfil (role horizontalmente)">
          <h2 className="mb-1 font-semibold">Matriz de acesso por perfil</h2>
          <p className="mb-3 text-sm text-fg-muted">Funções do escritório. {mode === "real" ? "A permissão é aplicada na interface e garantida no servidor e no banco (RLS)." : "Nesta demonstração a permissão é aplicada na interface e nos serviços simulados; na versão em produção será garantida no servidor."}</p>
          <table className="w-full min-w-[720px] text-sm" data-testid="matriz-acesso"><caption className="sr-only">Permissões por módulo e por ação</caption>
            <thead><tr><th className="py-1 text-left">Módulo / ação</th>{OFFICE_ROLES.map((r) => <th key={r} scope="col" className="px-2 text-left text-xs">{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {AREAS.map((a) => <tr key={a} className="border-t border-line"><th scope="row" className="py-1 text-left font-normal capitalize">{a}</th>{OFFICE_ROLES.map((r) => <td key={r} className="px-2">{can(r, a) ? "✓ acesso" : "— sem acesso"}</td>)}</tr>)}
              {ACTIONS.map((x) => <tr key={x} className="border-t border-line bg-surface-muted/40"><th scope="row" className="py-1 text-left font-normal">{ACTION_LABEL[x]}</th>{OFFICE_ROLES.map((r) => <td key={r} className="px-2">{allowed(r, x) ? "✓ pode" : "— não"}</td>)}</tr>)}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-fg-muted">Papéis da plataforma (Superadmin, administrador e suporte LexSion) não acessam dados dos escritórios. Presentes nesta equipe: {roles.map((r) => ROLE_LABEL[r]).join(", ")}.</p>
        </section>
        {mode === "real" ? (user && allowed(user.role, "gerir_equipe") && org && <div className="space-y-6"><InviteReal organizationId={org.id} canGrantAdmin={user.role === "admin"} /><TeamGovernance organizationId={org.id} myRole={user.role} /></div>) : (
          <section className="panel space-y-2 p-4 text-sm">
            <div className="flex items-center gap-2"><h2 className="flex-1 font-semibold">Convidar membro</h2><SimulatedBadge /></div>
            <div className="flex flex-wrap gap-2"><input type="email" className="field max-w-sm" aria-label="E-mail do convidado" placeholder="nome@exemplo.test" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn btn-secondary" disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={() => { setInvited(email); setEmail(""); }}><MailPlus aria-hidden className="size-4" /> Enviar convite (simulado)</button></div>
            <p role="status" className="text-success">{invited ? `Convite para ${invited} registrado. Nenhum e-mail foi enviado.` : ""}</p>
          </section>
        )}
      </div>
    </Guard>
  );
}

/** Convite REAL: e-mail do Supabase Auth (via Resend) para a pessoa definir a senha; vínculo gravado sob RLS. */
function InviteReal({ organizationId, canGrantAdmin }: { organizationId: string; canGrantAdmin: boolean }) {
  const [f, setF] = useState({ email: "", fullName: "", role: "advogado" as Role });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const roles = OFFICE_ROLES.filter((r) => r !== "cliente" && (r !== "admin" || canGrantAdmin));
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email) && f.fullName.trim().length >= 3;
  const send = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/equipe/convites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, ...f, fullName: f.fullName.trim() }) }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { ok: boolean; data?: { invited: boolean }; error?: { message: string } } | null;
    setBusy(false);
    if (!j?.ok) return setMsg({ ok: false, text: j?.error?.message ?? "Sem conexão. Nenhum convite foi enviado; tente de novo." });
    setMsg({ ok: true, text: j.data?.invited ? `Convite enviado para ${f.email}. A pessoa define a senha pelo link (válido por 24 h) e entra em lexsion.com.br/entrar.` : `${f.email} já tinha conta e foi vinculada ao escritório como ${ROLE_LABEL[f.role]}.` });
    setF({ email: "", fullName: "", role: f.role });
  };
  return (
    <section className="panel space-y-3 p-4 text-sm" aria-labelledby="convite-h">
      <h2 id="convite-h" className="font-semibold">Convidar membro</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block"><span className="label">Nome</span><input className="field" autoComplete="off" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></label>
        <label className="block"><span className="label">E-mail</span><input type="email" inputMode="email" autoComplete="off" className="field" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value.trim() })} /></label>
        <label className="block"><span className="label">Perfil</span><select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
      </div>
      <button className="btn btn-primary" disabled={!valid || busy} onClick={send}><MailPlus aria-hidden className="size-4" /> {busy ? "Enviando…" : "Enviar convite"}</button>
      <p role={msg && !msg.ok ? "alert" : "status"} className={msg ? (msg.ok ? "text-success" : "text-danger") : "sr-only"}>{msg?.text}</p>
    </section>
  );
}
