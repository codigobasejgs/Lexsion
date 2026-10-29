"use client";

import { useQuery } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Badge, LoadingBlock } from "@/components/ui";
import { formatInstant } from "@/lib/dates";

// Saúde da operação no plano Free: consumo frente aos limites, último backup cifrado e falhas do agendador.
// Fonte: função platform_health (só plataforma com 2º fator). Nenhum dado de cliente.
type Health = {
  db_bytes: number; db_limit_bytes: number; storage_bytes: number; storage_limit_bytes: number; users: number;
  last_backup_ok: string | null; last_backup_error: string | null; last_backup_detail: string | null;
  sources: { id: string; status: string; last_success_at: string | null; failures: number }[]; cron_failures_24h: number;
};
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const DAY = 86_400_000;

export function PlatformHealth() {
  const q = useQuery({ queryKey: ["platform-health"], refetchInterval: 300_000, queryFn: async () => (await supabaseBrowser().rpc("platform_health")).data as Health | null });
  if (q.isPending) return <LoadingBlock rows={3} />;
  const h = q.data;
  const now = q.dataUpdatedAt; // hora da leitura (estável durante a renderização)
  if (!h) return <p className="text-sm text-danger">Saúde indisponível (exige plataforma com verificação em duas etapas).</p>;
  const pct = (a: number, b: number) => Math.round((a / b) * 100);
  const backupAge = h.last_backup_ok ? now - Date.parse(h.last_backup_ok) : Infinity;
  const backupFailedLast = !!h.last_backup_error && (!h.last_backup_ok || h.last_backup_error > h.last_backup_ok);
  const alerts: string[] = [];
  if (pct(h.db_bytes, h.db_limit_bytes) >= 80) alerts.push(`Banco em ${pct(h.db_bytes, h.db_limit_bytes)}% do limite do plano Free.`);
  if (pct(h.storage_bytes, h.storage_limit_bytes) >= 80) alerts.push(`Arquivos em ${pct(h.storage_bytes, h.storage_limit_bytes)}% do limite do plano Free.`);
  if (backupAge > 1.5 * DAY) alerts.push(h.last_backup_ok ? "Último backup bem-sucedido tem mais de 36 horas." : "Nenhum backup bem-sucedido registrado.");
  if (backupFailedLast) alerts.push("A última tentativa de backup falhou.");
  if (h.cron_failures_24h > 0) alerts.push(`${h.cron_failures_24h} execução(ões) do agendador falharam nas últimas 24 h.`);
  for (const s of h.sources) if (s.failures > 0 || !s.last_success_at || now - Date.parse(s.last_success_at) > DAY) alerts.push(`Fonte ${s.id}: sem coleta bem-sucedida nas últimas 24 h.`);
  const bar = (a: number, b: number) => (
    <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct(a, b)} aria-valuemin={0} aria-valuemax={100}><div className={`h-full ${pct(a, b) >= 80 ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.max(1, pct(a, b))}%` }} /></div>
  );
  return (
    <section className="space-y-4" aria-labelledby="saude-t">
      <h2 id="saude-t" className="text-lg font-semibold">Saúde da operação (plano Free)</h2>
      {alerts.length ? (
        <ul role="alert" className="space-y-1 rounded border border-danger/30 bg-danger-bg p-3 text-sm text-danger">{alerts.map((a) => <li key={a}>{a}</li>)}</ul>
      ) : <p role="status" className="rounded border border-success/30 bg-success-bg p-3 text-sm text-success">Sem alertas: consumo abaixo de 80%, backup do dia conferido e fontes atualizadas.</p>}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel space-y-2 p-4 text-sm"><p className="font-medium">Banco</p>{bar(h.db_bytes, h.db_limit_bytes)}<p className="text-fg-muted">{mb(h.db_bytes)} de {mb(h.db_limit_bytes)}</p></div>
        <div className="panel space-y-2 p-4 text-sm"><p className="font-medium">Arquivos (Storage)</p>{bar(h.storage_bytes, h.storage_limit_bytes)}<p className="text-fg-muted">{mb(h.storage_bytes)} de {mb(h.storage_limit_bytes)}</p></div>
        <div className="panel space-y-2 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">Backup cifrado (R2) <Badge tone={backupFailedLast || backupAge > 1.5 * DAY ? "danger" : "success"}>{backupFailedLast ? "falhou" : backupAge > 1.5 * DAY ? "atrasado" : "em dia"}</Badge></p>
          <p className="text-fg-muted">Último conferido: {h.last_backup_ok ? formatInstant(h.last_backup_ok) : "nenhum"}</p>
          {h.last_backup_detail && <p className="text-xs text-fg-muted">{h.last_backup_detail}</p>}
        </div>
      </div>
      <p className="text-xs text-fg-muted">{h.users} conta(s) no Auth. Limites do plano Free: 500 MB de banco, 1 GB de arquivos, 50 mil usuários ativos/mês. Sem PITR: a recuperação vai até o último backup diário.</p>
    </section>
  );
}
