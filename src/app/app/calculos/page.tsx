"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { createRow } from "@/services/mock/generic";

// Catálogo por área. Só modelos com aritmética administrativa definida calculam; os demais são cadastro + revisão.
const CALC_CATALOG: { area: string; models: { name: string; implemented: boolean; fields: string[] }[] }[] = [
  { area: "Trabalhista", models: [{ name: "Rescisão e horas extras", implemented: true, fields: ["salario", "horasExtrasMes", "meses", "adicional"] }, { name: "Reflexos em férias e 13º", implemented: false, fields: [] }] },
  { area: "Cível", models: [{ name: "Atualização de débito", implemented: false, fields: ["valorOriginal", "dataBase", "indice"] }, { name: "Parcelamento administrativo", implemented: true, fields: ["total", "entrada", "parcelas"] }] },
  { area: "Bancária", models: [{ name: "Revisão contratual", implemented: false, fields: ["valorFinanciado", "taxaContratada", "prazo"] }] },
  { area: "Tributária", models: [{ name: "Restituição de indébito", implemented: false, fields: [] }] },
  { area: "Penal", models: [{ name: "Dosimetria/execução (referência)", implemented: false, fields: [] }] },
  { area: "Previdenciária", models: [{ name: "Análise CNIS e cenários", implemented: false, fields: [] }] },
];

export default function CalculosPage() {
  const calcs = useCollection("calculations");
  const router = useRouter();
  const act = useAction("calculations");
  const [model, setModel] = useState<{ area: string; name: string } | null>(null);
  const [title, setTitle] = useState("");
  return (
    <Guard area="calculos">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Cálculos" description="Catálogo por área. O motor jurídico completo é fase futura: aqui só a aritmética administrativa definida é calculada; o resto é cadastro, memória e revisão." />
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CALC_CATALOG.map((g) => (
            <section key={g.area} className="panel p-4">
              <h2 className="mb-2 font-semibold">{g.area}</h2>
              <ul className="space-y-2 text-sm">
                {g.models.map((m) => (
                  <li key={m.name} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 break-words">{m.name}</span>
                    {m.implemented ? <Badge tone="success">Aritmética implementada</Badge> : <Badge tone="neutral">Cadastro e revisão</Badge>}
                    <button className="btn btn-ghost min-h-8 px-2 text-xs" aria-label={`Novo cálculo: ${m.name}`} onClick={() => { setModel({ area: g.area, name: m.name }); setTitle(m.name); }}><Plus aria-hidden className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <h2 className="mb-2 font-semibold">Cálculos do escritório</h2>
        {calcs.isPending ? <LoadingBlock /> : !calcs.data?.length ? <EmptyState title="Nenhum cálculo" text="Escolha um modelo no catálogo." /> : (
          <ul className="panel divide-y divide-line">
            {calcs.data.map((c) => (
              <li key={c.id}><Link href={`/app/calculos/${c.id}`} className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-surface-muted/50">
                <span className="min-w-0 flex-1"><span className="block font-medium">{c.title}</span><span className="text-fg-muted">{c.area} · {c.model}</span></span>
                {c.resultsVersion !== null && c.resultsVersion !== c.inputsVersion && <Badge tone="danger">Resultado desatualizado</Badge>}
                <Badge tone={c.status === "revisado" ? "success" : c.status === "aguardando_revisao" ? "warning" : "neutral"}>{{ rascunho: "Rascunho", aguardando_revisao: "Aguardando revisão", revisado: "Revisado" }[c.status]}</Badge>
              </Link></li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={!!model} onClose={() => setModel(null)} title="Novo cálculo">
        <label className="block"><span className="label">Título</span><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <Feedback error={act.error} />
        <div className="mt-4 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setModel(null)}>Cancelar</button>
          <button className="btn btn-primary" disabled={!title.trim()} onClick={async () => { const r = await act.run((ctx) => createRow("calculations", { area: model!.area, model: model!.name, title: title.trim(), inputs: {}, status: "rascunho", inputsVersion: 1, resultsVersion: null }, ctx, "Cálculo criado")); if (r) router.push(`/app/calculos/${r.id}`); }}>Criar</button>
        </div>
      </Dialog>
    </Guard>
  );
}
