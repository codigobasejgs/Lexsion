"use client";

import { Download, Printer, Share2 } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { useUrlState } from "@/modules/shared";
import { FinanceNav } from "@/modules/finance/subnav";
import { brlInWords } from "@/domain/commercial";
import { formatBRL } from "@/lib/money";
import { formatCivil, formatCivilLong } from "@/lib/dates";
import type { Receipt } from "@/domain/types";

function receiptText(r: Receipt) {
  return `RECIBO Nº ${String(r.number).padStart(4, "0")} — DEMONSTRATIVO\n\nRecebi(emos) de ${r.payer} (${r.payerDoc}) a importância de ${formatBRL(r.amount)} (${brlInWords(r.amount)}), referente a ${r.reference}.\n\n${r.place}, ${formatCivilLong(r.date)}.\n\n${r.beneficiary}\n\nRecibo não equivale a nota fiscal. Documento gerado em ambiente demonstrativo.`;
}

export default function RecibosPage() {
  const url = useUrlState();
  const receipts = useCollection("receipts");
  const sel = receipts.data?.find((r) => r.id === url.get("id")) ?? receipts.data?.at(-1);

  const share = async (r: Receipt) => {
    const file = new File([receiptText(r)], `recibo-${r.number}.txt`, { type: "text/plain" });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Recibo ${r.number}` }).catch(() => {});
    else await navigator.clipboard?.writeText(receiptText(r)).catch(() => {});
  };

  return (
    <Guard area="financeiro">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Recibos" description="Emitidos a partir de pagamentos registrados (botão “Recibo” no detalhe da parcela). Recibo não é nota fiscal." />
        <FinanceNav />
        {receipts.isPending ? <LoadingBlock /> : !receipts.data?.length ? <EmptyState title="Nenhum recibo" text="Abra uma parcela paga em Financeiro e use “Recibo”." /> : (
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <ul className="panel no-print divide-y divide-line self-start">
              {receipts.data.map((r) => <li key={r.id}><button onClick={() => url.set("id", r.id)} aria-current={sel?.id === r.id} className={`flex w-full justify-between gap-2 p-3 text-left text-sm ${sel?.id === r.id ? "bg-selection" : ""}`}><span>Nº {String(r.number).padStart(4, "0")} · {r.payer}</span><span className="num">{formatBRL(r.amount)}</span></button></li>)}
            </ul>
            {sel && (
              <article className="rounded-[var(--radius-panel)] bg-white p-8 font-serif text-[#111]" aria-label="Recibo">
                <p className="text-xs uppercase tracking-widest text-[#765414]">Ambiente demonstrativo</p>
                <h2 className="mt-2 text-2xl">Recibo nº {String(sel.number).padStart(4, "0")}</h2>
                <p className="num mt-1 text-xl">{formatBRL(sel.amount)}</p>
                <p className="mt-6 leading-relaxed">Recebi(emos) de <strong>{sel.payer}</strong> ({sel.payerDoc}) a importância de <strong>{formatBRL(sel.amount)}</strong> ({brlInWords(sel.amount)}), referente a {sel.reference}.</p>
                <p className="mt-6">{sel.place}, {formatCivilLong(sel.date)}.</p>
                <p className="mt-10 border-t border-[#999] pt-2 text-center">{sel.beneficiary}</p>
                <p className="mt-6 text-xs text-[#555]">Recibo não equivale a nota fiscal. Emitido em {formatCivil(sel.createdAt.slice(0, 10))}.</p>
                <div className="no-print mt-6 flex flex-wrap gap-2 font-sans">
                  <button className="btn border border-[#b7a684] bg-white text-[#211a10]" onClick={() => window.print()}><Printer aria-hidden className="size-4" /> Imprimir / PDF</button>
                  <a className="btn border border-[#b7a684] bg-white text-[#211a10]" href={`data:text/plain;charset=utf-8,${encodeURIComponent(receiptText(sel))}`} download={`recibo-${sel.number}.txt`}><Download aria-hidden className="size-4" /> Baixar</a>
                  <button className="btn border border-[#b7a684] bg-white text-[#211a10]" onClick={() => share(sel)}><Share2 aria-hidden className="size-4" /> Compartilhar</button>
                </div>
              </article>
            )}
          </div>
        )}
      </div>
    </Guard>
  );
}
