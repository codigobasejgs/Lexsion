"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { createRow, updateRow } from "@/services/mock/generic";
import { fillTemplate } from "@/domain/metrics";
import type { Template } from "@/domain/types";

const VARS = ["cliente.nome", "cliente.documento", "cliente.cidade", "caso.titulo", "caso.servico", "escritorio.nome", "cidade", "data", "honorarios", "validade", "fatos", "pedidos"];
const SAMPLE = { "cliente.nome": "Maria das Graças Exemplo", "cliente.documento": "000.000.133-33", "cliente.cidade": "Salvador", "caso.titulo": "BPC/LOAS", "caso.servico": "Concessão BPC", "escritorio.nome": "Aurora Advocacia (fictícia)", cidade: "Salvador", data: "26/10/2026" };

export default function ModelosPage() {
  const tpls = useCollection("templates");
  const act = useAction("templates");
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  return (
    <Guard area="minutas">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader breadcrumb={[{ href: "/app/minutas", label: "Minutas" }]} title="Modelos próprios" description="Modelos originais do escritório com variáveis {{assim}}. A prévia mostra campos não preenchidos." actions={<button className="btn btn-primary" onClick={() => setEditing("new")}><Plus aria-hidden className="size-4" /> Novo modelo</button>} />
        {tpls.isPending ? <LoadingBlock /> : !tpls.data?.length ? <EmptyState title="Sem modelos" text="Crie o primeiro modelo." /> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {tpls.data.map((t) => <li key={t.id}><button onClick={() => setEditing(t)} className="panel w-full p-4 text-left text-sm hover:border-line-strong"><p className="font-medium">{t.name}</p><p className="text-fg-muted">{t.kind}</p></button></li>)}
          </ul>
        )}
      </div>
      {editing && <TemplateDialog t={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} act={act} />}
    </Guard>
  );
}

function TemplateDialog({ t, onClose, act }: { t?: Template; onClose: () => void; act: ReturnType<typeof useAction> }) {
  const [name, setName] = useState(t?.name ?? "");
  const [kind, setKind] = useState(t?.kind ?? "petição");
  const [body, setBody] = useState(t?.body ?? "");
  const preview = fillTemplate(body, SAMPLE);
  return (
    <Dialog open onClose={onClose} title={t ? "Editar modelo" : "Novo modelo"} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">Nome</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block"><span className="label">Tipo</span><select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>{["proposta", "contrato", "procuração", "petição", "recurso", "requerimento", "notificação"].map((k) => <option key={k}>{k}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Variáveis">{VARS.map((v) => <button key={v} className="btn btn-ghost min-h-8 border border-line text-xs" onClick={() => setBody((b) => `${b}{{${v}}}`)}>{`{{${v}}}`}</button>)}</div>
        <label className="block"><span className="label">Texto</span><textarea rows={8} className="field py-2 font-serif" value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <section aria-label="Prévia"><p className="label">Prévia com dados de exemplo</p><pre className="whitespace-pre-wrap rounded border border-line bg-surface-muted p-3 font-serif text-sm">{preview.text}</pre>{preview.missing.length > 0 && <p className="mt-1 text-sm text-warning">Não preenchidos na prévia: {preview.missing.join(", ")}</p>}</section>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={name.trim().length < 3 || !body.trim()} onClick={async () => {
            const r = t ? await act.run((ctx) => updateRow("templates", t.id, ctx, (x: Template) => ({ ...x, name, kind, body }))) : await act.run((ctx) => createRow("templates", { name, kind, body }, ctx, "Modelo criado"));
            if (r) onClose();
          }}>Salvar modelo</button>
        </div>
      </div>
    </Dialog>
  );
}
