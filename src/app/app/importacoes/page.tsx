"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { Guard } from "@/components/guard";
import { useCollection, useSession } from "@/components/providers";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { Feedback, useAction } from "@/modules/shared";
import { buildPreview, guessMapping, SAMPLE_CSV, TARGET_FIELDS, type TargetField } from "@/domain/importer";
import { downloadText, parseCsv } from "@/domain/csv";
import { readAll, writeMany } from "@/services/mock/db";
import { auditRow, cid, ok } from "@/services/mock/generic";
import { formatInstant } from "@/lib/dates";
import type { Client, ImportBatch } from "@/domain/types";

const STEPS = ["Fonte", "Arquivo", "Mapear colunas", "Validar e prévia", "Confirmar", "Resultado"];

export default function ImportacoesPage() {
  const router = useRouter();
  const { org } = useSession();
  const clients = useCollection("clients");
  const batches = useCollection("importBatches");
  const act = useAction("clients", "importBatches");
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<ImportBatch["source"]>("CSV");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetField | "">>({});
  const [err, setErr] = useState<string | null>(null);
  const preview = useMemo(() => (rows.length ? buildPreview(rows, mapping, (clients.data ?? []).filter((c) => c.organizationId === org?.id)) : []), [rows, mapping, clients.data, org?.id]);
  const count = (a: string) => preview.filter((p) => p.action === a).length;

  const load = async (f?: File) => {
    setErr(null);
    if (!f) return;
    if (/\.(xlsb|xlsm|xls)$/i.test(f.name)) return setErr("Planilhas XLSB/XLSM não são lidas diretamente (macros nunca são executadas). Exporte a aba para CSV e envie o CSV.");
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") return setErr("Envie um arquivo .csv.");
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) return setErr("Arquivo sem linhas de dados.");
    setFileName(f.name);
    setRows(parsed);
    setMapping(guessMapping(parsed[0]));
    setStep(2);
  };

  const confirm = () => act.run(async (ctx) => {
    const [all, bs, audit] = await Promise.all([readAll("clients"), readAll("importBatches"), readAll("audit")]);
    const created: string[] = [];
    const updated: string[] = [];
    const batchId = `ib-${cid()}`;
    let next = [...all];
    for (const p of preview) {
      if (p.action === "criar") {
        const c: Client = { id: `c-imp-${cid()}`, organizationId: ctx.organizationId, kind: p.data.kind ?? "PF", name: p.data.name!, document: p.data.document ?? "", phone: p.data.phone ?? "", email: p.data.email, birthDate: p.data.birthDate, city: p.data.city ?? "", uf: p.data.uf ?? "BA", profession: p.data.profession, ownerId: ctx.actorId, origin: `Importação ${fileName} (linha ${p.row}, lote ${batchId})`, status: "ativo", createdAt: new Date().toISOString() };
        next.push(c);
        created.push(c.id);
      } else if (p.action === "atualizar" && p.matchId) {
        // Atualiza só campos vazios: não sobrescreve dado existente silenciosamente.
        next = next.map((c) => (c.id === p.matchId ? { ...c, email: c.email || p.data.email, birthDate: c.birthDate || p.data.birthDate, profession: c.profession || p.data.profession } : c));
        updated.push(p.matchId);
      }
    }
    const batch: ImportBatch = { id: batchId, organizationId: ctx.organizationId, source, fileName, at: new Date().toISOString(), actorId: ctx.actorId, mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v)) as Record<string, string>, created, updated, skipped: count("ignorar"), rejected: preview.filter((p) => p.action === "rejeitar").map((p) => ({ row: p.row, reason: p.reason ?? "" })), status: "concluido" };
    await writeMany({ clients: next, importBatches: [...bs, batch], audit: [...audit, auditRow(ctx, "import.completed", "ImportBatch", batchId, `${created.length} criados, ${updated.length} atualizados`)] });
    return ok(batch);
  });

  return (
    <Guard area="importacoes">
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="Importação e migração" description="CSV com prévia, deduplicação e erros por linha. Senhas, macros e telas de licença de planilhas nunca são migradas." />
        <ol className="mb-5 flex flex-wrap gap-1" aria-label="Etapas">{STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={`rounded-full border px-3 py-1 text-xs ${i === step ? "border-brand bg-selection font-semibold" : i < step ? "border-line" : "border-line text-fg-muted"}`}>{i + 1}. {s}</li>)}</ol>
        <Feedback error={err ?? act.error} />
        <section className="panel space-y-4 p-4 text-sm">
          {step === 0 && (
            <>
              <fieldset className="space-y-2"><legend className="label">Fonte</legend>
                {(["CSV", "Tícius (CSV exportado)"] as const).map((s) => <label key={s} className="flex items-center gap-2"><input type="radio" className="size-4 accent-[var(--brand)]" checked={source === s} onChange={() => setSource(s)} /> {s}</label>)}
              </fieldset>
              {source !== "CSV" && <p className="rounded border border-info/30 bg-info-bg p-3 text-info">Tícius: abra a planilha, exporte a aba <strong>Clientes</strong> como CSV e envie aqui. As colunas são reconhecidas automaticamente. Abas Senha/Configurações de senhas não são importadas. Parcelas e caixa: importação planejada (não serão lançadas como receita nova).</p>}
              <button className="btn btn-primary" onClick={() => setStep(1)}>Continuar</button>
            </>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <label className="btn btn-primary cursor-pointer"><Upload aria-hidden className="size-4" /> Escolher arquivo CSV<input type="file" accept=".csv,text/csv,.xlsb,.xlsm,.xls" className="sr-only" onChange={(e) => load(e.target.files?.[0])} /></label>
              <button className="btn btn-ghost" onClick={() => downloadText("modelo-clientes-ficticio.csv", "﻿" + SAMPLE_CSV, "text/csv;charset=utf-8")}><Download aria-hidden className="size-4" /> Baixar CSV fictício de exemplo</button>
              <button className="btn btn-secondary" onClick={() => { const p = parseCsv(SAMPLE_CSV); setFileName("exemplo-ficticio.csv"); setRows(p); setMapping(guessMapping(p[0])); setStep(2); }}>Usar exemplo fictício</button>
            </div>
          )}
          {step === 2 && (
            <>
              <p>Arquivo: <strong>{fileName}</strong> · {rows.length - 1} linha(s)</p>
              <div className="grid gap-2 sm:grid-cols-2">{rows[0].map((h) => (
                <label key={h} className="flex items-center gap-2"><span className="w-40 truncate font-mono text-xs">{h}</span><span aria-hidden>→</span>
                  <select className="field min-h-9" aria-label={`Campo para a coluna ${h}`} value={mapping[h] ?? ""} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as TargetField })}><option value="">Ignorar coluna</option>{Object.entries(TARGET_FIELDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </label>
              ))}</div>
              <button className="btn btn-primary" disabled={!Object.values(mapping).includes("name")} onClick={() => setStep(3)}>Validar</button>
            </>
          )}
          {step === 3 && (
            <>
              <div className="flex flex-wrap gap-2"><Badge tone="success">{count("criar")} a criar</Badge><Badge tone="info">{count("atualizar")} a atualizar</Badge><Badge tone="neutral">{count("ignorar")} ignoradas</Badge><Badge tone="danger">{count("rejeitar")} rejeitadas</Badge></div>
              <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Prévia da importação (role horizontalmente se necessário)"><table className="w-full text-xs"><caption className="sr-only">Prévia</caption>
                <thead className="text-left text-fg-muted"><tr><th className="py-1 pr-3">Linha</th><th className="pr-3">Ação</th><th className="pr-3">Nome</th><th className="pr-3">Documento</th><th>Problemas</th></tr></thead>
                <tbody>{preview.map((p) => <tr key={p.row} className="border-t border-line align-top"><td className="num py-1 pr-3">{p.row}</td><td className="pr-3">{p.action}{p.reason ? ` — ${p.reason}` : ""}</td><td className="pr-3 [overflow-wrap:anywhere]">{p.data.name ?? ""}</td><td className="num whitespace-nowrap pr-3">{p.data.document || "—"}</td><td className="text-warning">{p.issues.join("; ")}</td></tr>)}</tbody>
              </table></div>
              <p className="text-fg-muted">Texto que começa com “=”, “+”, “-” ou “@” é tratado como texto comum (nunca como fórmula).</p>
              <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setStep(2)}>Voltar</button><button className="btn btn-primary" disabled={!count("criar") && !count("atualizar")} onClick={() => setStep(4)}>Revisar conflitos e confirmar</button></div>
            </>
          )}
          {step === 4 && (
            <>
              <p>Serão <strong>criados {count("criar")}</strong> e <strong>atualizados {count("atualizar")}</strong> clientes (atualização só preenche campos vazios; nada é sobrescrito). Linhas rejeitadas ficam no relatório.</p>
              <div className="flex gap-2"><button className="btn btn-ghost" onClick={() => setStep(3)}>Voltar</button><button className="btn btn-primary" disabled={act.pending} onClick={async () => { const b = await confirm(); if (b) router.push(`/app/importacoes/${b.id}`); }}>Confirmar importação</button></div>
            </>
          )}
        </section>
        <h2 className="mb-2 mt-6 font-semibold">Lotes anteriores</h2>
        {!batches.data?.length ? <EmptyState title="Nenhum lote" text="" /> : (
          <ul className="panel divide-y divide-line">{batches.data.map((b) => <li key={b.id}><Link href={`/app/importacoes/${b.id}`} className="flex flex-wrap items-center gap-3 p-3 text-sm hover:bg-surface-muted/50"><span className="flex-1">{b.fileName} · {formatInstant(b.at)}</span><span className="num text-fg-muted">{b.created.length} criados · {b.updated.length} atualizados · {b.rejected.length} rejeitados</span><Badge tone={b.status === "revertido" ? "neutral" : "success"}>{b.status}</Badge></Link></li>)}</ul>
        )}
      </div>
    </Guard>
  );
}
