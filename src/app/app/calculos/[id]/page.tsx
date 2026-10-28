"use client";

import Link from "next/link";
import { use, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader, SimulatedBadge } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { updateRow } from "@/services/mock/generic";
import { formatBRL, parseBRL } from "@/lib/money";
import { buildSchedule } from "@/domain/commercial";
import { canApprove } from "@/domain/permissions";
import { downloadText, toCsv } from "@/domain/csv";
import { DEMO_TODAY } from "@/mocks/clock";
import { formatCivil } from "@/lib/dates";
import type { Calculation } from "@/domain/types";
import { CALC_STATUS_LABEL, findModel } from "@/domain/calc-engine";

const FIELD_LABEL: Record<string, string> = { salario: "Salário base (R$)", horasExtrasMes: "Horas extras por mês", meses: "Meses no período", adicional: "Adicional (%)", total: "Total (R$)", entrada: "Entrada (R$)", parcelas: "Número de parcelas", valorOriginal: "Valor original (R$)", dataBase: "Data-base", indice: "Índice", valorFinanciado: "Valor financiado (R$)", taxaContratada: "Taxa contratada (% a.m.)", prazo: "Prazo (meses)" };
const FIELDS: Record<string, string[]> = { "Rescisão e horas extras": ["salario", "horasExtrasMes", "meses", "adicional"], "Parcelamento administrativo": ["total", "entrada", "parcelas"], "Atualização de débito": ["valorOriginal", "dataBase", "indice"], "Revisão contratual": ["valorFinanciado", "taxaContratada", "prazo"] };

/** Só aritmética administrativa definida (centavos inteiros, arredondamento explícito). */
function compute(c: Calculation): { result: { label: string; value: string }[]; memory: string[] } | string {
  const i = c.inputs;
  const engine = findModel(c.model)?.run;
  if (engine) {
    const r = engine(i);
    return "error" in r ? r.error : { result: r.result, memory: [...r.memory, ...r.assumptions.map((a) => `Premissa: ${a}`)] };
  }
  if (c.model === "Rescisão e horas extras") {
    const sal = parseBRL(i.salario ?? "");
    const h = Number(i.horasExtrasMes);
    const m = Number(i.meses);
    const ad = Number(String(i.adicional ?? "").replace("%", ""));
    if (sal === null || !h || !m || !ad) return "Preencha todos os campos com números válidos.";
    const hour = Math.round(sal / 220); // divisor 220 (premissa do modelo de demonstração)
    const extra = Math.round((hour * (100 + ad)) / 100);
    const monthly = extra * h;
    const total = monthly * m;
    return {
      result: [{ label: "Horas extras (bruto, sem reflexos)", value: formatBRL(total) }],
      memory: [`Valor-hora = ${formatBRL(sal)} ÷ 220 = ${formatBRL(hour)} (arredondado ao centavo)`, `Hora extra = ${formatBRL(hour)} × ${(100 + ad) / 100} = ${formatBRL(extra)}`, `Mensal = ${formatBRL(extra)} × ${h} = ${formatBRL(monthly)}`, `Total = ${formatBRL(monthly)} × ${m} = ${formatBRL(total)}`, "Reflexos, correção e juros NÃO calculados (motor futuro)."],
    };
  }
  if (c.model === "Parcelamento administrativo") {
    const total = parseBRL(i.total ?? "");
    const down = parseBRL(i.entrada ?? "0") ?? 0;
    const n = Number(i.parcelas);
    if (total === null || !Number.isInteger(n) || n < 1) return "Informe total e número de parcelas.";
    try {
      const s = buildSchedule(total, down, n, DEMO_TODAY, 30);
      return { result: s.map((x) => ({ label: `${x.label} — ${formatCivil(x.due)}`, value: formatBRL(x.amount) })), memory: [`Saldo = ${formatBRL(total)} − ${formatBRL(down)} = ${formatBRL(total - down)}`, `Parcela base = saldo ÷ ${n}, truncada ao centavo; a última absorve o resto`, `Soma conferida = ${formatBRL(s.reduce((a, b) => a + b.amount, 0))}`] };
    } catch (e) {
      return (e as Error).message;
    }
  }
  return "Modelo sem motor implementado nesta fase. Registre entradas e anexe a memória elaborada pelo profissional.";
}

