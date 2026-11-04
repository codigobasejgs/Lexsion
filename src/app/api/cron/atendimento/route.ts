import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { whatsappEnabled } from "@/lib/feature-gates";
import { drainEvents } from "@/lib/wa-inbox";
import { drainJobs } from "@/lib/wa-ai";
import { opsAlert } from "@/lib/ops-alert";

// Rede de segurança do atendimento (Supabase Cron a cada minuto → pg_net, CRON_SECRET): reprocessa eventos que
// falharam, envia respostas vencidas e devolve ao humano trabalhos presos (função interrompida no meio da geração).
export const maxDuration = 120;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24 || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  const db = supabaseAdmin();
  // Integração desligada: nada é enviado; respostas que estavam na fila passam para a equipe (não ficam esquecidas).
  if (!whatsappEnabled()) {
    const { data: off } = await db.from("ai_jobs").update({ status: "encaminhado", reason: "WhatsApp desligado na plataforma", finished_at: new Date().toISOString() }).in("status", ["pendente", "gerando", "enviando"]).select("id,organization_id,conversation_id");
    for (const s of off ?? []) {
      await db.from("conversation_control").update({ mode: "humano", sending_job: null, updated_at: new Date().toISOString() }).eq("organization_id", s.organization_id).eq("conversation_id", s.conversation_id).eq("mode", "ia");
    }
    return NextResponse.json({ ok: true, desligado: true, encaminhados: off?.length ?? 0 });
  }
  const stale = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: stuck } = await db.from("ai_jobs").update({ status: "encaminhado", reason: "geração interrompida", finished_at: new Date().toISOString() }).in("status", ["gerando", "enviando"]).lt("created_at", stale).select("id,organization_id,conversation_id");
  for (const s of stuck ?? []) {
    await db.from("conversation_control").update({ sending_job: null }).eq("sending_job", s.id);
    await db.from("conversation_control").update({ mode: "humano", updated_at: new Date().toISOString() }).eq("organization_id", s.organization_id).eq("conversation_id", s.conversation_id).eq("mode", "ia");
  }
  await db.from("wa_events").update({ status: "erro", reason: "processamento interrompido" }).eq("status", "processando").lt("received_at", stale);
  const eventos = await drainEvents(undefined, 100);
  const ia = await drainJobs(20);
  // WhatsApp do escritório caído há mais de 1 h: aviso no sino do escritório (1 por dia por escritório).
  const { data: down } = await db.from("whatsapp_instances").select("organization_id,updated_at").in("status", ["desconectado", "erro"]).lt("updated_at", new Date(Date.now() - 3_600_000).toISOString());
  const day = new Date().toISOString().slice(0, 10);
  for (const w of down ?? []) {
    const id = `wa-desconectado-${day}`;
    await db.from("org_records").insert({ organization_id: w.organization_id, collection: "notifications", id, data: { id, organizationId: w.organization_id, at: new Date().toISOString(), severity: "warning", read: false, href: "/app/integracoes/evolution", text: "WhatsApp do escritório desconectado: a assistente não responde e as mensagens novas não chegam. Reconecte em Integrações (Gerar QR)." } }).then(() => null);
  }
  // Observabilidade: evento que esgotou as tentativas (fila morta) ou trabalho preso gera alerta à operação.
  const { count: dead } = await db.from("wa_events").select("id", { count: "exact", head: true }).eq("status", "erro").gte("attempts", 5);
  if (dead || stuck?.length) await opsAlert("Atendimento WhatsApp com falha", `${dead ?? 0} evento(s) do WhatsApp esgotaram as tentativas e ${stuck?.length ?? 0} resposta(s) da assistente ficaram presas (devolvidas à equipe).\nVeja wa_events com status "erro" e o motivo gravado; os contatos não receberam mensagem de erro.`).catch(() => false);
  return NextResponse.json({ ok: true, eventos, ia, presos: stuck?.length ?? 0, mortos: dead ?? 0 });
}
