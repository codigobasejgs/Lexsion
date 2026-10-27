"use client";

import Link from "next/link";
import { use } from "react";
import { Download } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock, PageHeader } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { readAll, writeMany } from "@/services/mock/db";
import { auditRow, fail, ok } from "@/services/mock/generic";
import { downloadText, toCsv } from "@/domain/csv";
import { formatInstant } from "@/lib/dates";

export default function LotePage({ params }: PageProps<"/app/importacoes/[id]">) {
  const { id } = use(params);
  const batches = useCollection("importBatches");
  const act = useAction("clients", "importBatches");
  const b = batches.data?.find((x) => x.id === id);
  if (batches.isPending) return <LoadingBlock />;
  if (!b) return <EmptyState title="Lote não encontrado" text="" action={<Link className="btn btn-secondary" href="/app/importacoes">Voltar</Link>} />;

  /** Reverte só se nenhum cliente criado no lote ganhou caso, documento, parcela ou lead depois. */
  const revert = () => act.run(async (ctx) => {
    const [clients, cases, docs, insts, leads, bs, audit] = await Promise.all([readAll("clients"), readAll("cases"), readAll("documents"), readAll("installments"), readAll("leads"), readAll("importBatches"), readAll("audit")]);
    const ids = new Set(b.created);
    const deps = [...cases, ...docs, ...insts].filter((x) => ids.has(x.clientId)).length + leads.filter((l) => l.clientId && ids.has(l.clientId)).length;
    if (deps) return fail("deps", `Reversão automática bloqueada: ${deps} registro(s) posteriores dependem dos clientes importados. Plano: arquive os clientes manualmente ou remova antes os vínculos.`);
    await writeMany({ clients: clients.filter((c) => !ids.has(c.id)), importBatches: bs.map((x) => (x.id === b.id ? { ...x, status: "revertido" as const } : x)), audit: [...audit, auditRow(ctx, "import.reverted", "ImportBatch", b.id, `${ids.size} clientes removidos`)] });
    return ok(true);
  }, "Lote revertido. Atualizações em clientes existentes (campos vazios preenchidos) foram mantidas.");

  return (
    <Guard area="importacoes">
      <div className="mx-auto max-w-[900px]">
        <PageHeader breadcrumb={[{ href: "/app/importacoes", label: "Importações" }]} title={`Lote ${b.fileName}`} description={`${b.source} · ${formatInstant(b.at)} · ${userName(b.actorId)}`} actions={<Badge tone={b.status === "revertido" ? "neutral" : "success"}>{b.status}</Badge>} />
        <section className="panel grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
          {[["Criados", b.created.length], ["Atualizados", b.updated.length], ["Ignorados", b.skipped], ["Rejeitados", b.rejected.length]].map(([k, v]) => <div key={String(k)}><p className="text-fg-muted">{k}</p><p className="num text-xl font-semibold">{v}</p></div>)}
        </section>
        <section className="panel mt-4 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Erros por linha</h2>
          {b.rejected.length ? <ul className="space-y-1">{b.rejected.map((r) => <li key={r.row}>Linha {r.row}: {r.reason}</li>)}</ul> : <p className="text-fg-muted">Nenhuma linha rejeitada.</p>}
          <button className="btn btn-ghost mt-2" onClick={() => downloadText(`erros-${b.id}.csv`, toCsv(["Linha", "Motivo"], b.rejected.map((r) => [r.row, r.reason])), "text/csv;charset=utf-8")}><Download aria-hidden className="size-4" /> Baixar relatório</button>
          <p className="mt-2 text-xs text-fg-muted">Rastreabilidade: cada cliente criado guarda arquivo, linha e lote na origem.</p>
        </section>
        <Feedback error={act.error} notice={act.notice} />
        {b.status === "concluido" && <button className="btn btn-danger mt-4" onClick={revert}>Reverter lote</button>}
      </div>
    </Guard>
  );
}
