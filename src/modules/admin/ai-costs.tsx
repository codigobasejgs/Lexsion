"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Badge, LoadingBlock } from "@/components/ui";
import { useSession } from "@/components/providers";

type G = { key: string; calls: number; pages: number; inputTokens: number; outputTokens: number; costUsd: number; platformCostUsd: number; name?: string; plan?: string | null };
type Budget = { scope: string; ref: string; monthly_usd: number | null; ocr_pages_day: number | null; ocr_pages_month: number | null; alert_pct: number; note: string };
type Data = {
  settings: { ocr_enabled: boolean; billing_confirmed_at: string | null; billing_note: string; invoice_month: string | null; invoice_usd: number | null };
  month: { costUsd: number; platformCostUsd: number; pages: number; inputTokens: number; outputTokens: number; calls: number; estimatedCalls: number; cacheHits: number; failures: number };
  projection: { usd: number; cap: number; alertPct: number; alert: boolean };
  daily: G[]; byModule: G[]; byModel: G[]; byOffice: G[]; budgets: Budget[]; prices: { model: string; input_per_mtok: number; output_per_mtok: number; source_url: string; checked_on: string }[];
};
const usd = (v: number) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })}`;
const num = (v: number) => v.toLocaleString("pt-BR");
const MODULE: Record<string, string> = { ocr: "Leitura de documentos (OCR)", atendimento: "Atendimento WhatsApp", assistente: "Assistente e simulador", ia: "IA (registros antigos)" };

/** Controle financeiro da IA: consumo, projeção, limites e trava do OCR. Tudo aplicado no servidor/banco. */
export function AiCosts() {
  const { user } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "ia-custos"], queryFn: async () => { const r = await fetch("/api/admin/ia-custos"); const j = await r.json(); if (!j.ok) throw new Error(j.error?.message); return j as Data; } });
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [note, setNote] = useState("");
  const [edit, setEdit] = useState<Record<string, { monthlyUsd: string; pagesDay: string; pagesMonth: string }>>({});
  const [newOffice, setNewOffice] = useState("");
  const isSuper = user?.role === "superadmin";
  const post = async (body: Record<string, unknown>, ok: string) => {
    setMsg(null);
    const r = await fetch("/api/admin/ia-custos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setMsg(j.ok ? { tone: "ok", text: ok } : { tone: "err", text: j.error?.message ?? "Não foi possível salvar." });
    if (j.ok) await qc.invalidateQueries({ queryKey: ["admin", "ia-custos"] });
  };
  if (q.isPending) return <LoadingBlock rows={4} />;
  if (q.error || !q.data) return <p role="alert" className="text-danger">{(q.error as Error)?.message ?? "Sem dados."}</p>;
  const d = q.data;
  const ocrReady = d.settings.ocr_enabled && !!d.settings.billing_confirmed_at;
  const maxDay = Math.max(0.0001, ...d.daily.map((x) => x.costUsd));
  const key = (b: Budget) => `${b.scope}:${b.ref}`;
  const val = (b: Budget) => edit[key(b)] ?? { monthlyUsd: b.monthly_usd?.toString() ?? "", pagesDay: b.ocr_pages_day?.toString() ?? "", pagesMonth: b.ocr_pages_month?.toString() ?? "" };
  const label = (b: Budget) => (b.scope === "plataforma" ? "Plataforma (todos)" : b.scope === "plano" ? `Plano ${b.ref}` : d.byOffice.find((o) => o.key === b.ref)?.name ?? `Escritório ${b.ref.slice(0, 8)}`);

  return (
    <section className="space-y-4" aria-labelledby="ia-custos-t" data-testid="ia-custos">
      <h2 id="ia-custos-t" className="text-lg font-semibold">Inteligência artificial: consumo e limites</h2>
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-[var(--radius-control)] border p-3 text-sm ${msg.tone === "err" ? "border-danger/40 bg-danger-bg text-danger" : "border-success/30 bg-success-bg text-success"}`}>{msg.text}</p>}

      <div className="panel space-y-2 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><h3 className="flex-1 font-semibold">Leitura de documentos escaneados (OCR)</h3><Badge tone={ocrReady ? "success" : "warning"}>{ocrReady ? "Ligada" : "Bloqueada"}</Badge></div>
        <p className="text-fg-muted">O OCR só funciona com o faturamento do Google confirmado (conta paga: o Google não usa o conteúdo para treinar modelos) e com a chave-mestra ligada. Sem isso, o banco recusa qualquer leitura.</p>
        <p>Faturamento Google: {d.settings.billing_confirmed_at ? <><strong>confirmado</strong> em {new Date(d.settings.billing_confirmed_at).toLocaleString("pt-BR")} — {d.settings.billing_note}</> : <strong>não confirmado</strong>}</p>
        {isSuper ? (
          <div className="flex flex-wrap items-end gap-2">
            {!d.settings.billing_confirmed_at ? <>
              <label className="block min-w-64 flex-1"><span className="label">Evidência (projeto, conta de faturamento, data)</span><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <button className="btn btn-secondary" onClick={() => post({ action: "billing", confirm: true, note }, "Faturamento confirmado e registrado na auditoria.")}>Confirmar faturamento</button>
            </> : <button className="btn btn-ghost" onClick={() => post({ action: "billing", confirm: false, note: "retirado" }, "Confirmação retirada; OCR desligado.")}>Retirar confirmação</button>}
            <button className="btn btn-primary" disabled={!d.settings.billing_confirmed_at} onClick={() => post({ action: "ocr", enabled: !d.settings.ocr_enabled }, d.settings.ocr_enabled ? "OCR desligado." : "OCR ligado.")}>{d.settings.ocr_enabled ? "Desligar OCR" : "Ligar OCR"}</button>
          </div>
        ) : <p className="text-xs text-fg-muted">Só o Super Admin altera.</p>}
      </div>

      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[["Custo no mês (estimado)", usd(d.month.costUsd)], ["Da chave da plataforma", usd(d.month.platformCostUsd)], ["Projeção do mês", usd(d.projection.usd)], ["Teto mensal", usd(d.projection.cap)], ["Páginas lidas por IA", num(d.month.pages)], ["Tokens (entrada / saída)", `${num(d.month.inputTokens)} / ${num(d.month.outputTokens)}`], ["Chamadas", `${num(d.month.calls)}${d.month.estimatedCalls ? ` (${d.month.estimatedCalls} estimadas)` : ""}`], ["Reaproveitamentos (cache) / falhas", `${d.month.cacheHits} / ${d.month.failures}`]].map(([k, v]) => <div key={k} className="panel p-3"><dt className="text-xs text-fg-muted">{k}</dt><dd className="num font-semibold">{v}</dd></div>)}
      </dl>
      {d.projection.alert && <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] border border-warning/40 bg-warning-bg p-3 text-sm text-warning"><AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" /> Consumo acima de {d.projection.alertPct}% do teto ou projeção acima do teto. Ao atingir o teto, o banco bloqueia novas chamadas com a chave da plataforma.</p>}
      <div className="panel p-4 text-sm">
        <p className="mb-1 font-medium">Custo apurado (fatura do Google)</p>
        <p className="text-fg-muted">{d.settings.invoice_month ? `${d.settings.invoice_month}: ${usd(Number(d.settings.invoice_usd ?? 0))} informado; estimado no sistema para o mês corrente: ${usd(d.month.platformCostUsd)}.` : "Nenhuma fatura informada. O custo acima é estimado pelos tokens devolvidos pelo Google × preço oficial."}</p>
        {isSuper && <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); post({ action: "invoice", invoiceMonth: f.get("m"), invoiceUsd: Number(String(f.get("v")).replace(",", ".")) }, "Custo apurado registrado."); }}><label className="block"><span className="label">Mês (AAAA-MM)</span><input name="m" className="field num w-28" /></label><label className="block"><span className="label">Valor (US$)</span><input name="v" className="field num w-28" /></label><button className="btn btn-ghost">Registrar fatura</button></form>}
      </div>

      <div className="panel p-4 text-sm">
        <p className="mb-2 font-medium">Consumo diário (30 dias)</p>
        {!d.daily.length ? <p className="text-fg-muted">Nenhum uso registrado.</p> : <ul className="space-y-1">{d.daily.map((x) => <li key={x.key} className="grid grid-cols-[6rem_1fr_7rem] items-center gap-2"><span className="num text-xs">{x.key.split("-").reverse().join("/")}</span><span className="h-2 rounded bg-surface-2"><span className="block h-2 rounded bg-brand" style={{ width: `${(x.costUsd / maxDay) * 100}%` }} /></span><span className="num text-right text-xs">{usd(x.costUsd)} · {x.pages} pág.</span></li>)}</ul>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {([["Por módulo", d.byModule, (g: G) => MODULE[g.key] ?? g.key], ["Por modelo", d.byModel, (g: G) => g.key]] as const).map(([t, list, lab]) => (
          <div key={t} className="panel p-4 text-sm"><p className="mb-2 font-medium">{t}</p>{!list.length ? <p className="text-fg-muted">Sem uso no mês.</p> : <table className="w-full text-left text-xs"><thead><tr className="text-fg-muted"><th className="py-1">Item</th><th>Chamadas</th><th>Páginas</th><th className="text-right">Custo</th></tr></thead><tbody>{list.map((g) => <tr key={g.key} className="border-t border-line"><td className="py-1">{lab(g)}</td><td className="num">{g.calls}</td><td className="num">{g.pages}</td><td className="num text-right">{usd(g.costUsd)}</td></tr>)}</tbody></table>}</div>
        ))}
      </div>
      <div className="panel overflow-x-auto p-4 text-sm"><p className="mb-2 font-medium">Por escritório (mês)</p>{!d.byOffice.length ? <p className="text-fg-muted">Sem uso no mês.</p> : <table className="w-full text-left text-xs"><thead><tr className="text-fg-muted"><th className="py-1">Escritório</th><th>Plano</th><th>Chamadas</th><th>Páginas</th><th>Tokens</th><th className="text-right">Custo</th></tr></thead><tbody>{d.byOffice.map((g) => <tr key={g.key} className="border-t border-line"><td className="py-1">{g.name}</td><td>{g.plan ?? "—"}</td><td className="num">{g.calls}</td><td className="num">{g.pages}</td><td className="num">{num(g.inputTokens + g.outputTokens)}</td><td className="num text-right">{usd(g.costUsd)}</td></tr>)}</tbody></table>}</div>

      <div className="panel overflow-x-auto p-4 text-sm">
        <p className="mb-1 font-medium">Limites (aplicados no banco)</p>
        <p className="mb-2 text-xs text-fg-muted">Ordem: escritório → plano → plataforma. Escritório sem linha de plano ou exceção usa o limite da plataforma. O teto em US$ vale para a chave da plataforma; escritório com chave própria paga o próprio consumo, mas segue os limites de páginas.</p>
        <table className="w-full text-left text-xs"><thead><tr className="text-fg-muted"><th className="py-1">Escopo</th><th>Teto US$/mês</th><th>Páginas/dia</th><th>Páginas/mês</th><th /></tr></thead>
          <tbody>{d.budgets.map((b) => { const v = val(b); const set = (k: keyof typeof v, x: string) => setEdit({ ...edit, [key(b)]: { ...v, [k]: x } }); return (
            <tr key={key(b)} className="border-t border-line">
              <td className="py-1">{label(b)}</td>
              <td>{b.scope === "plataforma" ? <input aria-label={`Teto ${label(b)}`} className="field num min-h-8 w-24" disabled={!isSuper} value={v.monthlyUsd} onChange={(e) => set("monthlyUsd", e.target.value)} /> : "—"}</td>
              <td><input aria-label={`Páginas por dia ${label(b)}`} className="field num min-h-8 w-20" disabled={!isSuper} value={v.pagesDay} onChange={(e) => set("pagesDay", e.target.value)} /></td>
              <td><input aria-label={`Páginas por mês ${label(b)}`} className="field num min-h-8 w-24" disabled={!isSuper} value={v.pagesMonth} onChange={(e) => set("pagesMonth", e.target.value)} /></td>
              <td className="whitespace-nowrap">{isSuper && <><button className="btn btn-ghost min-h-8 px-2" onClick={() => post({ action: "budget", scope: b.scope, ref: b.ref, monthlyUsd: v.monthlyUsd === "" ? null : Number(v.monthlyUsd.replace(",", ".")), pagesDay: v.pagesDay === "" ? null : Number(v.pagesDay), pagesMonth: v.pagesMonth === "" ? null : Number(v.pagesMonth) }, "Limite salvo.")}>Salvar</button>{b.scope === "escritorio" && <button className="btn btn-ghost min-h-8 px-2" onClick={() => post({ action: "remove-budget", scope: b.scope, ref: b.ref }, "Exceção removida.")}>Remover</button>}</>}</td>
            </tr>); })}</tbody></table>
        {isSuper && <div className="mt-2 flex flex-wrap items-end gap-2"><label className="block"><span className="label">Exceção para escritório (id)</span><input className="field num w-80" value={newOffice} onChange={(e) => setNewOffice(e.target.value.trim())} placeholder="uuid do escritório" /></label><button className="btn btn-ghost" disabled={!/^[0-9a-f-]{36}$/.test(newOffice)} onClick={() => post({ action: "budget", scope: "escritorio", ref: newOffice, pagesDay: 0, pagesMonth: 0 }, "Exceção criada com 0 páginas; ajuste e salve.")}>Criar exceção</button></div>}
      </div>
      <div className="panel p-4 text-xs text-fg-muted"><p className="mb-1 font-medium text-fg">Preços oficiais usados no cálculo (por 1 milhão de tokens)</p><ul className="space-y-0.5">{d.prices.map((p) => <li key={p.model}>{p.model}: entrada US$ {Number(p.input_per_mtok).toFixed(2)} · saída US$ {Number(p.output_per_mtok).toFixed(2)} — conferido em {p.checked_on.split("-").reverse().join("/")} (<a className="text-accent underline" href={p.source_url} target="_blank" rel="noreferrer">tabela do Google</a>)</li>)}</ul></div>
    </section>
  );
}
