"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { emptyPlanning, runPlanning, salariesFrom, type PlanningInput } from "@/domain/pension/planning";
import { brl, RMI_VERSION, type PcdGrade, type Projection } from "@/domain/pension/rmi";
import { OFFICIAL, withUpdates, type Tables } from "@/domain/tables";
import { civilFromInstant, formatCivil, parseCivilBR } from "@/lib/dates";
import { parseBRL } from "@/lib/money";
import type { IntelData } from "@/domain/pension/analysis";

const fmt = (d: string) => (d.length === 7 ? `${d.slice(5)}/${d.slice(0, 4)}` : formatCivil(d));
const RATES: [Projection["rate"], string][] = [["progressiva", "Empregado — tabela progressiva (7,5% a 14%)"], ["20", "20% — individual ou facultativo"], ["11", "11% sobre o mínimo — só aposentadoria por idade"], ["5", "5% sobre o mínimo — MEI/baixa renda, só por idade"]];

/** Atualizações das séries oficiais publicadas depois do arquivo versionado (falha silenciosa: usa o arquivo). */
function useTables(): Tables {
  const [t, setT] = useState<Tables>(OFFICIAL);
  useEffect(() => {
    let off = false;
    fetch("/api/tabelas").then((r) => r.json()).then((j) => { if (!off && j?.ok) setT(withUpdates(OFFICIAL, j.rows)); }).catch(() => undefined);
    return () => { off = true; };
  }, []);
  return t;
}

