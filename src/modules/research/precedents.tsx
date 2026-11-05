"use client";

import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Badge, EmptyState, LoadingBlock } from "@/components/ui";
import { SearchBox } from "@/modules/shared";

type Item = { id: string; court: string; kind: string; number: string; situation: string; question: string; thesis: string; legislation: string; judged_on: string | null; areas: string[]; official_url: string };
const AREAS = ["Previdenciário", "Trabalhista", "Tributário", "Civil", "Consumidor", "Penal", "Família", "Bancário", "Administrativo", "Processual Civil"];
const label = (k: string) => (k === "Tema" ? "Tema repetitivo" : k);
const cancelled = (s: string) => /cancelad/i.test(s);

/** Busca REAL em precedentes qualificados do STJ (dados abertos oficiais). Cada resultado leva ao portal do tribunal. */
export function PrecedentSearch({ q, area, onQ, onArea }: { q: string; area: string; onQ: (v: string) => void; onArea: (v: string) => void }) {
  const [state, setState] = useState<{ loading: boolean; items: Item[]; updatedAt: string | null; error: string | null }>({ loading: false, items: [], updatedAt: null, error: null });
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 3 && !area) { setState((s) => ({ ...s, items: [], loading: false, error: null })); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }));
      fetch(`/api/precedentes?${new URLSearchParams({ q, area })}`, { signal: ctl.signal }).then((r) => r.json())
        .then((j) => setState({ loading: false, items: j.ok ? j.items : [], updatedAt: j.updatedAt ?? null, error: j.ok ? null : j.error?.message ?? "Busca indisponível." }))
        .catch((e) => { if ((e as Error).name !== "AbortError") setState((s) => ({ ...s, loading: false, error: "Busca indisponível agora." })); });
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, area]);
  const cite = (i: Item) => `STJ, ${label(i.kind)} ${i.number}${i.judged_on ? `, julgado em ${i.judged_on.split("-").reverse().join("/")}` : ""}${i.thesis ? `: "${i.thesis.replace(/\s+/g, " ").trim()}"` : ""}. Disponível em: ${i.official_url}`;
  return (
    <section aria-labelledby="prec-t" className="mb-6">
      <h2 id="prec-t" className="mb-1 font-semibold">Precedentes qualificados do STJ</h2>
      <p className="mb-3 text-sm text-fg-muted">Temas repetitivos, IAC, PUIL e controvérsias, da base oficial de dados abertos do STJ (licença CC-BY){state.updatedAt ? `, atualizada em ${new Date(state.updatedAt).toLocaleDateString("pt-BR")}` : ""}. Confira a situação e o inteiro teor no portal antes de citar.</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox label="Buscar precedentes" placeholder="Ex.: atividade especial ruído, ou número do tema" value={q} onChange={onQ} />
        <select aria-label="Área" className="field min-h-10 w-auto text-sm" value={area} onChange={(e) => onArea(e.target.value)}><option value="">Todas as áreas</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
      </div>
      {state.loading ? <LoadingBlock rows={3} /> : state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : q.trim().length < 3 && !area ? <p className="text-sm text-fg-muted">Digite ao menos 3 letras ou escolha uma área.</p> : !state.items.length ? <EmptyState title="Nenhum precedente encontrado" text="Tente outras palavras ou o número do tema." /> : (
        <ul className="space-y-3" data-testid="precedentes">
          {state.items.map((i) => (
            <li key={i.id} className="panel p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 font-medium">STJ · {label(i.kind)} {i.number}</p>
                <Badge tone={cancelled(i.situation) ? "danger" : /tr[aâ]nsito|publicado|julgado/i.test(i.situation) ? "success" : "warning"}>{i.situation || "Situação não informada"}</Badge>
              </div>
              {i.question && <p className="mt-2"><span className="text-fg-muted">Questão: </span>{i.question}</p>}
              {i.thesis ? <p className="mt-2 font-serif">Tese: “{i.thesis}”</p> : <p className="mt-2 text-fg-muted">Sem tese firmada (pendente ou afetado).</p>}
              {i.legislation && <p className="mt-1 text-xs text-fg-muted">Legislação: {i.legislation.slice(0, 300)}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <a className="btn btn-ghost min-h-9" href={i.official_url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden className="size-4" /> Abrir no STJ</a>
                {!cancelled(i.situation) && i.thesis && <button className="btn btn-ghost min-h-9" onClick={() => navigator.clipboard?.writeText(cite(i)).then(() => setCopied(i.id))}><Copy aria-hidden className="size-4" /> {copied === i.id ? "Copiado" : "Copiar citação"}</button>}
                {i.areas.map((a) => <Badge key={a} icon={false}>{a}</Badge>)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
