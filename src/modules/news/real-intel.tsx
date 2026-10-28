"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, History, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useSession } from "@/components/providers";
import { Badge, EmptyState, LoadingBlock } from "@/components/ui";
import { Chips, useUrlState } from "@/modules/shared";
import { kindLabel } from "@/lib/legal-intel/classify";
import { ALL_AREAS } from "@/domain/areas";
import { formatCivil, formatInstant } from "@/lib/dates";

// Jornal do Advogado REAL: só documentos coletados de fontes oficiais (legal_documents/legal_updates).
// Nada aqui é escrito pelo navegador; cada item mostra fonte, datas (publicação ≠ coleta ≠ último ato) e link oficial.
type Upd = { id: string; update_type: "novo" | "alteracao"; detected_at: string; areas: string[]; legal_documents: Doc };
type Doc = { id: string; provider_id: string; doc_kind: string; title: string; ementa: string; organ: string; status_label: string; official_url: string; published_on: string | null; last_event_at: string | null; fetched_at: string; last_confirmed_at: string; current_version: number };
type Ver = { version: number; ementa: string; status_label: string; last_event: string; last_event_at: string | null; fetched_at: string };
type Prov = { id: string; name: string; status: string; status_note: string; enabled: boolean; frequency_minutes: number; last_success_at: string | null; last_run_at: string | null; next_run_at: string | null; last_error: string | null; consecutive_failures: number; terms_url: string | null };
const sb = () => supabaseBrowser();
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = { REAL_ATIVA: "success", PARCIAL: "warning", AGUARDA_CREDENCIAL: "warning", AGUARDA_LICENCA: "danger", AGUARDA_REVISAO_JURIDICA: "warning", INDISPONIVEL: "neutral", DEMO: "info" };
const STATUS_LABEL: Record<string, string> = { REAL_ATIVA: "Ativa", PARCIAL: "Parcial", AGUARDA_CREDENCIAL: "Aguarda credencial", AGUARDA_LICENCA: "Aguarda licença/autorização", AGUARDA_REVISAO_JURIDICA: "Aguarda revisão jurídica", INDISPONIVEL: "Indisponível", DEMO: "Demonstração" };

function useProviders() {
  return useQuery({ queryKey: ["intel", "providers"], queryFn: async () => ((await sb().from("legal_source_providers").select("*").order("status").order("name")).data ?? []) as Prov[] });
}

export function RealJornal() {
  const url = useUrlState();
  const { org } = useSession();
  const area = url.get("area") ?? "todas";
  const mine = url.get("meus") === "1";
  const ups = useQuery({
    queryKey: ["intel", "updates"],
    queryFn: async () => ((await sb().from("legal_updates").select("id,update_type,detected_at,areas,legal_documents(id,provider_id,doc_kind,title,ementa,organ,status_label,official_url,published_on,last_event_at,fetched_at,last_confirmed_at,current_version)").order("detected_at", { ascending: false }).limit(200)).data ?? []) as unknown as Upd[],
  });
  const alerts = useQuery({ queryKey: ["intel", "alerts", org?.id], enabled: !!org, queryFn: async () => new Set(((await sb().from("tenant_alerts").select("update_id")).data ?? []).map((a: { update_id: string }) => a.update_id)) });
  const provs = useProviders();
  const active = (provs.data ?? []).filter((p) => p.status === "REAL_ATIVA");
  const areas = useMemo(() => ["todas", ...new Set((ups.data ?? []).flatMap((u) => u.areas))], [ups.data]);
  const rows = (ups.data ?? []).filter((u) => (area === "todas" || u.areas.includes(area)) && (!mine || alerts.data?.has(u.id)));
  return (
    <>
      <p className="mb-3 rounded-[var(--radius-control)] border border-info/30 bg-info-bg p-3 text-sm text-info">
        Coleta automática de fontes oficiais, periódica (não é tempo real). {active.map((p) => `${p.name}: última atualização confirmada ${p.last_success_at ? formatInstant(p.last_success_at) : "—"}`).join(" · ") || "Nenhuma fonte ativa."} Projeto em tramitação não é lei em vigor.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chips label="Área" value={area} onChange={(k) => url.set("area", k === "todas" ? null : k)} options={areas.map((a) => ({ key: a, label: a === "todas" ? "Todas" : a }))} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={mine} onChange={(e) => url.set("meus", e.target.checked ? "1" : null)} /> Só os alertas do escritório</label>
      </div>
      {ups.isPending ? <LoadingBlock /> : !rows.length ? <EmptyState title="Nenhuma atualização neste filtro" text="As fontes ativas são consultadas periodicamente. Ajuste a área ou aguarde a próxima coleta." /> : (
        <ul className="space-y-3">
          {rows.map((u) => { const d = u.legal_documents; return (
            <li key={u.id}><Link href={`/app/jornal/${u.id}`} className="panel block p-4 text-sm hover:border-line-strong">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={d.doc_kind === "proposicao" ? "warning" : "info"}>{kindLabel(d.doc_kind)}</Badge>
                <Badge icon={false}>{u.update_type === "novo" ? "Novo" : `Atualizado (versão ${d.current_version})`}</Badge>
                {alerts.data?.has(u.id) && <Badge tone="success" icon={false}>Alerta do escritório</Badge>}
                <span className="text-fg-muted">{d.organ}</span>
              </div>
              <h2 className="mt-2 font-serif text-lg">{d.title}</h2>
              <p className="mt-1">{d.ementa}</p>
              <p className="mt-1 text-xs text-fg-muted">Situação: {d.status_label || "—"} · Último ato: {d.last_event_at ? formatInstant(d.last_event_at) : "—"} · Apresentação: {d.published_on ? formatCivil(d.published_on) : "—"} · Coletado: {formatInstant(u.detected_at)}{u.areas.length ? ` · ${u.areas.join(", ")}` : ""}</p>
            </Link></li>
          ); })}
        </ul>
      )}
    </>
  );
}

