"use client";

import { useState } from "react";
import { Download, Table2 } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { PageHeader } from "@/components/ui";
import { Chips } from "@/modules/shared";
import { STAGES } from "@/domain/crm";
import { pct } from "@/domain/metrics";
import { downloadText, toCsv } from "@/domain/csv";
import { formatBRL } from "@/lib/money";
import { diffDays } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import { people as users } from "@/components/people";
import { isPlatformRole } from "@/domain/permissions";

type Report = "funil" | "origem" | "carga" | "prazos" | "documentos" | "financeiro" | "ia";

/** Barra horizontal acessível: valor em texto + tabela alternativa. */
function Bars({ title, rows, format = (n: number) => String(n) }: { title: string; rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <figure className="panel p-4">
      <div className="mb-3 flex items-center gap-2"><figcaption className="flex-1 font-semibold">{title}</figcaption>
        <button className="btn btn-ghost min-h-8 text-xs" aria-pressed={table} onClick={() => setTable(!table)}><Table2 aria-hidden className="size-4" /> {table ? "Ver gráfico" : "Ver dados"}</button>
        <button className="btn btn-ghost min-h-8 text-xs" onClick={() => downloadText(`${title}.csv`, toCsv(["Item", "Valor"], rows.map((r) => [r.label, r.value])), "text/csv;charset=utf-8")}><Download aria-hidden className="size-4" /> CSV</button>
      </div>
      {table ? (
        <table className="w-full text-sm"><caption className="sr-only">{title}</caption><tbody>{rows.map((r) => <tr key={r.label} className="border-t border-line"><th scope="row" className="py-1 text-left font-normal">{r.label}</th><td className="num text-right">{format(r.value)}</td></tr>)}</tbody></table>
      ) : (
        <ul className="space-y-2" aria-hidden={false}>
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="h-4 rounded bg-surface-muted"><span className="block h-4 rounded bg-brand/80" style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} /></span>
              <span className="num w-24 text-right">{format(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export default function RelatoriosPage() {
  const [r, setR] = useState<Report>("funil");
  const { org } = useSession();
  const leads = useCollection("leads");
  const tasks = useCollection("tasks");
  const deadlines = useCollection("deadlines");
  const docs = useCollection("documents");
  const insts = useCollection("installments");
  const pays = useCollection("payments");
  const convs = useCollection("conversations");
  const agents = useCollection("agents");

  // React Compiler memoiza; sem useMemo manual.
  const data = (() => {
    const L = leads.data ?? [];
    const eligible = L.filter((l) => l.stage !== "perdido" || l.lostReason !== "Contato duplicado ou inválido");
    const signed = L.filter((l) => l.stage === "contratado").length;
    const overdueBalance = (insts.data ?? []).filter((i) => i.status !== "cancelada" && diffDays(DEMO_TODAY, i.due) < 0).reduce((s, i) => s + i.amount - i.paid, 0);
    const openBalance = (insts.data ?? []).filter((i) => i.status !== "cancelada").reduce((s, i) => s + i.amount - i.paid, 0);
    const byMonth = new Map<string, number>();
    for (const p of pays.data ?? []) byMonth.set(p.date.slice(0, 7), (byMonth.get(p.date.slice(0, 7)) ?? 0) + p.amount);
    return {
      funnel: STAGES.map((s) => ({ label: s.label, value: L.filter((l) => l.stage === s.key).length })),
      conversion: pct(signed, eligible.length),
      origin: [...new Set(L.map((l) => l.firstTouch.origin))].map((o) => ({ label: o, value: L.filter((l) => l.firstTouch.origin === o).length })),
      load: users.filter((u) => u.role !== "cliente" && !isPlatformRole(u.role) && u.organizationId === org?.id).map((u) => ({ label: u.name, value: (tasks.data ?? []).filter((t) => t.assigneeId === u.id && !t.done).length })).filter((x) => x.value > 0),
      deadlines: [{ label: "Aguardando confirmação", value: (deadlines.data ?? []).filter((d) => d.status === "proposto").length }, { label: "Confirmados", value: (deadlines.data ?? []).filter((d) => d.status === "confirmado").length }, { label: "Cumpridos", value: (deadlines.data ?? []).filter((d) => d.status === "cumprido").length }],
      docs: ["solicitado", "recebido", "em_leitura", "precisa_revisar", "validado", "rejeitado"].map((s) => ({ label: s, value: (docs.data ?? []).filter((d) => d.status === s).length })),
      received: [...byMonth.entries()].sort().map(([k, v]) => ({ label: k.split("-").reverse().join("/"), value: v })),
      overdue: pct(overdueBalance, openBalance),
      overdueBalance,
      ai: (agents.data ?? []).map((a) => ({ label: a.name, value: a.usage.conversations })),
      aiHandoff: pct((agents.data ?? []).reduce((s, a) => s + a.usage.handoffs, 0), (agents.data ?? []).reduce((s, a) => s + a.usage.conversations, 0)),
      waiting: (convs.data ?? []).filter((c) => c.status === "aguardando_equipe").length,
    };
  })();

  return (
    <Guard area="relatorios">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Relatórios" description="Gráficos derivados dos mesmos registros das telas. Cada métrica informa numerador e denominador. CSV exportado com proteção contra fórmulas." />
        <Chips label="Relatório" value={r} onChange={setR} options={[{ key: "funil", label: "Funil" }, { key: "origem", label: "Origem" }, { key: "carga", label: "Carga de trabalho" }, { key: "prazos", label: "Prazos" }, { key: "documentos", label: "Documentos" }, { key: "financeiro", label: "Financeiro" }, { key: "ia", label: "Consumo de IA" }]} />
        <div className="mt-4 space-y-4">
          {r === "funil" && <><Bars title="Leads por etapa" rows={data.funnel} /><p className="text-sm text-fg-muted">Conversão = contratos assinados ÷ leads elegíveis (exclui duplicados/inválidos): <strong className="num">{data.conversion}</strong>. Tempo de resposta: {data.waiting} conversa(s) aguardando a equipe agora.</p></>}
          {r === "origem" && <Bars title="Leads por primeira origem" rows={data.origin} />}
          {r === "carga" && <Bars title="Tarefas abertas por pessoa" rows={data.load} />}
          {r === "prazos" && <Bars title="Prazos por situação" rows={data.deadlines} />}
          {r === "documentos" && <Bars title="Documentos por situação" rows={data.docs} />}
          {r === "financeiro" && <><Bars title="Recebido por mês (data efetiva, líquido de estornos)" rows={data.received} format={formatBRL} /><p className="text-sm text-fg-muted">Inadimplência = saldo vencido ÷ saldo em aberto: <strong className="num">{data.overdue}</strong> ({formatBRL(data.overdueBalance)} vencidos).</p></>}
          {r === "ia" && <><Bars title="Conversas por agente (demonstração)" rows={data.ai} /><p className="text-sm text-fg-muted">Taxa de encaminhamento para humano = encaminhamentos ÷ conversas: <strong className="num">{data.aiHandoff}</strong>.</p></>}
        </div>
      </div>
    </Guard>
  );
}
