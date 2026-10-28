"use client";

import { useState } from "react";
import { BookCheck, ExternalLink } from "lucide-react";
import { useCollection } from "@/components/providers";
import { Badge } from "@/components/ui";
import { Feedback, useAction, userName } from "@/modules/shared";
import { createRow, nowIso, updateRow } from "@/services/mock/generic";
import { checkCitations, SOURCE_STATUS_LABEL, type LegalSource, type SourceStatus } from "@/domain/citations";

const TONE: Record<SourceStatus, "success" | "warning" | "danger" | "neutral"> = { VERIFICADO: "success", NAO_VERIFICADO: "warning", DESATUALIZADO: "danger", NAO_DISPONIVEL: "danger" };
const SAFE_URL = /^https:\/\/[\w.-]+\.(gov|jus|leg|mp)\.br(\/|$)|^https:\/\/[\w.-]+\.(gov\.br|jus\.br|leg\.br)(\/|$)/;

/** Painel de fontes da minuta: cada citação do texto precisa de fonte VERIFICADA (trecho conferido) para aprovar. */
export function SourcesPanel({ body, caseId }: { body: string; caseId?: string }) {
  const sources = useCollection("legalSources");
  const act = useAction("legalSources");
  const all = sources.data ?? [];
  const { rows } = checkCitations(body, all);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ url: "", excerpt: "" });
  return (
    <section className="panel space-y-2 p-4 text-sm" aria-labelledby="src-t" data-testid="painel-fontes">
      <h2 id="src-t" className="flex items-center gap-1.5 font-semibold"><BookCheck aria-hidden className="size-4 text-accent" /> Fontes citadas</h2>
      <p className="text-xs text-fg-muted">Detectadas no texto. Aprovar exige fonte verificada (endereço oficial + trecho conferido). Nada é buscado na internet automaticamente.</p>
      {rows.length === 0 ? <p className="text-fg-muted">Nenhuma citação de lei, súmula, recurso ou processo detectada.</p> : (
        <ul className="space-y-2">{rows.map((r) => {
          const s = all.find((x) => x.id === r.sourceId);
          return (
            <li key={r.citation} className="rounded-[var(--radius-control)] border border-line p-2">
              <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 font-medium">{r.citation}</span><Badge tone={TONE[r.status]}>{SOURCE_STATUS_LABEL[r.status]}</Badge></div>
              {s?.url && <a className="mt-1 inline-flex items-center gap-1 text-xs text-accent underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.organ} <ExternalLink aria-hidden className="size-3" /></a>}
              {s?.status === "VERIFICADO" && <p className="mt-1 text-xs text-fg-muted">Conferido por {userName(s.checkedBy)}: “{s.excerpt}”</p>}
              {r.status !== "VERIFICADO" && (open === r.citation ? (
                <div className="mt-2 space-y-2">
                  <label className="block"><span className="label">Endereço oficial (gov.br, jus.br, leg.br)</span><input className="field" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={s?.url ?? "https://"} /></label>
                  <label className="block"><span className="label">Trecho conferido na fonte</span><textarea rows={2} className="field py-2" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></label>
                  <div className="flex gap-2">
                    <button className="btn btn-primary min-h-9" disabled={!SAFE_URL.test(form.url || s?.url || "") || form.excerpt.trim().length < 10} onClick={async () => {
                      const url = form.url || s!.url!;
                      const patch = (x: LegalSource): LegalSource => ({ ...x, url, excerpt: form.excerpt.trim(), status: "VERIFICADO", checkedAt: nowIso() });
                      const ok = await act.run((ctx) => s ? updateRow("legalSources", s.id, ctx, (x: LegalSource) => ({ ...patch(x), checkedBy: ctx.actorId }), `Fonte verificada: ${r.citation}`) : createRow("legalSources", { kind: /s[úu]mula/i.test(r.citation) ? "sumula" : /lei|decreto|lc|ec/i.test(r.citation) ? "lei" : "acordao", label: r.citation, organ: new URL(url).hostname, url, excerpt: form.excerpt.trim(), status: "VERIFICADO", checkedAt: nowIso(), checkedBy: ctx.actorId, caseId }, ctx, `Fonte cadastrada e verificada: ${r.citation}`), "Fonte verificada.");
                      if (ok) { setOpen(null); setForm({ url: "", excerpt: "" }); }
                    }}>Marcar como verificada</button>
                    <button className="btn btn-ghost min-h-9" onClick={() => setOpen(null)}>Cancelar</button>
                  </div>
                  {form.url && !SAFE_URL.test(form.url) && <p className="text-xs text-warning">Use o endereço oficial do órgão (gov.br, jus.br ou leg.br).</p>}
                </div>
              ) : <button className="btn btn-ghost mt-1 min-h-9" onClick={() => { setOpen(r.citation); setForm({ url: s?.url ?? "", excerpt: "" }); }}>Conferir fonte</button>)}
            </li>
          );
        })}</ul>
      )}
      <Feedback error={act.error} notice={act.notice} />
    </section>
  );
}