export default function CalculoPage({ params }: PageProps<"/app/calculos/[id]">) {
  const { id } = use(params);
  const { user } = useSession();
  const calcs = useCollection("calculations");
  const cases = useCollection("cases");
  const act = useAction("calculations");
  const c = calcs.data?.find((x) => x.id === id);
  const [msg, setMsg] = useState<string | null>(null);
  if (calcs.isPending) return <LoadingBlock />;
  if (!c) return <EmptyState title="Cálculo não encontrado" text="" action={<Link href="/app/calculos" className="btn btn-secondary">Voltar</Link>} />;
  const model = findModel(c.model);
  const fields = model ? model.fields.map((f) => f.key) : FIELDS[c.model] ?? [];
  const fieldDef = (k: string) => model?.fields.find((f) => f.key === k);
  const stale = c.resultsVersion !== null && c.resultsVersion !== c.inputsVersion;

  const setInput = (k: string, v: string) => act.run((ctx) => updateRow("calculations", c.id, ctx, (x: Calculation) => ({ ...x, inputs: { ...x.inputs, [k]: v }, inputsVersion: x.inputsVersion + 1, status: "rascunho" })));
  const run = () => {
    const r = compute(c);
    if (typeof r === "string") return setMsg(r);
    setMsg(null);
    act.run((ctx) => updateRow("calculations", c.id, ctx, (x: Calculation) => ({ ...x, result: r.result, memory: r.memory, resultsVersion: x.inputsVersion, baseDate: DEMO_TODAY, rulesVersion: "modelo-demo-1", status: "aguardando_revisao" }), "Cálculo executado"));
  };

  return (
    <Guard area="calculos">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader breadcrumb={[{ href: "/app/calculos", label: "Cálculos" }]} title={c.title} description={`${c.area} · ${c.model} · versão das regras ${c.rulesVersion ?? "—"} · data-base ${c.baseDate ? formatCivil(c.baseDate) : "—"}`} actions={<SimulatedBadge label={model ? CALC_STATUS_LABEL[model.status] : "Cálculo demonstrativo"} />} />
        <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <label className="block min-w-56 flex-1"><span className="label">Caso vinculado</span><select className="field" value={c.caseId ?? ""} onChange={(e) => act.run((ctx) => updateRow("calculations", c.id, ctx, (x: Calculation) => ({ ...x, caseId: e.target.value || undefined }), e.target.value ? "Cálculo vinculado ao caso" : "Cálculo desvinculado do caso"))}><option value="">Sem caso</option>{cases.data?.map((k) => <option key={k.id} value={k.id}>{k.title}</option>)}</select></label>
          {c.caseId && <Link className="btn btn-ghost" href={`/app/casos/${c.caseId}?aba=calculos`}>Abrir caso</Link>}
        </div>
        <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] border border-dashed border-accent/60 p-3 text-sm text-accent"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> Exemplo demonstrativo — cálculo jurídico não validado. Revisão profissional obrigatória.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="panel space-y-3 p-4">
            <h2 className="font-semibold">Entradas</h2>
            {fields.length === 0 && <p className="text-sm text-fg-muted">Este modelo ainda não tem formulário de entradas.</p>}
            {fields.map((f) => <Input key={`${f}-${c.inputs[f] ?? ""}`} label={fieldDef(f)?.label ?? FIELD_LABEL[f] ?? f} kind={fieldDef(f)?.kind} options={fieldDef(f)?.options} placeholder={fieldDef(f)?.placeholder} value={c.inputs[f] ?? ""} onSave={(v) => setInput(f, v)} />)}
            <button className="btn btn-primary" onClick={run} disabled={!fields.length}>Calcular</button>
            {msg && <p role="alert" className="text-sm text-warning">{msg}</p>}
          </section>
          <section className="panel space-y-3 p-4">
            <div className="flex items-center gap-2"><h2 className="flex-1 font-semibold">Resultado e memória</h2><Badge tone={c.status === "revisado" ? "success" : "warning"}>{c.status === "revisado" ? `Revisado por ${userName(c.reviewerId)}` : "Aguardando revisão"}</Badge></div>
            {stale && <p role="alert" className="rounded border border-danger/40 bg-danger-bg p-2 text-sm text-danger">Resultado desatualizado: as entradas mudaram depois do cálculo. Calcule novamente.</p>}
            {c.result ? (
              <div className={stale ? "opacity-50" : ""}>
                <dl className="space-y-1 text-sm">{c.result.map((r) => <div key={r.label} className="flex justify-between gap-3"><dt>{r.label}</dt><dd className="num font-semibold">{r.value}</dd></div>)}</dl>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-fg-muted">{c.memory?.map((m) => <li key={m}>{m}</li>)}</ol>
              </div>
            ) : <p className="text-sm text-fg-muted">Sem resultado ainda.</p>}
            <div className="flex flex-wrap gap-2">
              {c.result && !stale && c.status !== "revisado" && user && canApprove(user.role) && <button className="btn btn-secondary" onClick={() => act.run((ctx) => updateRow("calculations", c.id, ctx, (x: Calculation) => ({ ...x, status: "revisado", reviewerId: ctx.actorId }), "Cálculo revisado"))}>Marcar como revisado</button>}
              {c.result && <button className="btn btn-ghost" onClick={() => downloadText(`calculo-${c.id}.csv`, toCsv(["Item", "Valor"], [...c.result!.map((r) => [r.label, r.value]), ["", ""], ["Memória", ""], ...(c.memory ?? []).map((m) => [m, ""]), ["Aviso", "Demonstrativo — não validado"]]), "text/csv;charset=utf-8")}><Download aria-hidden className="size-4" /> Exportar CSV</button>}
              {c.result && <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir / PDF</button>}
            </div>
            <Feedback error={act.error} />
          </section>
        </div>
      </div>
    </Guard>
  );
}

function Input({ label, value, onSave, kind, options, placeholder }: { label: string; value: string; onSave: (v: string) => void; kind?: "text" | "textarea" | "select"; options?: string[]; placeholder?: string }) {
  const [v, setV] = useState(value);
  const save = () => v !== value && onSave(v);
  return (
    <label className="block"><span className="label">{label}</span>
      {kind === "textarea" ? <textarea rows={4} className="field num py-2" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onBlur={save} />
        : kind === "select" ? <select className="field" value={v || options?.[0]} onChange={(e) => { setV(e.target.value); onSave(e.target.value); }}>{options?.map((o) => <option key={o}>{o}</option>)}</select>
        : <input className="field num" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onBlur={save} />}
    </label>
  );
}
