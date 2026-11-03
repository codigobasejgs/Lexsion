import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { whatsappEnabled } from "@/lib/feature-gates";
import { drainEvents } from "@/lib/wa-inbox";
import { drainJobs } from "@/lib/wa-ai";

// Rede de segurança do atendimento (Supabase Cron a cada minuto → pg_net, CRON_SECRET): reprocessa eventos que
// falharam, envia respostas vencidas e devolve ao humano trabalhos presos (função interrompida no meio da geração).
export const maxDuration = 120;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24 || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  if (!whatsappEnabled()) return NextResponse.json({ ok: true, desligado: true });
  const db = supabaseAdmin();
  const stale = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: stuck } = await db.from("ai_jobs").update({ status: "encaminhado", reason: "geração interrompida", finished_at: new Date().toISOString() }).in("status", ["gerando", "enviando"]).lt("created_at", stale).select("organization_id,conversation_id");
  for (const s of stuck ?? []) await db.from("conversation_control").update({ mode: "humano", updated_at: new Date().toISOString() }).eq("organization_id", s.organization_id).eq("conversation_id", s.conversation_id).eq("mode", "ia");
  await db.from("wa_events").update({ status: "erro", reason: "processamento interrompido" }).eq("status", "processando").lt("received_at", stale);
  const eventos = await drainEvents(undefined, 100);
  const ia = await drainJobs(20);
  return NextResponse.json({ ok: true, eventos, ia, presos: stuck?.length ?? 0 });
}
