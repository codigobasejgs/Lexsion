"use client";

import { useState } from "react";
import { useCollection } from "@/components/providers";
import { useDirtyGuard } from "@/components/pwa";
import { Feedback, useAction } from "@/modules/shared";
import { commercialService } from "@/services/mock/ops-repo";
import { buildSchedule, scheduleTotal, type ScheduleItem } from "@/domain/commercial";
import { formatBRL, parseBRL } from "@/lib/money";
import { DEMO_TODAY } from "@/mocks/clock";
import { addDays } from "@/lib/dates";
import { FEE_KIND } from "./labels";
import type { FeeKind, Proposal } from "@/domain/types";

/** Proposta com entrada + parcelas de datas próprias (editáveis individualmente). Soma conferida antes de salvar. */
export function ProposalForm({ p, onSaved }: { p?: Proposal; onSaved: (p: Proposal) => void }) {
  const leads = useCollection("leads");
  const clients = useCollection("clients");
  const act = useAction("proposals");
  const [f, setF] = useState({
    title: p?.title ?? "", service: p?.service ?? "", scope: p?.scope ?? "", feeKind: (p?.feeKind ?? "parcelado") as FeeKind,
    total: p ? formatBRL(p.total).replace(/R\$\s?/, "") : "", successPercent: String(p?.successPercent ?? ""), successBase: p?.successBase ?? "",
    validUntil: p?.validUntil ?? addDays(DEMO_TODAY, 10), leadId: p?.leadId ?? "", clientId: p?.clientId ?? "",
    down: "", n: "3", every: "30",
  });
  const [schedule, setSchedule] = useState<ScheduleItem[]>(p?.schedule ?? []);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useDirtyGuard("proposal", dirty);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  const total = parseBRL(f.total);
  const sum = scheduleTotal(schedule);
  const onlySuccess = f.feeKind === "exito";

  const generate = () => {
    setErr(null);
    if (total === null) return setErr("Informe o total.");
    try {
      setSchedule(buildSchedule(total, parseBRL(f.down || "0") ?? 0, Number(f.n), addDays(DEMO_TODAY, 5), Number(f.every)));
      setDirty(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const save = async () => {
    setErr(null);
    if (!onlySuccess && (total === null || total <= 0)) return setErr("Informe o total.");
    const r = await act.run((ctx) => commercialService.saveProposal({
      id: p?.id, title: f.title.trim(), service: f.service.trim(), scope: f.scope.trim(), feeKind: f.feeKind, total: onlySuccess ? 0 : total!,
      successPercent: f.successPercent ? Number(f.successPercent) : undefined, successBase: f.successBase || undefined,
      schedule: onlySuccess ? [] : schedule, validUntil: f.validUntil, leadId: f.leadId || undefined, clientId: f.clientId || undefined,
    }, ctx));
    if (r) { setDirty(false); onSaved(r); }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Título</span><input className="field" value={f.title} onChange={set("title")} /></label>
        <label className="block"><span className="label">Serviço</span><input className="field" value={f.service} onChange={set("service")} /></label>
        <label className="block sm:col-span-2"><span className="label">Escopo</span><textarea rows={2} className="field py-2" value={f.scope} onChange={set("scope")} /></label>
        <label className="block"><span className="label">Lead (oportunidade)</span><select className="field" value={f.leadId} onChange={set("leadId")}><option value="">—</option>{leads.data?.filter((l) => l.stage !== "perdido").map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className="block"><span className="label">Cliente (se já convertido)</span><select className="field" value={f.clientId} onChange={set("clientId")}><option value="">—</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block"><span className="label">Tipo de honorários</span><select className="field" value={f.feeKind} onChange={set("feeKind")}>{Object.entries(FEE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="block"><span className="label">Validade</span><input type="date" className="field" value={f.validUntil} onChange={set("validUntil")} /></label>
        {!onlySuccess && <label className="block"><span className="label">Total (R$)</span><input className="field num" inputMode="decimal" value={f.total} onChange={set("total")} /></label>}
        {(f.feeKind === "exito" || f.feeKind === "combinado") && (
          <>
            <label className="block"><span className="label">Percentual de êxito (%)</span><input className="field num" inputMode="decimal" value={f.successPercent} onChange={set("successPercent")} /></label>
            <label className="block sm:col-span-2"><span className="label">Base de cálculo do êxito</span><input className="field" value={f.successBase} onChange={set("successBase")} placeholder="Ex.: valores atrasados efetivamente recebidos" /></label>
          </>
        )}
      </div>
      {!onlySuccess && (
        <section className="rounded-[var(--radius-control)] border border-line p-3">
          <h3 className="mb-2 font-medium">Cronograma (entrada + parcelas)</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <label className="block"><span className="label text-xs">Entrada (R$)</span><input className="field num" value={f.down} onChange={set("down")} /></label>
            <label className="block"><span className="label text-xs">Parcelas</span><input className="field num" value={f.n} onChange={set("n")} /></label>
            <label className="block"><span className="label text-xs">A cada (dias)</span><input className="field num" value={f.every} onChange={set("every")} /></label>
            <button type="button" className="btn btn-secondary self-end" onClick={generate}>Gerar</button>
          </div>
          {schedule.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {schedule.map((s, i) => (
                <li key={i} className="grid grid-cols-2 items-center gap-2 text-sm sm:grid-cols-[1fr_9rem_8rem]">
                  {/* Celular (360px): rótulo na linha de cima, data e valor lado a lado; 17rem fixos estouravam a tela e cobriam o botão. */}
                  <span className="col-span-2 sm:col-span-1">{s.label}</span>
                  <input type="date" aria-label={`Vencimento ${s.label}`} className="field min-h-9" value={s.due} onChange={(e) => { setSchedule(schedule.map((x, j) => (j === i ? { ...x, due: e.target.value } : x))); setDirty(true); }} />
                  <input aria-label={`Valor ${s.label}`} className="field num min-h-9 text-right" defaultValue={formatBRL(s.amount).replace(/R\$\s?/, "")} onBlur={(e) => { const v = parseBRL(e.target.value); if (v !== null) { setSchedule(schedule.map((x, j) => (j === i ? { ...x, amount: v } : x))); setDirty(true); } }} />
                </li>
              ))}
            </ul>
          )}
          <p className={`num mt-2 text-sm ${total !== null && sum !== total ? "text-danger" : "text-fg-muted"}`}>Soma: {formatBRL(sum)} {total !== null && sum !== total ? `≠ total ${formatBRL(total)}` : "✓"}</p>
        </section>
      )}
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <Feedback error={act.error} />
      <button className="btn btn-primary" disabled={act.pending || f.title.trim().length < 3} onClick={save}>{p ? "Salvar nova versão" : "Criar proposta"}</button>
    </div>
  );
}
