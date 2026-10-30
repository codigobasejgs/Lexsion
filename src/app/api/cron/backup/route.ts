import { NextResponse, type NextRequest } from "next/server";
import { runBackup } from "@/lib/backup";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsAlert } from "@/lib/ops-alert";

// Backup diário: chamado pelo Supabase Cron (pg_net), autenticado por CRON_SECRET (mesmo esquema da coleta jurídica).
// Resultado registrado em audit_logs da plataforma (sem conteúdo), para o painel e para o alerta de falha.
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24 || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  const db = supabaseAdmin();
  try {
    const r = await runBackup();
    await db.from("audit_logs").insert({ organization_id: null, actor_id: null, action: "backup.ok", entity: "backup", entity_id: r.name.split("/").pop(), detail: `${r.rows} linhas, ${r.tables} tabelas, ${Math.round(r.bytes / 1024)} KB cifrados; ${r.files} arquivos (${Math.round(r.fileBytes / 1024)} KB, ${r.filesUploaded} novos), conferido; ${r.kept} guardados, ${r.removed}+${r.removedFiles} antigos removidos` });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await db.from("audit_logs").insert({ organization_id: null, actor_id: null, action: "backup.erro", entity: "backup", entity_id: "diario", detail: msg });
    await opsAlert("Backup diário falhou", `O backup cifrado de hoje não foi concluído: ${msg}\nOs backups anteriores no R2 continuam íntegros.`).catch(() => false);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
