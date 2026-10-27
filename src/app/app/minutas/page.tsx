"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, useUrlState } from "@/modules/shared";
import { createRow } from "@/services/mock/generic";
import { fillTemplate } from "@/domain/metrics";
import { formatInstant, formatCivil } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import { DRAFT_STATUS } from "@/modules/drafts/labels";

export default function MinutasPage() {
  const url = useUrlState();
  const router = useRouter();
  const drafts = useCollection("drafts");
  const templates = useCollection("templates");
  const cases = useCollection("cases");
  const clients = useCollection("clients");
  const orgs = useCollection("organizations");
  const act = useAction("drafts");
  const creating = url.get("novo") === "1";
  const [tpl, setTpl] = useState("");
  const [caseId, setCaseId] = useState(url.get("caso") ?? "");
  const [title, setTitle] = useState("");

  const create = async () => {
    const t = templates.data?.find((x) => x.id === tpl);
    const k = cases.data?.find((x) => x.id === caseId);
    const c = clients.data?.find((x) => x.id === k?.clientId);
    const vars = { "cliente.nome": c?.name, "cliente.documento": c?.document, "cliente.cidade": c?.city, "caso.titulo": k?.title, "caso.servico": k?.service, "escritorio.nome": orgs.data?.[0]?.name, cidade: c?.city, data: formatCivil(DEMO_TODAY) };
    const body = t ? fillTemplate(t.body, vars).text : "";
    const r = await act.run((ctx) => createRow("drafts", { title: title.trim(), kind: t?.kind ?? "peça", caseId: caseId || undefined, templateId: t?.id, body, status: "rascunho", references: [], comments: [], history: [{ at: new Date().toISOString(), actorId: ctx.actorId, text: t ? `Criada do modelo “${t.name}”` : "Criada em branco" }], updatedAt: new Date().toISOString() }, ctx, "Minuta criada"));
    if (r) router.push(`/app/minutas/${r.id}`);
  };

  return (
    <Guard area="minutas">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Minutas" description="Rascunho → revisão → ajustes → aprovado → exportado. Alteração após aprovação invalida a aprovação. Não há protocolo automático."
          actions={<><Link href="/app/modelos" className="btn btn-secondary">Modelos</Link><button className="btn btn-primary" onClick={() => url.set("novo", "1")}><Plus aria-hidden className="size-4" /> Nova minuta</button></>} />
        {drafts.isPending ? <LoadingBlock /> : !drafts.data?.length ? <EmptyState title="Nenhuma minuta" text="Crie a partir de um modelo próprio." /> : (
          <ul className="panel divide-y divide-line">
            {drafts.data.map((d) => (
              <li key={d.id}><Link href={`/app/minutas/${d.id}`} className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-surface-muted/50">
                <span className="min-w-0 flex-1"><span className="block font-medium">{d.title}</span><span className="text-fg-muted">{d.kind} · atualizada {formatInstant(d.updatedAt)}</span></span>
                <Badge tone={DRAFT_STATUS[d.status].tone}>{DRAFT_STATUS[d.status].label}</Badge>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={creating} onClose={() => url.set("novo", null)} title="Nova minuta">
        <div className="space-y-3">
          <label className="block"><span className="label">Título</span><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block"><span className="label">Modelo</span><select className="field" value={tpl} onChange={(e) => setTpl(e.target.value)}><option value="">Em branco</option>{templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="block"><span className="label">Caso (preenche variáveis)</span><select className="field" value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Sem caso</option>{cases.data?.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select></label>
          <Feedback error={act.error} />
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => url.set("novo", null)}>Cancelar</button><button className="btn btn-primary" disabled={title.trim().length < 3 || act.pending} onClick={create}>Criar minuta</button></div>
        </div>
      </Dialog>
    </Guard>
  );
}
