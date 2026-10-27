"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, Dialog, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { FinanceNav } from "@/modules/finance/subnav";
import { financeOps } from "@/services/mock/ops-repo";
import { formatBRL } from "@/lib/money";
import { formatCivil } from "@/lib/dates";
import type { BankLine } from "@/domain/types";

export default function ConciliacaoPage() {
  const lines = useCollection("bankLines");
  const pays = useCollection("payments");
  const insts = useCollection("installments");
  const [open, setOpen] = useState<BankLine | null>(null);

  // Diagnóstico automático (sugestão; decisão é humana).
  const diagnose = (l: BankLine): string[] => {
    const out: string[] = [];
    const sameDay = (lines.data ?? []).filter((x) => x.id !== l.id && x.date === l.date && x.amount === l.amount);
    if (sameDay.length) out.push("Possível duplicidade: outro lançamento igual no mesmo dia");
    if (l.fee) out.push(`Tarifa de ${formatBRL(l.fee)} descontada pelo banco`);
    const exact = (pays.data ?? []).find((p) => p.amount === l.amount + (l.fee ?? 0) && p.date === l.date);
    if (exact) out.push("Há pagamento registrado com mesmo valor e data");
    else if (!(insts.data ?? []).some((i) => i.amount - i.paid >= l.amount)) out.push("Nenhuma parcela em aberto comporta este valor");
    if (/DESCONHECIDO/.test(l.description)) out.push("Remetente sem vínculo identificado");
    return out;
  };

  return (
    <Guard area="financeiro">
      <div className="mx-auto max-w-[1200px]">
        <PageHeader title="Conciliação" description="Extrato bancário de exemplo × pagamentos registrados. Concluir exige decisão explícita e justificativa." />
        <FinanceNav />
        {lines.isPending ? <LoadingBlock /> : !lines.data?.length ? <EmptyState title="Sem extrato" text="Importe um extrato (fase futura)." /> : (
          <ul className="space-y-2" data-tour="extrato">
            {lines.data.map((l) => {
              const d = diagnose(l);
              return (
                <li key={l.id} className="panel flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="num w-24">{formatCivil(l.date)}</span>
                  <span className="min-w-0 flex-1"><span className="block font-mono text-xs">{l.description}</span>{l.status === "pendente" && d.map((x) => <span key={x} className="mr-2 inline-flex items-center gap-1 text-xs text-warning"><AlertTriangle aria-hidden className="size-3" />{x}</span>)}{l.decisionNote && <span className="block text-xs text-fg-muted">Decisão: {l.decisionNote}</span>}</span>
                  <span className="num font-semibold">{formatBRL(l.amount)}</span>
                  <Badge tone={l.status === "conciliado" ? "success" : l.status === "ignorado" ? "neutral" : "warning"}>{l.status === "conciliado" ? "Conciliado" : l.status === "ignorado" ? "Ignorado" : "Pendente"}</Badge>
                  {l.status === "pendente" && <button className="btn btn-secondary min-h-9" onClick={() => setOpen(l)}>Decidir</button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {open && <Decide l={open} onClose={() => setOpen(null)} />}
    </Guard>
  );
}

function Decide({ l, onClose }: { l: BankLine; onClose: () => void }) {
  const pays = useCollection("payments");
  const insts = useCollection("installments");
  const clients = useCollection("clients");
  const act = useAction("bankLines", "payments", "installments");
  const [kind, setKind] = useState<"vincular" | "registrar" | "ignorar">("vincular");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const candidates = (pays.data ?? []).filter((p) => p.amount > 0);
  const open = (insts.data ?? []).filter((i) => i.status === "aberta" || i.status === "parcial");
  const cn = (id?: string) => clients.data?.find((c) => c.id === id)?.name ?? "";
  return (
    <Dialog open onClose={onClose} title={`Conciliar ${formatBRL(l.amount)} de ${formatCivil(l.date)}`} wide>
      <div className="space-y-3 text-sm">
        <fieldset className="space-y-1"><legend className="label">Decisão</legend>
          {([["vincular", "Vincular a pagamento já registrado"], ["registrar", "Registrar pagamento numa parcela (tarifa tratada como despesa)"], ["ignorar", "Ignorar (não é honorário: ex. repasse, duplicidade)"]] as const).map(([k, l2]) => <label key={k} className="flex items-center gap-2"><input type="radio" name="dec" checked={kind === k} onChange={() => { setKind(k); setTarget(""); }} className="size-4 accent-[var(--brand)]" /> {l2}</label>)}
        </fieldset>
        {kind === "vincular" && <label className="block"><span className="label">Pagamento</span><select className="field" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Escolha…</option>{candidates.map((p) => { const i = insts.data?.find((x) => x.id === p.installmentId); return <option key={p.id} value={p.id}>{formatCivil(p.date)} · {formatBRL(p.amount)} · {i?.label} · {cn(i?.clientId)}</option>; })}</select></label>}
        {kind === "registrar" && <label className="block"><span className="label">Parcela</span><select className="field" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Escolha…</option>{open.map((i) => <option key={i.id} value={i.id}>{i.label} · {cn(i.clientId)} · saldo {formatBRL(i.amount - i.paid)}</option>)}</select></label>}
        <label className="block"><span className="label">Justificativa</span><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <Feedback error={act.error} />
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={(kind !== "ignorar" && !target) || !note.trim() || act.pending} onClick={async () => {
            const decision = kind === "vincular" ? { kind, paymentId: target } as const : kind === "registrar" ? { kind, installmentId: target } as const : { kind } as const;
            if (await act.run((ctx) => financeOps.reconcile(l.id, decision, note, ctx))) onClose();
          }}>Concluir conciliação</button>
        </div>
      </div>
    </Dialog>
  );
}
