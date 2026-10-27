"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/providers";
import { Badge, PageHeader } from "@/components/ui";
import { readAll, writeMany } from "@/services/mock/db";
import { formatInstant } from "@/lib/dates";
import type { SupportTicket } from "@/domain/saas";

const STATUS: Record<SupportTicket["status"], string> = { aberto: "Aberto", em_andamento: "Em andamento", aguardando_escritorio: "Aguardando escritório", resolvido: "Resolvido" };

export default function SuportePage() {
  const data = useQuery({ queryKey: ["supportTickets"], queryFn: async () => ({ tickets: await readAll("supportTickets"), tenants: await readAll("tenants") }) });
  return (
    <>
      <PageHeader title="Suporte" description="Chamados dos escritórios. Notas internas não aparecem para o escritório. Acesso assistido aos dados do escritório: só na fase com backend, com consentimento e auditoria." />
      <ul className="space-y-3">{data.data?.tickets.map((t) => <Ticket key={t.id} t={t} office={data.data!.tenants.find((x) => x.id === t.organizationId)?.name ?? t.organizationId} />)}</ul>
    </>
  );
}

function Ticket({ t, office }: { t: SupportTicket; office: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(true);
  const update = async (patch: (x: SupportTicket) => SupportTicket) => {
    const all = await readAll("supportTickets");
    await writeMany({ supportTickets: all.map((x) => (x.id === t.id ? patch(x) : x)) });
    await qc.invalidateQueries({ queryKey: ["supportTickets"] });
  };
  return (
    <li className="panel space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2"><p className="flex-1 font-semibold">{t.subject}</p><Badge tone={t.priority === "urgente" || t.priority === "alta" ? "warning" : "neutral"}>{t.priority}</Badge><Badge tone={t.status === "resolvido" ? "success" : "info"}>{STATUS[t.status]}</Badge></div>
      <p className="text-fg-muted">{office} · aberto {formatInstant(t.createdAt)} · SLA {t.slaHours} h</p>
      <ul className="space-y-1 border-l border-line pl-3">{t.notes.map((n, i) => <li key={i}><span className="text-fg-muted">{formatInstant(n.at)} · {n.author}{n.internal ? " · nota interna" : ""}:</span> {n.text}</li>)}</ul>
      <div className="flex flex-wrap items-center gap-2">
        <input className="field max-w-md" aria-label={`Resposta ao chamado ${t.subject}`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma resposta ou nota" />
        <label className="flex items-center gap-1"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Nota interna</label>
        <button className="btn btn-secondary" disabled={!text.trim()} onClick={async () => { await update((x) => ({ ...x, status: internal ? x.status : "aguardando_escritorio", notes: [...x.notes, { at: new Date().toISOString(), author: user!.name, text: text.trim(), internal }] })); setText(""); }}>Registrar</button>
        {t.status !== "resolvido" && <button className="btn btn-ghost" onClick={() => update((x) => ({ ...x, status: "resolvido" }))}>Marcar como resolvido</button>}
      </div>
      <p className="text-xs text-fg-muted">Nenhum e-mail é enviado nesta demonstração.</p>
    </li>
  );
}
