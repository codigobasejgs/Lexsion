"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BellRing, Info, ReceiptText, RotateCcw, Wallet } from "lucide-react";
import { Feedback, useAction } from "@/modules/shared";
import { financeOps } from "@/services/mock/ops-repo";
import { buildSchedule } from "@/domain/commercial";
import { addDays } from "@/lib/dates";
import { Guard } from "@/components/guard";
import { FinanceNav } from "./subnav";
import { useCollection, useInvalidate, useSession } from "@/components/providers";
import { Badge, Dialog, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui";
import { useDirtyGuard } from "@/components/pwa";
import { financeService } from "@/services/mock/repo";
import { formatBRL, parseBRL } from "@/lib/money";
import { diffDays, formatCivil, parseCivilBR } from "@/lib/dates";
import { DEMO_TODAY } from "@/mocks/clock";
import type { Installment, Payment } from "@/domain/types";

const VIEWS = [
  { key: "abertas", label: "Em aberto" },
  { key: "vencidas", label: "Vencidas" },
  { key: "semana", label: "Próximos 7 dias" },
  { key: "mes", label: "Próximos 30 dias" },
  { key: "pagas", label: "Pagas" },
  { key: "todas", label: "Todas" },
] as const;

const STATUS = { aberta: { label: "Em aberto", tone: "neutral" }, parcial: { label: "Parcial", tone: "warning" }, paga: { label: "Paga", tone: "success" }, cancelada: { label: "Cancelada", tone: "danger" } } as const;
const METHOD: Record<Payment["method"], string> = { pix: "Pix", boleto: "Boleto", cartao: "Cartão", dinheiro: "Dinheiro", transferencia: "Transferência" };

export function ReceivablesView({ overview }: { overview?: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = sp.get("visao") ?? "abertas";
  const clientFilter = sp.get("cliente");
  const insts = useCollection("installments");
  const pays = useCollection("payments");
  const clients = useCollection("clients");
  const [paying, setPaying] = useState<Installment | null>(null);
  const [detailId, setDetailId] = useState<string | null>(sp.get("parcela"));
  const detail = insts.data?.find((i) => i.id === detailId) ?? null;
  const setDetail = (i: Installment | null) => setDetailId(i?.id ?? null);

  const clientName = (id: string) => clients.data?.find((c) => c.id === id)?.name ?? "";

  const rows = useMemo(() => {
    return (insts.data ?? [])
      .filter((i) => !clientFilter || i.clientId === clientFilter)
      .filter((i) => {
        const n = diffDays(DEMO_TODAY, i.due);
        const open = i.status === "aberta" || i.status === "parcial";
        switch (view) {
          case "vencidas": return open && n < 0;
          case "semana": return open && n >= 0 && n <= 7;
          case "mes": return open && n >= 0 && n <= 30;
          case "pagas": return i.status === "paga";
          case "todas": return true;
          default: return open;
        }
      })
      .sort((a, b) => a.due.localeCompare(b.due));
  }, [insts.data, view, clientFilter]);

  // Saldos com definição explícita (mesmos registros da tabela).
  const all = (insts.data ?? []).filter((i) => i.status !== "cancelada");
  const contracted = all.reduce((s, i) => s + i.amount, 0);
  const received = (pays.data ?? []).reduce((s, p) => s + p.amount, 0);
  const overdue = all.filter((i) => diffDays(DEMO_TODAY, i.due) < 0).reduce((s, i) => s + (i.amount - i.paid), 0);
  const next30 = all.filter((i) => { const n = diffDays(DEMO_TODAY, i.due); return n >= 0 && n <= 30; }).reduce((s, i) => s + (i.amount - i.paid), 0);

  const setView = (k: string) => {
    const p = new URLSearchParams(sp);
    p.set("visao", k);
    router.replace(`${pathname}?${p}`, { scroll: false });
  };

  return (
    <Guard area="financeiro">
      <div className="mx-auto max-w-[1300px]">
        <PageHeader title={overview ? "Financeiro" : "A receber"} description="Parcelas de honorários, recebimentos e saldos. Recibo não equivale a nota fiscal. Proposta pendente não entra no realizado." />
        <FinanceNav />

        <section aria-label="Resumo" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Contratado", value: contracted, def: "Soma das parcelas não canceladas." },
            { label: "Recebido", value: received, def: "Pagamentos registrados menos estornos, pela data efetiva." },
            { label: "Vencido", value: overdue, def: `Saldo de parcelas com vencimento antes de ${formatCivil(DEMO_TODAY)}.`, tone: overdue > 0 ? "text-danger" : "" },
            { label: "A receber em 30 dias", value: next30, def: "Saldo com vencimento nos próximos 30 dias." },
          ].map((k) => (
            <div key={k.label} className="panel p-4">
              <p className="flex items-center gap-1 text-sm text-fg-muted">{k.label}<span title={k.def}><Info aria-hidden className="size-3.5" /></span></p>
              <p className={`num mt-1 text-xl font-semibold sm:text-2xl ${k.tone ?? ""}`}>{formatBRL(k.value)}</p>
              <p className="mt-1 text-xs text-fg-muted">{k.def}</p>
            </div>
          ))}
        </section>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Visão" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {VIEWS.map((v) => (
              <button key={v.key} onClick={() => setView(v.key)} aria-pressed={view === v.key} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${view === v.key ? "border-brand bg-selection text-fg" : "border-line text-fg-muted hover:text-fg"}`}>{v.label}</button>
            ))}
          </div>
          {clientFilter && (
            <button className="rounded-full border border-brand/50 px-3 py-1.5 text-sm" onClick={() => { const p = new URLSearchParams(sp); p.delete("cliente"); router.replace(`${pathname}?${p}`); }}>
              Cliente: {clientName(clientFilter)} ✕ <span className="sr-only">Limpar filtro de cliente</span>
            </button>
          )}
        </div>

        {insts.isError ? <ErrorBlock message="Não foi possível carregar o financeiro local." retry={() => insts.refetch()} /> : insts.isPending ? <LoadingBlock /> : rows.length === 0 ? (
          <EmptyState title="Nenhuma parcela nesta visão" text="Troque a visão para ver outros lançamentos." />
        ) : (
          <>
            <div className="panel hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Parcelas</caption>
                <thead className="border-b border-line bg-surface-muted text-left text-xs uppercase tracking-wider text-fg-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Cliente / parcela</th>
                    <th scope="col" className="px-4 py-3 font-medium">Vencimento</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Valor</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Pago</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Saldo</th>
                    <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((i) => {
                    const n = diffDays(DEMO_TODAY, i.due);
                    const late = n < 0 && i.status !== "paga";
                    return (
                      <tr key={i.id} className="hover:bg-surface-muted/50">
                        <td className="px-4 py-3"><button className="text-left hover:underline" onClick={() => setDetail(i)}><span className="block font-medium">{clientName(i.clientId)}</span><span className="text-fg-muted">{i.label}</span></button></td>
                        <td className={`num px-4 py-3 ${late ? "text-danger" : ""}`}>{formatCivil(i.due)}{late && <span className="block text-xs">Vencida há {-n} dia(s)</span>}</td>
                        <td className="num px-4 py-3 text-right">{formatBRL(i.amount)}</td>
                        <td className="num px-4 py-3 text-right text-fg-muted">{formatBRL(i.paid)}</td>
                        <td className="num px-4 py-3 text-right font-semibold">{formatBRL(i.amount - i.paid)}</td>
                        <td className="px-4 py-3"><Badge tone={late ? "danger" : STATUS[i.status].tone}>{late ? "Vencida" : STATUS[i.status].label}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          {i.status !== "paga" && i.status !== "cancelada" && <button className="btn btn-primary min-h-9" onClick={() => setPaying(i)} data-tour="registrar-pagamento">Registrar pagamento</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 md:hidden">
              {rows.map((i) => {
                const late = diffDays(DEMO_TODAY, i.due) < 0 && i.status !== "paga";
                return (
                  <li key={i.id} className="panel p-3">
                    <button className="flex w-full items-start gap-3 text-left" onClick={() => setDetail(i)}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium [overflow-wrap:anywhere]">{clientName(i.clientId)}</p>
                        <p className="text-sm text-fg-muted">{i.label} · <span className={`num ${late ? "text-danger" : ""}`}>vence {formatCivil(i.due)}</span></p>
                      </div>
                      <div className="text-right">
                        <p className="num font-semibold">{formatBRL(i.amount - i.paid)}</p>
                        <Badge tone={late ? "danger" : STATUS[i.status].tone}>{late ? "Vencida" : STATUS[i.status].label}</Badge>
                      </div>
                    </button>
                    {i.status !== "paga" && i.status !== "cancelada" && <button className="btn btn-primary mt-3 w-full" onClick={() => setPaying(i)} data-tour="registrar-pagamento">Registrar pagamento</button>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {paying && <PaymentDialog inst={paying} clientName={clientName(paying.clientId)} onClose={() => setPaying(null)} />}
      {detail && <DetailDialog inst={(insts.data ?? []).find((x) => x.id === detail.id) ?? detail} payments={(pays.data ?? []).filter((p) => p.installmentId === detail.id)} clientName={clientName(detail.clientId)} onClose={() => setDetail(null)} />}
    </Guard>
  );
}

function PaymentDialog({ inst, clientName, onClose }: { inst: Installment; clientName: string; onClose: () => void }) {
  const { ctx } = useSession();
  const invalidate = useInvalidate();
  const saldo = inst.amount - inst.paid;
  const [amount, setAmount] = useState(formatBRL(saldo).replace(/R\$\s?/, ""));
  const [date, setDate] = useState(formatCivil(DEMO_TODAY));
  const [method, setMethod] = useState<Payment["method"]>("pix");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const key = useRef(crypto.randomUUID()); // mesma chave em duplo clique/reenvio ⇒ sem duplicar caixa
  useDirtyGuard(`pay-${inst.id}`, note.length > 0);

  const cents = parseBRL(amount);
  const after = cents !== null ? saldo - cents : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (cents === null || cents <= 0) errs.amount = "Informe um valor válido, por exemplo 150,00.";
    else if (cents > saldo) errs.amount = `O valor é maior que o saldo (${formatBRL(saldo)}).`;
    const civil = parseCivilBR(date);
    if (!civil) errs.date = "Use o formato dd/mm/aaaa.";
    if (!note.trim()) errs.note = "Informe a origem ou justificativa da baixa manual.";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    if (!ctx) return;
    setSubmitting(true);
    const r = await financeService.registerPayment({ installmentId: inst.id, amount: cents!, date: civil!, method, source: "manual", note: note.trim(), idempotencyKey: key.current }, ctx);
    setSubmitting(false);
    if (!r.ok) {
      setErrors({ amount: r.error.message });
      return;
    }
    await invalidate("installments", "payments", "audit");
    onClose();
  };

  const err = (k: string) => errors[k] && <p id={`e-${k}`} className="mt-1 text-sm text-danger">{errors[k]}</p>;

  return (
    <Dialog open onClose={onClose} title="Registrar pagamento">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="rounded-[var(--radius-control)] bg-surface-muted p-3 text-sm">
          <p className="font-medium">{clientName} — {inst.label}</p>
          <p className="num text-fg-muted">Vencimento {formatCivil(inst.due)} · Saldo atual <strong className="text-fg">{formatBRL(saldo)}</strong></p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="f-amount">Valor recebido (R$)</label>
            <input id="f-amount" className="field num" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? "e-amount" : "h-amount"} />
            <p id="h-amount" className="mt-1 text-xs text-fg-muted">Ex.: 150,00. Pode ser parcial.</p>
            {err("amount")}
          </div>
          <div>
            <label className="label" htmlFor="f-date">Data do pagamento</label>
            <input id="f-date" className="field num" inputMode="numeric" placeholder="dd/mm/aaaa" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date ? "e-date" : undefined} />
            {err("date")}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="f-method">Forma</label>
          <select id="f-method" className="field" value={method} onChange={(e) => setMethod(e.target.value as Payment["method"])}>
            {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-note">Origem / justificativa</label>
          <textarea id="f-note" rows={2} className="field py-2" value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={!!errors.note} aria-describedby={errors.note ? "e-note" : "h-note"} />
          <p id="h-note" className="mt-1 text-xs text-fg-muted">Baixa manual, diferente de confirmação por provedor de pagamento.</p>
          {err("note")}
        </div>
        <div aria-live="polite" className="rounded-[var(--radius-control)] border border-line p-3 text-sm">
          <p className="text-fg-muted">Prévia</p>
          <p className="num">Novo saldo: <strong>{after !== null && after >= 0 ? formatBRL(after) : "—"}</strong> · Situação: <strong>{after === 0 ? "Paga" : after !== null && after > 0 && after < saldo ? "Parcial" : "—"}</strong></p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={submitting}>{submitting ? "Registrando…" : "Confirmar baixa"}</button>
        </div>
      </form>
    </Dialog>
  );
}

function DetailDialog({ inst, payments, clientName, onClose }: { inst: Installment; payments: Payment[]; clientName: string; onClose: () => void }) {
  const { ctx } = useSession();
  const invalidate = useInvalidate();
  const [reversing, setReversing] = useState<Payment | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirmReversal = async () => {
    if (!ctx || !reversing) return;
    const r = await financeService.reverse(reversing.id, note, ctx);
    if (!r.ok) {
      setError(r.error.message);
      return;
    }
    setReversing(null);
    setNote("");
    await invalidate("installments", "payments", "audit");
  };

  return (
    <Dialog open onClose={onClose} title={`${inst.label} — ${clientName}`} wide>
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-fg-muted">Valor</dt><dd className="num font-semibold">{formatBRL(inst.amount)}</dd></div>
        <div><dt className="text-fg-muted">Pago</dt><dd className="num font-semibold">{formatBRL(inst.paid)}</dd></div>
        <div><dt className="text-fg-muted">Saldo</dt><dd className="num font-semibold">{formatBRL(inst.amount - inst.paid)}</dd></div>
        <div><dt className="text-fg-muted">Vencimento</dt><dd className="num font-semibold">{formatCivil(inst.due)}</dd></div>
      </dl>
      <h3 className="mb-2 font-medium">Pagamentos e estornos</h3>
      {payments.length === 0 ? <p className="text-sm text-fg-muted">Nenhum pagamento registrado.</p> : (
        <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
          {payments.map((p) => {
            const reversed = payments.some((x) => x.reversalOf === p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                {p.amount < 0 ? <RotateCcw aria-hidden className="size-4 text-danger" /> : <Wallet aria-hidden className="size-4 text-success" />}
                <span className="num">{formatCivil(p.date)}</span>
                <span className="min-w-0 flex-1 text-fg-muted">{p.amount < 0 ? "Estorno" : METHOD[p.method]} · {p.source === "manual" ? "baixa manual" : "provedor (simulado)"}{p.note ? ` · ${p.note}` : ""}</span>
                <span className={`num font-semibold ${p.amount < 0 ? "text-danger" : ""}`}>{formatBRL(p.amount)}</span>
                {p.amount > 0 && !reversed && <ReceiptButton paymentId={p.id} />}
                {p.amount > 0 && !reversed && <button className="btn btn-danger min-h-9" onClick={() => { setReversing(p); setError(null); }}>Estornar</button>}
                {reversed && <Badge tone="neutral">Estornado</Badge>}
              </li>
            );
          })}
        </ul>
      )}
      {reversing && (
        <div role="alertdialog" aria-labelledby="rev-title" className="mt-4 rounded-[var(--radius-control)] border border-danger/40 bg-danger-bg p-4">
          <p id="rev-title" className="font-medium text-danger">Estornar {formatBRL(reversing.amount)} de {formatCivil(reversing.date)}?</p>
          <p className="mt-1 text-sm">Será criado um lançamento reverso auditável. O pagamento original não é apagado e o saldo da parcela volta a aumentar.</p>
          <label className="label mt-3" htmlFor="rev-note">Motivo do estorno</label>
          <input id="rev-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button className="btn btn-ghost" onClick={() => setReversing(null)}>Manter pagamento</button>
            <button className="btn btn-danger" onClick={confirmReversal}>Confirmar estorno</button>
          </div>
        </div>
      )}
      {(inst.status === "aberta" || inst.status === "parcial") && <InstallmentActions inst={inst} onDone={onClose} />}
      {inst.renegotiatedFrom && <p className="mt-3 text-sm text-fg-muted">Parcela de acordo: substitui {inst.renegotiatedFrom.length} parcela(s) anterior(es), preservadas no histórico.</p>}
      {inst.replacedBy && <p className="mt-3 text-sm text-fg-muted">Renegociada: {inst.note}</p>}
    </Dialog>
  );
}

function ReceiptButton({ paymentId }: { paymentId: string }) {
  const act = useAction("receipts");
  const router = useRouter();
  return (
    <button className="btn btn-secondary min-h-9" onClick={async () => { const r = await act.run((ctx) => financeOps.issueReceipt(paymentId, "Salvador/BA", ctx)); if (r) router.push(`/app/financeiro/recibos?id=${r.id}`); }} title={act.error ?? undefined}>
      <ReceiptText aria-hidden className="size-4" /> Recibo
    </button>
  );
}

/** Lembrete simulado e renegociação (saldo migra para novas parcelas; antigas preservadas). */
function InstallmentActions({ inst, onDone }: { inst: Installment; onDone: () => void }) {
  const act = useAction("installments");
  const [reneg, setReneg] = useState(false);
  const balance = inst.amount - inst.paid;
  const [n, setN] = useState("2");
  const [first, setFirst] = useState(addDays(DEMO_TODAY, 10));
  const [note, setNote] = useState("");
  let schedule: { label: string; amount: number; due: string }[] = [];
  try {
    schedule = buildSchedule(balance, 0, Number(n), first, 30);
  } catch {}
  return (
    <section className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-secondary min-h-9" onClick={() => act.run((ctx) => financeOps.remind(inst.id, ctx), "Lembrete registrado (simulação — nenhuma mensagem enviada).")}><BellRing aria-hidden className="size-4" /> Lembrete (simulado)</button>
        <button className="btn btn-secondary min-h-9" onClick={() => setReneg((v) => !v)} aria-expanded={reneg}>Renegociar saldo</button>
      </div>
      {inst.lastReminderAt && <p className="text-fg-muted">Último lembrete: {formatCivil(inst.lastReminderAt.slice(0, 10))}</p>}
      {reneg && (
        <div className="space-y-2 rounded-[var(--radius-control)] border border-line p-3">
          <p>Saldo a renegociar: <strong className="num">{formatBRL(balance)}</strong></p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="label text-xs">Novas parcelas</span><input className="field num" value={n} onChange={(e) => setN(e.target.value)} /></label>
            <label className="block"><span className="label text-xs">Primeiro vencimento</span><input type="date" className="field" value={first} onChange={(e) => setFirst(e.target.value)} /></label>
          </div>
          <label className="block"><span className="label text-xs">Descrição do acordo</span><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <ul className="num text-xs text-fg-muted">{schedule.map((s) => <li key={s.label}>{s.label} · {formatCivil(s.due)} · {formatBRL(s.amount)}</li>)}</ul>
          <button className="btn btn-primary min-h-9" disabled={!schedule.length || act.pending} onClick={async () => { if (await act.run((ctx) => financeOps.renegotiate([inst.id], schedule, note, ctx), "Acordo registrado.")) onDone(); }}>Confirmar renegociação</button>
        </div>
      )}
      <Feedback error={act.error} notice={act.notice} />
    </section>
  );
}
