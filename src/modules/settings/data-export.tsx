"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useSession } from "@/components/providers";
import { formatInstant } from "@/lib/dates";

// Exportação INTEGRAL do escritório (operação real): o servidor monta o ZIP (dados + arquivos + manifesto), registra
// e devolve um link temporário de 10 minutos. Só o titular vê o botão; o servidor e o banco conferem de novo.
type Job = { id: string; requested_at: string; status: string; bytes: number | null; files: number | null; records: number | null; error: string | null; downloads: number };
const call = async (body: object) => (await fetch("/api/dados/exportar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null)) as { ok: boolean; data?: unknown; error?: { message: string } } | null;

export function RealDataExport() {
  const { org, user } = useSession();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now] = useState(() => Date.now());
  const isOwner = user?.role === "admin";
  const load = async () => { if (!org || !isOwner) return; const r = await call({ organizationId: org.id, action: "list" }); setJobs(r?.ok ? (r.data as Job[]) : []); };
  // eslint-disable-next-line react-hooks/set-state-in-effect -- lista lida do servidor ao abrir
  useEffect(() => { void load(); }, [org?.id, isOwner]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!isOwner) return <p className="text-sm text-fg-muted">A exportação integral do escritório é feita pelo titular.</p>;
  const create = async () => {
    setBusy(true); setMsg(null);
    const r = await call({ organizationId: org!.id, action: "create" });
    setBusy(false);
    setMsg(r?.ok ? { ok: true, text: "Exportação pronta. Baixe pelo link abaixo (válido por 10 minutos a cada clique)." } : { ok: false, text: r?.error?.message ?? "Sem conexão." });
    await load();
  };
  const download = async (id: string) => {
    const r = await call({ organizationId: org!.id, action: "download", id });
    if (!r?.ok) return setMsg({ ok: false, text: r?.error?.message ?? "Link indisponível." });
    window.location.assign((r.data as { url: string }).url);
    await load();
  };
  return (
    <div className="space-y-2" data-testid="exportacao-integral">
      <p>Gera um arquivo ZIP com <strong>todos os dados do escritório</strong> (JSON), os <strong>documentos e arquivos</strong> nas extensões originais e um manifesto com a impressão digital (SHA-256) de cada arquivo. Senhas, tokens e dados de outros escritórios nunca entram. O arquivo fica disponível por 7 dias.</p>
      <button className="btn btn-secondary" disabled={busy} onClick={() => void create()}><Download aria-hidden className="size-4" /> {busy ? "Gerando exportação…" : "Gerar exportação integral (ZIP)"}</button>
      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</p>}</div>
      {jobs && jobs.length > 0 && (
        <ul className="divide-y divide-line">{jobs.map((j) => (
          <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <span>{formatInstant(j.requested_at)}</span>
            <span className={j.status === "pronto" ? "text-success" : j.status === "falhou" ? "text-danger" : "text-fg-muted"}>{j.status === "pronto" ? `${j.records} registros · ${j.files} arquivos · ${Math.max(1, Math.round((j.bytes ?? 0) / 1024))} KB` : j.status === "falhou" ? `falhou: ${j.error}` : "processando"}</span>
            {j.status === "pronto" && now - Date.parse(j.requested_at) < 7 * 86_400_000 && <button className="btn btn-ghost min-h-9" onClick={() => void download(j.id)}>Baixar ZIP</button>}
            {j.downloads > 0 && <span className="text-xs text-fg-muted">baixado {j.downloads}×</span>}
          </li>
        ))}</ul>
      )}
    </div>
  );
}
