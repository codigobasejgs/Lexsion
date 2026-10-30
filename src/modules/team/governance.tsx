"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Lock, ShieldOff, Undo2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ROLE_LABEL } from "@/domain/permissions";
import type { Role } from "@/domain/types";

// Governança do escritório (operação real). O titular/gestor RESTRINGE o que cada perfil ou pessoa faz por módulo.
// O banco aplica (record_readable/record_writable) e recusa qualquer ampliação além do teto da plataforma,
// autorrestrição, restrição ao titular e gestor restringindo gestor. A tela só reflete o que o banco aceitou.
const ROLES: Role[] = ["tenant_admin", "advogado", "controladoria", "financeiro", "atendimento", "estagiario", "external_collaborator"];
const MODULE_LABEL: Record<string, string> = {
  clients: "Clientes", cases: "Casos", processes: "Processos", tasks: "Tarefas", events: "Agenda", deadlines: "Prazos", documents: "Documentos", files: "Arquivos",
  drafts: "Minutas", templates: "Modelos", leads: "CRM — leads", conversations: "Atendimento", messages: "Mensagens", proposals: "Propostas", contracts: "Contratos",
  installments: "Parcelas", payments: "Pagamentos", expenses: "Despesas", receipts: "Recibos", charges: "Cobranças", bankLines: "Conciliação", calculations: "Cálculos",
  pensionAnalyses: "Análises previdenciárias", requisitions: "Requisitórios", notifications: "Notificações", legalSources: "Fontes das minutas",
};
type Policy = { collection: string; read_roles: string[]; write_roles: string[] };
type RoleR = { role: string; collection: string; deny_read: boolean; deny_write: boolean };
type Member = { user_id: string; role: string; name: string };
const sb = () => supabaseBrowser();
const friendly = (m?: string) => (m ?? "").replace(/^.*?:\s*/, "") || "Recusado pelas regras de acesso.";

