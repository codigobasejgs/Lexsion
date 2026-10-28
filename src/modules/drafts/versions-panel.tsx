"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { userName } from "@/modules/shared";
import { formatInstant } from "@/lib/dates";
import { lineDiff } from "@/domain/text-diff";
import type { LegalDraft } from "@/domain/types";

/** Compara uma versão anterior com o texto atual (linhas removidas/incluídas) e permite restaurá-la no editor. */
export function VersionsPanel({ d, current, onRestore }: { d: LegalDraft; current: string; onRestore: (body: string) => void }) {
  const versions = [...(d.versions ?? [])].reverse();
  const [sel, setSel] = useState<number | null>(null);
  const v = versions.find((x) => x.n === sel);
  const diff = v ? lineDiff(v.body, current) : [];
  const changed = diff.filter((x) => x.op !== "=").length;
  return (
    <section className="panel space-y-2 p-4 text-sm" aria-labelledby="ver-t" data-testid="versoes-minuta">
      <h2 id="ver-t" className="flex items-center gap-1.5 font-semibold"><History aria-hidden className="size-4 text-accent" /> Versões ({versions.length})</h2>
      {!versions.length ? <p className="text-fg-muted">Cada salvamento guarda a versão anterior aqui.</p> : (
        <>
          <label className="block"><span className="label">Comparar com o texto atual</span>
            <select className="field" value={sel ?? ""} onChange={(e) => setSel(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Escolha uma versão</option>
              {versions.map((x) => <option key={x.n} value={x.n}>v{x.n} · {formatInstant(x.at)} · {userName(x.actorId)}</option>)}
            </select>
          </label>
          {v && (
            <>
              <p className="text-xs text-fg-muted">{changed ? `${changed} linha(s) diferente(s). Vermelho: só na v${v.n}. Verde: só no texto atual.` : "Sem diferenças."}</p>
              <div className="max-h-72 overflow-auto rounded border border-line font-mono text-xs" role="region" aria-label={`Diferenças entre v${v.n} e o texto atual`} tabIndex={0}>
                {diff.filter((x) => x.op !== "=" || diff.length < 40).map((x, i) => (
                  <p key={i} className={`whitespace-pre-wrap px-2 py-0.5 ${x.op === "+" ? "bg-success-bg text-success" : x.op === "-" ? "bg-danger-bg text-danger" : "text-fg-muted"}`}>
                    <span aria-hidden>{x.op === "+" ? "+ " : x.op === "-" ? "− " : "  "}</span><span className="sr-only">{x.op === "+" ? "Incluída: " : x.op === "-" ? "Removida: " : ""}</span>{x.text || " "}
                  </p>
                ))}
              </div>
              <button className="btn btn-ghost min-h-9" onClick={() => onRestore(v.body)}>Restaurar v{v.n} no editor (salve para confirmar)</button>
            </>
          )}
        </>
      )}
    </section>
  );
}
