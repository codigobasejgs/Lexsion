"use client";

import { useState } from "react";
import { MailPlus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Avatar, Badge, PageHeader, SimulatedBadge } from "@/components/ui";
import { ROLE_LABEL, can, type Area } from "@/domain/permissions";
import { users } from "@/mocks/fixtures";
import type { Role } from "@/domain/types";

const AREAS: Area[] = ["atendimento", "crm", "clientes", "casos", "documentos", "previdenciario", "financeiro", "pagamentos", "minutas", "integracoes", "configuracoes"];

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
          <h2 className="mb-2 font-semibold">Matriz de acesso por perfil</h2>
          <table className="w-full text-sm"><caption className="sr-only">Permissões</caption>
            <thead><tr><th className="py-1 text-left">Módulo</th>{roles.map((r) => <th key={r} className="px-2 text-left text-xs">{ROLE_LABEL[r]}</th>)}</tr></thead>
            <tbody>{AREAS.map((a) => <tr key={a} className="border-t border-line"><th scope="row" className="py-1 text-left font-normal capitalize">{a}</th>{roles.map((r) => <td key={r} className="px-2">{can(r, a) ? "✓ acesso" : "— sem acesso"}</td>)}</tr>)}</tbody>
          </table>
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