export function TeamGovernance({ organizationId, myRole }: { organizationId: string; myRole: Role }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>("estagiario");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const q = useQuery({
    queryKey: ["gov", organizationId],
    queryFn: async () => {
      const [p, r] = await Promise.all([sb().from("collection_policies").select("collection,read_roles,write_roles"), sb().from("org_role_restrictions").select("role,collection,deny_read,deny_write").eq("organization_id", organizationId)]);
      return { policies: ((p.data ?? []) as Policy[]).filter((x) => MODULE_LABEL[x.collection]), restr: (r.data ?? []) as RoleR[] };
    },
  });
  if (q.isPending) return <p className="text-sm text-fg-muted">Carregando permissões…</p>;
  const { policies, restr } = q.data!;
  const editableRoles = ROLES.filter((r) => r !== "tenant_admin" || myRole === "admin");
  const cur = (c: string) => restr.find((x) => x.role === role && x.collection === c);
  const save = async (c: string, patch: { deny_read?: boolean; deny_write?: boolean }) => {
    setMsg(null);
    const next = { deny_read: cur(c)?.deny_read ?? false, deny_write: cur(c)?.deny_write ?? false, ...patch };
    const r = !next.deny_read && !next.deny_write
      ? await sb().from("org_role_restrictions").delete().eq("organization_id", organizationId).eq("role", role).eq("collection", c)
      : await sb().from("org_role_restrictions").upsert({ organization_id: organizationId, role, collection: c, ...next }, { onConflict: "organization_id,role,collection" });
    if (r.error) return setMsg({ ok: false, text: friendly(r.error.message) });
    await qc.invalidateQueries({ queryKey: ["gov", organizationId] });
    setMsg({ ok: true, text: `Permissão de ${ROLE_LABEL[role]} em ${MODULE_LABEL[c]} atualizada e registrada na auditoria.` });
  };
  return (
    <section className="panel space-y-4 p-4 text-sm" aria-labelledby="gov-h">
      <div>
        <h2 id="gov-h" className="font-semibold">Permissões por perfil (personalizadas deste escritório)</h2>
        <p className="mt-1 text-fg-muted">Você pode <strong>retirar</strong> leitura ou edição de um módulo para um perfil. Não é possível dar a um perfil mais do que o plano LexSion prevê para ele; o banco recusa. O titular nunca é restringido.</p>
      </div>
      <label className="block max-w-xs"><span className="label">Perfil</span>
        <select className="field" value={role} onChange={(e) => setRole(e.target.value as Role)} data-testid="gov-perfil">{editableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      </label>
      <div className="overflow-x-auto" tabIndex={0} aria-label="Permissões do perfil por módulo (role horizontalmente)">
        <table className="w-full min-w-[560px]" data-testid="gov-matriz"><caption className="sr-only">Leitura e edição por módulo para {ROLE_LABEL[role]}</caption>
          <thead><tr className="text-left text-xs text-fg-muted"><th className="py-1">Módulo</th><th className="px-2">Ver</th><th className="px-2">Editar</th></tr></thead>
          <tbody>
            {policies.map((p) => {
              const ceilR = p.read_roles.includes(role), ceilW = p.write_roles.includes(role), r = cur(p.collection);
              const cell = (ceil: boolean, denied: boolean | undefined, kind: "deny_read" | "deny_write", label: string) => !ceil
                ? <span className="inline-flex items-center gap-1 text-fg-muted" title="Fora do que este perfil pode no plano"><Lock aria-hidden className="size-3.5" /> não previsto</span>
                : <label className="inline-flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={!denied} onChange={(e) => void save(p.collection, { [kind]: !e.target.checked })} aria-label={`${label} ${MODULE_LABEL[p.collection]} — ${ROLE_LABEL[role]}`} /> {denied ? <span className="text-danger">retirado</span> : "permitido"}</label>;
              return (
                <tr key={p.collection} className="border-t border-line">
                  <th scope="row" className="py-1.5 text-left font-normal">{MODULE_LABEL[p.collection]}</th>
                  <td className="px-2">{cell(ceilR, r?.deny_read, "deny_read", "Ver")}</td>
                  <td className="px-2">{cell(ceilW, r?.deny_write, "deny_write", "Editar")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p role={msg && !msg.ok ? "alert" : "status"} className={msg ? (msg.ok ? "text-success" : "text-danger") : "sr-only"}>{msg?.text}</p>
      <MemberRestrictions organizationId={organizationId} myRole={myRole} />
    </section>
  );
}

/** Revogação de acesso de UMA pessoa a um módulo (afastamento, desligamento, conflito de interesse), com motivo e prazo. */
function MemberRestrictions({ organizationId, myRole }: { organizationId: string; myRole: Role }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ user: "", collection: "cases", read: false, reason: "", until: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [seeing, setSeeing] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["gov-m", organizationId],
    queryFn: async () => {
      const [m, team] = await Promise.all([
        sb().from("org_member_restrictions").select("user_id,collection,deny_read,deny_write,reason,expires_at").eq("organization_id", organizationId),
        sb().rpc("org_team", { p_org: organizationId }),
      ]);
      return { list: (m.data ?? []) as { user_id: string; collection: string; deny_read: boolean; deny_write: boolean; reason: string; expires_at: string | null }[], team: ((team.data ?? []) as { user_id: string; role: string; full_name?: string; email?: string }[]).map((t) => ({ user_id: t.user_id, role: t.role, name: t.full_name || t.email || "—" })) as Member[] };
    },
  });
  const access = useQuery({ queryKey: ["gov-ea", organizationId, seeing], enabled: !!seeing, queryFn: async () => (await sb().rpc("effective_access", { p_org: organizationId, p_user: seeing })).data as { role: string; collections: { collection: string; read: boolean; write: boolean }[] } | null });
  if (q.isPending) return null;
  const { list, team } = q.data!;
  const targets = team.filter((t) => t.role !== "admin" && (t.role !== "tenant_admin" || myRole === "admin"));
  const name = (id: string) => team.find((t) => t.user_id === id)?.name ?? "—";
  const add = async () => {
    setMsg(null);
    const r = await sb().from("org_member_restrictions").upsert({ organization_id: organizationId, user_id: f.user, collection: f.collection, deny_read: f.read, deny_write: true, reason: f.reason.trim(), expires_at: f.until ? new Date(`${f.until}T23:59:59-03:00`).toISOString() : null }, { onConflict: "organization_id,user_id,collection" });
    if (r.error) return setMsg({ ok: false, text: friendly(r.error.message) });
    setF({ ...f, reason: "", until: "" });
    await qc.invalidateQueries({ queryKey: ["gov-m", organizationId] });
    setMsg({ ok: true, text: "Acesso revogado agora, no banco, e registrado na auditoria." });
  };
  const remove = async (user: string, collection: string) => {
    const r = await sb().from("org_member_restrictions").delete().eq("organization_id", organizationId).eq("user_id", user).eq("collection", collection);
    if (r.error) return setMsg({ ok: false, text: friendly(r.error.message) });
    await qc.invalidateQueries({ queryKey: ["gov-m", organizationId] });
  };
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <h3 className="font-medium">Revogar acesso de uma pessoa</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block"><span className="label">Pessoa</span><select className="field" data-testid="gov-pessoa" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })}><option value="">—</option>{targets.map((t) => <option key={t.user_id} value={t.user_id}>{t.name} ({ROLE_LABEL[t.role as Role] ?? t.role})</option>)}</select></label>
        <label className="block"><span className="label">Módulo</span><select className="field" data-testid="gov-modulo" value={f.collection} onChange={(e) => setF({ ...f, collection: e.target.value })}>{Object.entries(MODULE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="flex items-end gap-2 pb-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.read} onChange={(e) => setF({ ...f, read: e.target.checked })} /> Também impedir de ver</label>
        <label className="block"><span className="label">Motivo (auditado)</span><input className="field" maxLength={300} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        <label className="block"><span className="label">Até (opcional)</span><input type="date" className="field" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} /></label>
      </div>
      <button className="btn btn-secondary" disabled={!f.user || f.reason.trim().length < 3} onClick={add}><ShieldOff aria-hidden className="size-4" /> Revogar</button>
      <p role={msg && !msg.ok ? "alert" : "status"} className={msg ? (msg.ok ? "text-success" : "text-danger") : "sr-only"}>{msg?.text}</p>
      {list.length > 0 && (
        <ul className="space-y-1.5" aria-label="Revogações vigentes">
          {list.map((m) => (
            <li key={m.user_id + m.collection} className="flex flex-wrap items-center gap-2 rounded border border-line p-2">
              <span className="flex-1"><strong>{name(m.user_id)}</strong> · {MODULE_LABEL[m.collection] ?? m.collection} · {m.deny_read ? "sem ver nem editar" : "sem editar"} · {m.reason}{m.expires_at ? ` · até ${new Date(m.expires_at).toLocaleDateString("pt-BR")}` : ""}</span>
              <button className="btn btn-ghost min-h-9" onClick={() => void remove(m.user_id, m.collection)}><Undo2 aria-hidden className="size-4" /> Devolver</button>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <label className="block max-w-xs"><span className="label">O que esta pessoa pode fazer</span><select className="field" data-testid="gov-ver" value={seeing ?? ""} onChange={(e) => setSeeing(e.target.value || null)}><option value="">—</option>{team.map((t) => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}</select></label>
        {access.data && (
          <p className="flex flex-wrap gap-1.5 text-xs" aria-label="Acesso efetivo, conferido no banco"><Eye aria-hidden className="size-4" />
            {access.data.collections.filter((c) => MODULE_LABEL[c.collection]).map((c) => <span key={c.collection} className={`rounded border px-1.5 py-0.5 ${c.write ? "border-success/40 text-success" : c.read ? "border-info/40 text-info" : "border-line text-fg-muted line-through"}`}>{MODULE_LABEL[c.collection]}{c.write ? " · edita" : c.read ? " · vê" : ""}</span>)}
          </p>
        )}
      </div>
    </div>
  );
}