export function PlanningPanel({ d, onSave }: { d: IntelData; onSave: (next: IntelData, text: string) => unknown }) {
  const tables = useTables();
  const saved = d.planning ?? emptyPlanning();
  const [f, setF] = useState<PlanningInput>(saved);
  const [sal, setSal] = useState({ month: "", value: "" });
  const [pcd, setPcd] = useState({ grade: (saved.pcd?.grade ?? "leve") as PcdGrade, start: saved.pcd ? formatCivil(saved.pcd.start) : "", end: saved.pcd ? formatCivil(saved.pcd.end) : "", on: !!saved.pcd });
  const [projSalary, setProjSalary] = useState(saved.projection.salary ? saved.projection.salary.toFixed(2).replace(".", ",") : "");
  const [err, setErr] = useState<string | null>(null);
  const today = civilFromInstant(new Date().toISOString());
  const result = useMemo(() => runPlanning(d, saved, today, tables), [d, saved, today, tables]);
  const cnisMonths = useMemo(() => salariesFrom(d, []).length, [d]);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved) || pcd.on !== !!saved.pcd;

  const addSalary = () => {
    const m = /^(\d{2})\/(\d{4})$/.exec(sal.month.trim());
    const v = parseBRL(sal.value);
    if (!m || +m[1] < 1 || +m[1] > 12 || v === null || v <= 0) return setErr("Competência (mm/aaaa) e valor válidos.");
    setErr(null);
    const month = `${m[2]}-${m[1]}`;
    setF({ ...f, salaries: [...f.salaries.filter((x) => x.month !== month), { month, value: v / 100, source: "manual" as const }].sort((a, b) => a.month.localeCompare(b.month)) });
    setSal({ month: "", value: "" });
  };
  const save = () => {
    let pcdOut: PlanningInput["pcd"] = null;
    if (pcd.on) {
      const s = parseCivilBR(pcd.start), e = parseCivilBR(pcd.end);
      if (!s || !e || e < s) return setErr("Período como pessoa com deficiência inválido (dd/mm/aaaa).");
      pcdOut = { grade: pcd.grade, start: s, end: e };
    }
    const ps = projSalary.trim() ? parseBRL(projSalary) : 0;
    if (ps === null) return setErr("Salário da projeção inválido.");
    setErr(null);
    onSave({ ...d, planning: { ...f, pcd: pcdOut, projection: { ...f.projection, salary: (ps ?? 0) / 100 } } }, "Planejamento previdenciário atualizado");
  };

  return (
    <>
      <section className="panel space-y-3 p-4 text-sm">
        <h2 className="font-semibold">Premissas do planejamento</h2>
        <p className="text-fg-muted">Usa os vínculos revisados, os salários lidos do CNIS ({cnisMonths} competência(s)) e os que você informar abaixo. Índices oficiais até {fmt(Object.keys(tables.series.inpc).sort().at(-1) ?? "")} (INPC), teto e tábua IBGE {tables.lifeTables.mulheres.year}.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block sm:col-span-2"><span className="label">Como vai contribuir daqui em diante</span><select className="field" value={f.projection.rate} onChange={(e) => setF({ ...f, projection: { ...f.projection, rate: e.target.value as Projection["rate"] } })}>{RATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="block"><span className="label">Salário de contribuição (R$)</span><input className="field num" placeholder="último salário" value={projSalary} onChange={(e) => setProjSalary(e.target.value)} /></label>
        </div>
        <fieldset className="space-y-2">
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={pcd.on} onChange={(e) => setPcd({ ...pcd, on: e.target.checked })} /> Avaliar aposentadoria da pessoa com deficiência (LC 142/2013)</label>
          {pcd.on && <div className="grid gap-2 sm:grid-cols-3">
            <label className="block"><span className="label">Grau</span><select className="field" value={pcd.grade} onChange={(e) => setPcd({ ...pcd, grade: e.target.value as PcdGrade })}><option value="leve">Leve</option><option value="moderada">Moderada</option><option value="grave">Grave</option></select></label>
            <label className="block"><span className="label">Deficiência desde</span><input className="field num" placeholder="dd/mm/aaaa" value={pcd.start} onChange={(e) => setPcd({ ...pcd, start: e.target.value })} /></label>
            <label className="block"><span className="label">Até</span><input className="field num" placeholder="dd/mm/aaaa" value={pcd.end} onChange={(e) => setPcd({ ...pcd, end: e.target.value })} /></label>
          </div>}
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={f.accidental} onChange={(e) => setF({ ...f, accidental: e.target.checked })} /> Incapacidade de origem acidentária (100% do SB)</label>
          <label className="flex items-center gap-2">Dependentes para pensão <input className="field num w-20" type="number" min={1} max={5} value={f.dependents} onChange={(e) => setF({ ...f, dependents: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} /></label>
        </div>
        <details>
          <summary className="cursor-pointer font-medium">Salários informados manualmente ({f.salaries.length})</summary>
          <p className="mt-1 text-fg-muted">Para competências sem remuneração no CNIS ou corrigidas por holerite. Substituem o valor lido no mesmo mês.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="block"><span className="label">Competência</span><input className="field num w-28" placeholder="mm/aaaa" value={sal.month} onChange={(e) => setSal({ ...sal, month: e.target.value })} /></label>
            <label className="block"><span className="label">Valor (R$)</span><input className="field num w-32" value={sal.value} onChange={(e) => setSal({ ...sal, value: e.target.value })} /></label>
            <button className="btn btn-secondary min-h-10" onClick={addSalary}><Plus aria-hidden className="size-4" /> Incluir salário</button>
          </div>
          {f.salaries.length > 0 && <ul className="num mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">{f.salaries.map((s) => <li key={s.month} className="flex items-center gap-1">{fmt(s.month)}: {brl(s.value)}<button className="btn btn-ghost min-h-8 px-1" aria-label={`Remover ${fmt(s.month)}`} onClick={() => setF({ ...f, salaries: f.salaries.filter((x) => x.month !== s.month) })}><Trash2 aria-hidden className="size-3.5" /></button></li>)}</ul>}
        </details>
        {err && <p role="alert" className="text-danger">{err}</p>}
        <button className="btn btn-primary" disabled={!dirty && !projSalary} onClick={save}>Salvar e recalcular</button>
      </section>

      {"error" in result ? <p role="status" className="panel p-4 text-sm text-warning">{result.error}</p> : (
        <>
          <section className="panel p-4 text-sm" data-testid="planejamento-hoje">
            <h2 className="mb-1 font-semibold">Situação hoje ({formatCivil(today)})</h2>
            {result.plan.current.best ? (
              <p>Já tem direito: <strong>{result.plan.current.best.name}</strong>, RMI estimada <strong className="num">{result.plan.current.best.rmi != null ? brl(result.plan.current.best.rmi) : "—"}</strong>.</p>
            ) : <p>Ainda não cumpre os requisitos de nenhuma aposentadoria.</p>}
            {result.plan.current.best && <ul className="mt-1 list-disc pl-5 text-fg-muted">{result.plan.current.best.memo.map((m) => <li key={m}>{m}</li>)}</ul>}
            <p className="mt-2 text-fg-muted">Expectativa de vida (IBGE {result.plan.lifeExpectancy.table}): até {result.plan.lifeExpectancy.until.toFixed(1).replace(".", ",")} anos. Contribuição projetada: {brl(result.plan.contribution.value)}/mês.</p>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">Datas em que cumprirá cada regra</h2>
            {!result.plan.points.length && <p className="text-sm text-fg-muted">Nenhuma regra nova alcançada em 30 anos com essas premissas.</p>}
            {result.plan.points.map((pt) => (
              <article key={pt.rule} className="panel p-4 text-sm" data-testid={`plano-${pt.rule}`}>
                <div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 flex-1 font-semibold">{formatCivil(pt.date)} — {pt.name}</h3><Badge tone="info">RMI {pt.rmi != null ? brl(pt.rmi) : "—"}</Badge></div>
                <p className="text-fg-muted">Idade na data: {pt.ageAt}.</p>
                <table className="mt-2 w-full text-left text-xs"><thead><tr className="text-fg-muted"><th className="py-1">Requisito</th><th>Exigência</th><th>Na data</th></tr></thead>
                  <tbody>{pt.requirements.map((q) => <tr key={q.label} className="border-t border-line"><td className="py-1">{q.label}</td><td>{q.needed}</td><td>{q.has}</td></tr>)}</tbody></table>
                <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                  <div><dt className="inline text-fg-muted">Contribuições até lá: </dt><dd className="num inline">{pt.contribMonths} × {brl(result.plan.contribution.value)} = {brl(pt.contribTotal)}</dd></div>
                  {result.plan.current.best && <div><dt className="inline text-fg-muted">Deixa de receber se esperar: </dt><dd className="num inline">{brl(pt.lostTotal)}</dd></div>}
                  {pt.gain != null && <div><dt className="inline text-fg-muted">Aumento mensal: </dt><dd className="num inline">{brl(pt.gain)}</dd></div>}
                  {pt.paybackMonths != null && <div><dt className="inline text-fg-muted">Retorno do investimento: </dt><dd className="num inline">{pt.paybackMonths} meses</dd></div>}
                  {pt.lifetimeValue != null && <div className="sm:col-span-2"><dt className="inline text-fg-muted">Valor estimado até a expectativa de vida: </dt><dd className="num inline">{brl(pt.lifetimeValue)}</dd></div>}
                </dl>
                <details className="mt-2"><summary className="cursor-pointer text-xs text-fg-muted">Memória de cálculo</summary><ul className="mt-1 list-disc pl-5 text-xs text-fg-muted">{pt.memo.map((m) => <li key={m}>{m}</li>)}</ul><a className="text-xs text-accent underline" href={pt.source.url} target="_blank" rel="noreferrer">{pt.source.label}</a></details>
              </article>
            ))}
            {result.plan.unreachable.length > 0 && <div className="panel p-4 text-sm"><h3 className="font-semibold">Inatingíveis</h3><ul className="mt-1 list-disc pl-5">{result.plan.unreachable.map((u) => <li key={u.id}>{u.name}: {u.note ?? "requisito não alcançável"}</li>)}</ul></div>}
          </section>
          {result.others && (
            <section className="panel p-4 text-sm">
              <h2 className="mb-2 font-semibold">Outros benefícios hoje (salário de benefício {brl(result.others.sb)})</h2>
              <ul className="space-y-1">{result.others.items.map((i) => <li key={i.id} className="flex flex-wrap gap-2"><span className="min-w-0 flex-1">{i.name}<span className="block text-xs text-fg-muted">{i.memo} <a className="text-accent underline" href={i.source.url} target="_blank" rel="noreferrer">fonte</a></span></span><span className="num font-semibold">{brl(i.value)}</span></li>)}</ul>
            </section>
          )}
          <section className="panel p-4 text-xs text-fg-muted"><p className="font-medium text-fg">Premissas ({RMI_VERSION}, aguardando validação jurídica)</p><ul className="mt-1 list-disc pl-5">{result.plan.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></section>
        </>
      )}
    </>
  );
}