export function RealJornalItem({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["intel", "item", id],
    queryFn: async () => {
      const { data: u } = await sb().from("legal_updates").select("id,update_type,detected_at,areas,ai_summary,legal_documents(*)").eq("id", id).maybeSingle();
      if (!u) return null;
      const d = (u as unknown as { legal_documents: Doc }).legal_documents;
      const { data: v } = await sb().from("legal_document_versions").select("version,ementa,status_label,last_event,last_event_at,fetched_at").eq("document_id", d.id).order("version", { ascending: false });
      return { u: u as unknown as Upd & { ai_summary: string | null }, d, versions: (v ?? []) as Ver[] };
    },
  });
  if (q.isPending) return <LoadingBlock />;
  if (!q.data) return <EmptyState title="Atualização não encontrada" text="" action={<Link className="btn btn-secondary" href="/app/jornal">Voltar</Link>} />;
  const { d, versions } = q.data;
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={d.doc_kind === "proposicao" ? "warning" : "info"}>{kindLabel(d.doc_kind)}</Badge><span className="text-sm text-fg-muted">{d.organ}</span></div>
      <h1 className="font-serif text-2xl">{d.title}</h1>
      <p>{d.ementa}</p>
      {d.doc_kind === "proposicao" && <p className="rounded border border-warning/40 bg-warning-bg p-3 text-sm text-warning">Projeto em tramitação: ainda não é lei e pode mudar ou ser arquivado. Não aplicar a casos sem análise profissional.</p>}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-fg-muted">Situação</dt><dd>{d.status_label || "—"}</dd>
        <dt className="text-fg-muted">Apresentação</dt><dd>{d.published_on ? formatCivil(d.published_on) : "—"}</dd>
        <dt className="text-fg-muted">Último ato oficial</dt><dd>{d.last_event_at ? formatInstant(d.last_event_at) : "—"}</dd>
        <dt className="text-fg-muted">Coletado</dt><dd>{formatInstant(d.fetched_at)}</dd>
        <dt className="text-fg-muted">Confirmado na fonte</dt><dd>{formatInstant(d.last_confirmed_at)}</dd>
      </dl>
      <a className="btn btn-primary" href={d.official_url} target="_blank" rel="noreferrer noopener"><ExternalLink aria-hidden className="size-4" /> Ler na fonte oficial</a>
      <section className="panel p-4 text-sm" aria-labelledby="ver-h">
        <h2 id="ver-h" className="mb-2 flex items-center gap-2 font-semibold"><History aria-hidden className="size-4" /> Histórico de versões ({versions.length})</h2>
        <ol className="space-y-2">{versions.map((v) => <li key={v.version} className="rounded border border-line p-2"><p className="font-medium">Versão {v.version} · coletada {formatInstant(v.fetched_at)}</p><p className="text-fg-muted">{v.status_label || "—"} · {v.last_event || "—"}{v.last_event_at ? ` (${formatInstant(v.last_event_at)})` : ""}</p></li>)}</ol>
      </section>
    </article>
  );
}

