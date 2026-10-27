"use client";

import { useState } from "react";
import { MailPlus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Avatar, Badge, PageHeader, SimulatedBadge } from "@/components/ui";
import { ACTION_LABEL, ALL_ROLES, ROLE_LABEL, allowed, can, isPlatformRole, type Action, type Area } from "@/domain/permissions";
import { users } from "@/mocks/fixtures";
import type { Role } from "@/domain/types";

const AREAS: Area[] = ["atendimento", "crm", "clientes", "casos", "documentos", "previdenciario", "financeiro", "pagamentos", "minutas", "integracoes", "configuracoes"];
const ACTIONS: Action[] = ["aprovar_peca", "publicar_portal", "aprovar_proposta", "ver_honorarios", "ver_casos_sigilosos", "exportar", "gerir_equipe", "gerir_marca"];
const OFFICE_ROLES = ALL_ROLES.filter((r) => !isPlatformRole(r));

export default function EquipePage() {
  const { org } = useSession();
  const tasks = useCollection("tasks");
  const [invited, setInvited] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const team = users.filter((u) => u.organizationId === org?.id && u.role !== "cliente");
  const roles = [...new Set(team.map((u) => u.role))] as Role[];
  return (
    <Guard area="equipe">
      <div className="mx-auto min-w-0 max-w-[1100px]">
        <PageHeader title="Equipe" description="Membros, perfis e carga de trabalho. Permissões desta demo são visuais; produção exige autorização no servidor." />
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
          <p className="mb-3 text-sm text-fg-muted">Funções do escritório. Nesta demonstração a permissão é aplicada na interface e nos serviços simulados; na versão em produção será garantida no servidor.</p>
          <table className="w-full min-w-[720px] text-sm" data-testid="matriz-acesso"><caption className="sr-only">Permissões por módulo e por ação</caption>
            <thead><tr><th className="py-1 text-left">Módulo / ação</th>{OFFICE_ROLES.map((r) => <th key={r} scope="col" className="px-2 text-left text-xs">{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {AREAS.map((a) => <tr key={a} className="border-t border-line"><th scope="row" className="py-1 text-left font-normal capitalize">{a}</th>{OFFICE_ROLES.map((r) => <td key={r} className="px-2">{can(r, a) ? "✓ acesso" : "— sem acesso"}</td>)}</tr>)}
              {ACTIONS.map((x) => <tr key={x} className="border-t border-line bg-surface-muted/40"><th scope="row" className="py-1 text-left font-normal">{ACTION_LABEL[x]}</th>{OFFICE_ROLES.map((r) => <td key={r} className="px-2">{allowed(r, x) ? "✓ pode" : "— não"}</td>)}</tr>)}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-fg-muted">Papéis da plataforma (Superadmin, administrador e suporte LexSion) não acessam dados dos escritórios. Presentes nesta equipe: {roles.map((r) => ROLE_LABEL[r]).join(", ")}.</p>
        </section>
        <section className="panel space-y-2 p-4 text-sm">
          <div className="flex items-center gap-2"><h2 className="flex-1 font-semibold">Convidar membro</h2><SimulatedBadge /></div>
          <div className="flex flex-wrap gap-2"><input type="email" className="field max-w-sm" aria-label="E-mail do convidado" placeholder="nome@exemplo.test" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn btn-secondary" disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={() => { setInvited(email); setEmail(""); }}><MailPlus aria-hidden className="size-4" /> Enviar convite (simulado)</button></div>
          <p role="status" className="text-success">{invited ? `Convite para ${invited} registrado. Nenhum e-mail foi enviado.` : ""}</p>
        </section>
      </div>
    </Guard>
  );
}
