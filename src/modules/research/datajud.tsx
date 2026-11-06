"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui";
import { useSession } from "@/components/providers";

type Item = { numero: string; tribunal: string; grau: string | null; classe: string | null; sistema: string | null; formato: string | null; orgaoJulgador: string | null; ajuizamento: string | null; ultimaAtualizacao: string | null; assuntos: string[]; movimentos: { data: string; nome: string }[] };
const dt = (s: string | null) => (s ? new Date(s.length === 10 ? `${s}T12:00:00Z` : s).toLocaleString("pt-BR", s.length === 10 ? { dateStyle: "short" } : { dateStyle: "short", timeStyle: "short" }) : "—");

/** Consulta pontual de metadados de um processo no DataJud (CNJ). Um número por vez, sem busca em massa. */
export function DatajudLookup({ initial = "" }: { initial?: string }) {
  const { org } = useSession();
  const [cnj, setCnj] = useState(initial);
  const [st, setSt] = useState<{ loading: boolean; error: string | null; items: Item[] | null; source?: string }>({ loading: false, error: null, items: null });
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setSt({ loading: true, error: null, items: null });
    const r = await fetch("/api/datajud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: org.id, cnj }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSt(j?.ok ? { loading: false, error: null, items: j.items, source: j.source } : { loading: false, error: j?.error?.message ?? "Consulta indisponível agora.", items: null });
  };
  return (
    <section aria-labelledby="dj-t" className="mb-6" data-testid="datajud">
      <h2 id="dj-t" className="mb-1 font-semibold">Consultar processo no DataJud (CNJ)</h2>
      <p className="mb-3 text-sm text-fg-muted">Dados públicos de capa e andamentos de um processo, pelo número CNJ. Não traz partes, documentos nem processos sigilosos. Uso para o trabalho do escritório, conforme o termo de uso do CNJ.</p>
      <form onSubmit={run} className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1 sm:max-w-sm"><span className="label">Número CNJ</span><input id="datajud-cnj" className="field num" inputMode="numeric" placeholder="0000000-00.0000.0.00.0000" value={cnj} onChange={(e) => setCnj(e.target.value)} /></label>
        <button className="btn btn-secondary" disabled={st.loading || cnj.replace(/\D/g, "").length !== 20}><Search aria-hidden className="size-4" /> {st.loading ? "Consultando…" : "Consultar"}</button>
      </form>
      {st.error && <p role="alert" className="mt-2 text-sm text-danger">{st.error}</p>}
      {st.items && (st.items.length === 0 ? <p role="status" className="mt-2 text-sm text-fg-muted">Nenhum registro público encontrado para este número (pode ser sigiloso, recente ou ainda não enviado ao CNJ).</p> : (
        <ul className="mt-3 space-y-3">{st.items.map((i, k) => (
          <li key={k} className="panel p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><p className="num min-w-0 flex-1 font-medium">{i.numero}</p><Badge icon={false}>{i.tribunal}{i.grau ? ` · ${i.grau}` : ""}</Badge></div>
            <dl className="mt-2 grid gap-1 sm:grid-cols-2">
              {[["Classe", i.classe], ["Órgão julgador", i.orgaoJulgador], ["Ajuizamento", dt(i.ajuizamento)], ["Sistema", [i.sistema, i.formato].filter(Boolean).join(" · ") || null], ["Atualizado no CNJ", dt(i.ultimaAtualizacao)]].map(([k, v]) => <div key={k as string}><dt className="inline text-fg-muted">{k}: </dt><dd className="inline">{v ?? "—"}</dd></div>)}
            </dl>
            {i.assuntos.length > 0 && <p className="mt-1"><span className="text-fg-muted">Assuntos: </span>{i.assuntos.join("; ")}</p>}
            {i.movimentos.length > 0 && <details className="mt-2"><summary className="cursor-pointer">Andamentos ({i.movimentos.length})</summary><ol className="mt-1 space-y-0.5 text-xs">{i.movimentos.map((m, n) => <li key={n}><span className="num text-fg-muted">{dt(m.data)}</span> · {m.nome}</li>)}</ol></details>}
          </li>
        ))}</ul>
      ))}
      {st.source && <p className="mt-2 text-xs text-fg-muted">{st.source}</p>}
    </section>
  );
}