/** Configurações do escritório > Inteligência jurídica. */
export function IntelPreferences() {
  const { org, user } = useSession();
  const [areas, setAreas] = useState<string[]>([]);
  const [keywords, setKeywords] = useState("");
  const [projects, setProjects] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const canEdit = user && ["admin", "tenant_admin", "advogado"].includes(user.role);
  useEffect(() => {
    if (!org) return;
    (async () => {
      const { data } = await sb().from("tenant_legal_preferences").select("areas,keywords,include_projects").eq("organization_id", org.id).maybeSingle();
      const p = data as { areas: string[]; keywords: string[]; include_projects: boolean } | null;
      if (p) { setAreas(p.areas); setKeywords(p.keywords.join(", ")); setProjects(p.include_projects); }
    })();
  }, [org]);
  const save = async () => {
    if (!org) return;
    const kw = keywords.split(",").map((k) => k.trim()).filter((k) => k.length >= 3).slice(0, 30);
    const { error } = await sb().from("tenant_legal_preferences").upsert({ organization_id: org.id, areas, keywords: kw, include_projects: projects, updated_by: user?.id, updated_at: new Date().toISOString() });
    setMsg(error ? "Não foi possível salvar (permissão ou conexão)." : `Salvo. O escritório recebe alertas de ${areas.length} área(s) e ${kw.length} palavra(s)-chave a partir da próxima coleta.`);
  };
  return (
    <section className="panel space-y-3 p-4 text-sm">
      <fieldset><legend className="label">Áreas de interesse</legend><div className="flex flex-wrap gap-2">{ALL_AREAS.map((a) => <label key={a} className="flex items-center gap-1.5"><input type="checkbox" disabled={!canEdit} className="size-4 accent-[var(--brand)]" checked={areas.includes(a)} onChange={(e) => setAreas(e.target.checked ? [...areas, a] : areas.filter((x) => x !== a))} />{a}</label>)}</div></fieldset>
      <label className="block"><span className="label">Palavras-chave (separe por vírgula)</span><input className="field" disabled={!canEdit} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="BPC, auxílio-acidente, aposentadoria especial" /></label>
      <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} className="size-4 accent-[var(--brand)]" checked={projects} onChange={(e) => setProjects(e.target.checked)} /> Incluir projetos em tramitação (não são lei)</label>
      {canEdit ? <button className="btn btn-primary" onClick={save}>Salvar preferências</button> : <p className="text-fg-muted">Somente titular, gestor ou advogado(a) altera.</p>}
      <p role="status" className={msg ? "text-success" : "sr-only"}>{msg}</p>
    </section>
  );
}

/** Super Admin > Saúde dos conectores. */
export function ConnectorHealth() {
  const provs = useProviders();
  const qc = useQueryClient();
  const runs = useQuery({ queryKey: ["intel", "runs"], queryFn: async () => (await sb().from("source_sync_runs").select("*").order("started_at", { ascending: false }).limit(15)).data ?? [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const runNow = async () => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/inteligencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "camara-proposicoes", maxItems: 150 }) }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    setMsg(r?.ok ? `Execução: ${r.data.status} · ${r.data.seen ?? 0} lidos · ${r.data.novo ?? 0} novos · ${r.data.changed ?? 0} alterados · ${r.data.alerts ?? 0} alertas` : r?.error?.message ?? "Falhou.");
    await qc.invalidateQueries({ queryKey: ["intel"] });
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2"><button className="btn btn-primary" disabled={busy} onClick={runNow}><RefreshCw aria-hidden className="size-4" /> {busy ? "Sincronizando…" : "Sincronizar Câmara agora"}</button><span role="status" className="text-sm">{msg}</span></div>
      <div className="panel overflow-x-auto" tabIndex={0} aria-label="Fontes (role horizontalmente)">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="text-left text-xs text-fg-muted"><th className="p-3">Fonte</th><th>Situação</th><th>Frequência</th><th>Última atualização confirmada</th><th>Próxima prevista</th><th>Erro</th></tr></thead>
          <tbody>{(provs.data ?? []).map((p) => (
            <tr key={p.id} className="border-t border-line align-top" data-testid={`fonte-${p.id}`}>
              <td className="p-3"><p className="font-medium">{p.name}</p><p className="text-xs text-fg-muted">{p.status_note}</p>{p.terms_url && <a className="text-xs text-accent underline" href={p.terms_url} target="_blank" rel="noreferrer noopener">termos/documentação</a>}</td>
              <td><Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status] ?? p.status}</Badge></td>
              <td>{p.enabled ? `a cada ${p.frequency_minutes / 60} h` : "—"}</td>
              <td>{p.last_success_at ? formatInstant(p.last_success_at) : "—"}</td>
              <td>{p.next_run_at ? formatInstant(p.next_run_at) : "—"}</td>
              <td className="text-danger">{p.last_error ?? ""}{p.consecutive_failures ? ` (${p.consecutive_failures} falha(s) seguidas)` : ""}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <section className="panel p-4 text-sm"><h2 className="mb-2 font-semibold">Execuções recentes</h2>
        <ul className="space-y-1">{(runs.data ?? []).map((r: { id: number; started_at: string; provider_id: string; trigger: string; status: string; items_seen: number; items_new: number; items_changed: number; alerts_created: number; latency_ms: number | null; error: string | null }) => <li key={r.id} className="num">{formatInstant(r.started_at)} · {r.provider_id} · {r.trigger} · <strong>{r.status}</strong> · {r.items_seen} lidos / {r.items_new} novos / {r.items_changed} alterados / {r.alerts_created} alertas{r.latency_ms ? ` · ${(r.latency_ms / 1000).toFixed(1)} s` : ""}{r.error ? ` · ${r.error}` : ""}</li>)}</ul>
      </section>
    </div>
  );
}
