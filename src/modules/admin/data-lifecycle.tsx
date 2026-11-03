"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Badge, Dialog, LoadingBlock } from "@/components/ui";
import { fmtDate, fmtDateTime } from "./real-api";

// Super Admin > Dados e LGPD (operação real): eliminação ASSISTIDA (90 dias após o encerramento; um escritório por vez,
// prévia, motivo, endereço digitado e senha) e registro de incidentes (prazo de 1 dia útil para avisar o titular).
type Cand = { id: string; slug: string; name: string; closed_at: string; eligible_at: string; eligible: boolean; status_reason: string | null };
type Erasure = { id: string; org_slug: string; org_name: string; status: string; started_at: string; finished_at: string | null; storage_removed: number; db_removed: Record<string, number> | null; pending: Record<string, string> | null; error: string | null };
type Incident = { id: string; title: string; known_at: string; notify_deadline: string; status: string; affected_orgs: string[]; data_categories: string[]; containment: string };
const rpc = async <T,>(fn: string, args?: Record<string, unknown>) => { const { data, error } = await supabaseBrowser().rpc(fn, args); if (error) throw new Error(error.message.replace(/^.*?: /, "")); return data as T; };

export function DataLifecycle() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-dados"], queryFn: async () => {
    const sb = supabaseBrowser();
    const [c, e, i] = await Promise.all([rpc<Cand[]>("platform_erasure_candidates"), sb.from("data_erasures").select("*").order("started_at", { ascending: false }).limit(50), sb.from("security_incidents").select("*").order("known_at", { ascending: false }).limit(50)]);
    return { cands: c ?? [], erasures: (e.data ?? []) as Erasure[], incidents: (i.data ?? []) as Incident[] };
  } });
  const [sel, setSel] = useState<Cand | null>(null);
  const [inc, setInc] = useState(false);
  if (q.isPending) return <LoadingBlock rows={4} />;
  if (q.isError) return <p className="panel p-4 text-sm text-danger">{(q.error as Error).message}</p>;
  const { cands, erasures, incidents } = q.data;
  const reload = () => qc.invalidateQueries({ queryKey: ["admin-dados"] });
  return (
    <div className="space-y-6 text-sm">
      <section className="panel space-y-2 p-4" aria-labelledby="dl-c">
        <h2 id="dl-c" className="font-semibold">Escritórios encerrados (eliminação após 90 dias)</h2>
        <p className="text-fg-muted">Nada é eliminado automaticamente. O escritório só fica elegível 90 dias depois do encerramento efetivo (cancelado ao fim do período pago). Contratos, aceites e pagamentos são preservados.</p>
        {!cands.length ? <p className="text-fg-muted" data-testid="sem-encerrados">Nenhum escritório encerrado.</p> : (
          <ul className="divide-y divide-line">{cands.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid={`encerrado-${c.slug}`}>
              <strong>{c.name}</strong><span className="text-fg-muted">/{c.slug}</span>
              <span>encerrado em {fmtDate(c.closed_at)} · elegível em {fmtDate(c.eligible_at)}</span>
              <Badge tone={c.eligible ? "warning" : "neutral"}>{c.eligible ? "elegível" : "aguardando 90 dias"}</Badge>
              <button className="btn btn-ghost min-h-9" onClick={() => setSel(c)}>Ver prévia{c.eligible ? " e eliminar" : ""}</button>
            </li>
          ))}</ul>
        )}
      </section>
      <section className="panel space-y-2 p-4" aria-labelledby="dl-e">
        <h2 id="dl-e" className="font-semibold">Eliminações registradas</h2>
        {!erasures.length ? <p className="text-fg-muted">Nenhuma.</p> : <ul className="divide-y divide-line">{erasures.map((e) => (
          <li key={e.id} className="py-2"><strong>{e.org_name}</strong> /{e.org_slug} · <Badge tone={e.status === "concluida" ? "success" : e.status === "falhou" ? "danger" : "warning"}>{e.status}</Badge> · {fmtDateTime(e.started_at)}
            <p className="text-xs text-fg-muted">{e.storage_removed} arquivo(s) removido(s){e.db_removed ? ` · banco: ${Object.entries(e.db_removed).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}{e.pending ? ` · pendente: ${Object.values(e.pending).join("; ")}` : ""}{e.error ? ` · erro: ${e.error}` : ""}</p></li>
        ))}</ul>}
      </section>
      <section className="panel space-y-2 p-4" aria-labelledby="dl-i">
        <div className="flex flex-wrap items-center gap-2"><h2 id="dl-i" className="flex-1 font-semibold">Incidentes de segurança</h2><button className="btn btn-secondary min-h-9" onClick={() => setInc(true)}>Registrar incidente</button></div>
        <p className="text-fg-muted">Prazo contratual: avisar o titular de cada escritório afetado em até 1 dia útil do conhecimento (Anexo III.10). A comunicação à ANPD e aos titulares é do escritório (controlador).</p>
        {!incidents.length ? <p className="text-fg-muted">Nenhum incidente registrado.</p> : <ul className="divide-y divide-line">{incidents.map((i) => (
          <li key={i.id} className="py-2"><strong>{i.title}</strong> · <Badge tone={i.status === "encerrado" ? "success" : "danger"}>{i.status}</Badge> · conhecido em {fmtDateTime(i.known_at)} · avisar até <strong>{fmtDateTime(i.notify_deadline)}</strong>
            <p className="text-xs text-fg-muted">{i.affected_orgs.length} escritório(s) · dados: {i.data_categories.join(", ") || "—"}{i.containment ? ` · contenção: ${i.containment}` : ""}</p></li>
        ))}</ul>}
      </section>
      {sel && <EraseDialog c={sel} onClose={() => { setSel(null); void reload(); }} />}
      {inc && <IncidentDialog onClose={() => { setInc(false); void reload(); }} />}
    </div>
  );
}

function EraseDialog({ c, onClose }: { c: Cand; onClose: () => void }) {
  const p = useQuery({ queryKey: ["erase-preview", c.id], queryFn: () => rpc<{ remove: Record<string, number>; retain: Record<string, number | string>; exports: { at: string; status: string; downloads: number }[]; backups: string }>("platform_erasure_preview", { p_org: c.id }) });
  const [confirm, setConfirm] = useState(""), [reason, setReason] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/eliminacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org: c.id, confirm, reason, password }) }).then((x) => x.json()).catch(() => null);
    setBusy(false); setPassword("");
    setMsg(r?.ok ? { ok: true, text: `Eliminação concluída: ${r.data.storage_removed} arquivo(s) e os registros do banco. Pendente: ${r.data.pending.join("; ")}.` } : { ok: false, text: r?.error?.message ?? "Sem conexão. Nada foi eliminado." });
  };
  return (
    <Dialog open onClose={onClose} title={`Eliminar dados de ${c.name}?`}>
      {p.isPending ? <LoadingBlock rows={3} /> : p.data && (
        <div className="space-y-3 text-sm">
          <div><p className="font-medium">Será eliminado</p><ul className="grid grid-cols-2 gap-x-3 text-xs">{Object.entries(p.data.remove).map(([k, v]) => <li key={k}>{k.replace(/_/g, " ")}: <strong className="num">{k.startsWith("bytes") ? `${Math.round(Number(v) / 1024)} KB` : v}</strong></li>)}</ul></div>
          <div><p className="font-medium">Fica guardado</p><ul className="text-xs">{Object.entries(p.data.retain).map(([k, v]) => <li key={k}>{k.replace(/_/g, " ")}: {String(v)}</li>)}</ul></div>
          <p className="text-xs">Exportações do escritório: {p.data.exports.length ? p.data.exports.map((x) => `${fmtDate(x.at)} (${x.status}, baixada ${x.downloads}×)`).join("; ") : "nenhuma"}.</p>
          <p className="text-xs text-fg-muted">Backups: {p.data.backups}.</p>
          {c.eligible ? (<>
            <label className="block"><span className="label">Motivo (mínimo 10 caracteres)</span><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <label className="block"><span className="label">Digite o endereço do escritório: {c.slug}</span><input className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
            <label className="block"><span className="label">Sua senha (confirmação reforçada)</span><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
            <button className="btn btn-danger" disabled={busy || confirm !== c.slug || reason.trim().length < 10 || !password} onClick={() => void run()}>{busy ? "Eliminando…" : "Eliminar definitivamente"}</button>
          </>) : <p className="text-warning">Ainda não elegível: só a partir de {fmtDate(c.eligible_at)}.</p>}
          <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}</div>
        </div>
      )}
    </Dialog>
  );
}

const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
function IncidentDialog({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState(() => ({ title: "", description: "", detected_at: localNow(), known_at: localNow(), data_categories: "", containment: "" }));
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    const { error } = await supabaseBrowser().from("security_incidents").insert({ title: f.title, description: f.description, detected_at: new Date(f.detected_at).toISOString(), known_at: new Date(f.known_at).toISOString(), data_categories: f.data_categories.split(",").map((x) => x.trim()).filter(Boolean), containment: f.containment, notify_deadline: new Date().toISOString() });
    if (error) return setMsg(error.message.replace(/^.*?: /, ""));
    onClose();
  };
  return (
    <Dialog open onClose={onClose} title="Registrar incidente de segurança">
      <div className="space-y-2 text-sm">
        <label className="block"><span className="label">Título</span><input className="field" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="block"><span className="label">Descrição</span><textarea className="field min-h-20 py-2" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="grid gap-2 sm:grid-cols-2"><label className="block"><span className="label">Detectado em</span><input type="datetime-local" className="field" value={f.detected_at} onChange={(e) => setF({ ...f, detected_at: e.target.value })} /></label>
          <label className="block"><span className="label">Conhecido em</span><input type="datetime-local" className="field" value={f.known_at} onChange={(e) => setF({ ...f, known_at: e.target.value })} /></label></div>
        <label className="block"><span className="label">Dados potencialmente afetados (separe por vírgula)</span><input className="field" value={f.data_categories} onChange={(e) => setF({ ...f, data_categories: e.target.value })} /></label>
        <label className="block"><span className="label">Medidas de contenção</span><input className="field" value={f.containment} onChange={(e) => setF({ ...f, containment: e.target.value })} /></label>
        <p className="text-xs text-fg-muted">O prazo de aviso (1 dia útil após o conhecimento) é calculado pelo banco.</p>
        {msg && <p role="alert" className="text-danger">{msg}</p>}
        <button className="btn btn-primary" disabled={f.title.trim().length < 5} onClick={() => void save()}>Registrar</button>
      </div>
    </Dialog>
  );
}
