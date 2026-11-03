import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Caixa de entrada WhatsApp (Evolution 2.3.x, Baileys). O webhook só GRAVA o evento (wa_events, único por instância +
// tipo + id do provedor) e responde; o processamento é idempotente e pode ser repetido (cron, retry) sem duplicar.
// Regras de segurança (antes de qualquer IA): grupo (@g.us), status (status@broadcast), broadcast (@broadcast),
// canal (@newsletter) e mensagem própria NUNCA disparam IA; grupos ficam fora da caixa operacional.
export type Evo = { event?: string; instance?: string; data?: { key?: { id?: string; remoteJid?: string; remoteJidAlt?: string; fromMe?: boolean; participant?: string }; pushName?: string; message?: Record<string, unknown> | null; messageType?: string; messageTimestamp?: number | string; state?: string; status?: string } };

export const jidKind = (jid: string): "pessoa" | "grupo" | "status" | "broadcast" | "canal" | "outro" =>
  jid === "status@broadcast" ? "status" : jid.endsWith("@g.us") ? "grupo" : jid.endsWith("@broadcast") ? "broadcast" : jid.endsWith("@newsletter") ? "canal"
  : jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid") ? "pessoa" : "outro";

/** Destino de envio: só conversa individual. @lid sem telefone conhecido vai pelo próprio jid. null = não enviar. */
export function waTarget(c: { jid?: string; phone?: string }): string | null {
  if (c.jid && jidKind(c.jid) !== "pessoa") return null; // grupo/status/broadcast: nunca
  if (c.jid?.endsWith("@lid") && !c.phone) return c.jid;
  const n = String(c.phone ?? "").replace(/\D/g, "");
  const full = n.length <= 11 ? `55${n}` : n;
  return /^\d{12,15}$/.test(full) ? full : null;
}

/** Texto e tipo de mídia suportados (o conteúdo binário da mídia não é baixado nesta versão). */
export function extract(message: Record<string, unknown> | null | undefined): { text: string; media: string | null } {
  const m = (message ?? {}) as Record<string, { text?: string; caption?: string } | string | undefined>;
  const text = (typeof m.conversation === "string" ? m.conversation : undefined) ?? (m.extendedTextMessage as { text?: string } | undefined)?.text
    ?? (m.imageMessage as { caption?: string } | undefined)?.caption ?? (m.videoMessage as { caption?: string } | undefined)?.caption ?? (m.documentMessage as { caption?: string } | undefined)?.caption ?? "";
  const media = m.audioMessage ? "áudio" : m.imageMessage ? "imagem" : m.videoMessage ? "vídeo" : m.documentMessage ? "documento" : m.stickerMessage ? "figurinha" : m.locationMessage ? "localização" : m.contactMessage ? "contato" : null;
  return { text: String(text ?? ""), media };
}

/** Grava o evento (deduplicado). Devolve o id do evento ou null se já existia (reentrega). */
export async function recordEvent(org: string, instance: string, ev: Evo): Promise<number | null> {
  const db = supabaseAdmin();
  const kind = String(ev.event ?? "").toLowerCase().replace(/_/g, ".");
  const k = ev.data?.key;
  const jid = String(k?.remoteJid ?? "");
  const providerId = kind === "messages.upsert" || kind === "send.message" ? String(k?.id ?? "") : `${kind}:${ev.data?.state ?? ev.data?.status ?? ""}:${Date.now()}`;
  if (!providerId) return null;
  const ts = Number(ev.data?.messageTimestamp ?? 0);
  // Payload mínimo: sem tokens, sem mídia binária. Texto da mensagem é necessário para a caixa de entrada.
  const { text, media } = extract(ev.data?.message);
  const payload = { pushName: String(ev.data?.pushName ?? "").slice(0, 120), text: text.slice(0, 4000), media, state: ev.data?.state ?? null, jidAlt: k?.remoteJidAlt ?? null };
  const { data, error } = await db.from("wa_events").insert({ organization_id: org, instance_name: instance, provider_id: providerId.slice(0, 200), kind, remote_jid: jid || null, from_me: !!k?.fromMe, payload,
    provider_ts: ts ? new Date(ts * 1000).toISOString() : null }).select("id").single();
  if (error?.code === "23505") return null; // reentrega/duplicado: já gravado
  if (error) throw new Error(`evento não gravado: ${error.message}`);
  return data.id as number;
}

type Ev = { id: number; organization_id: string; kind: string; provider_id: string; remote_jid: string | null; from_me: boolean; payload: { pushName?: string; text?: string; media?: string | null; state?: string | null; jidAlt?: string | null }; provider_ts: string | null; received_at: string; attempts: number };
const digits = (s: string) => s.replace(/\D/g, "").slice(-11);

/** Processa UM evento. Idempotente: mensagem tem id determinístico (wa-<id do provedor>). */
export async function processEvent(e: Ev): Promise<{ status: "feito" | "ignorado"; reason?: string; aiJob?: number | null }> {
  const db = supabaseAdmin();
  const org = e.organization_id;
  if (e.kind === "connection.update") {
    const st = e.payload.state;
    const status = st === "open" ? "operacional" : st === "connecting" ? "conectando" : "desconectado";
    await db.from("whatsapp_instances").update({ status, updated_at: new Date().toISOString() }).eq("organization_id", org);
    return { status: "feito" };
  }
  if (e.kind !== "messages.upsert" && e.kind !== "send.message") return { status: "ignorado", reason: "tipo de evento sem uso" };
  const jid = e.remote_jid ?? "";
  const kind = jidKind(jid);
  if (kind !== "pessoa") return { status: "ignorado", reason: `${kind}: fora da caixa operacional e sem IA` };
  const { text, media } = { text: e.payload.text ?? "", media: e.payload.media ?? null };
  if (!text.trim() && !media) return { status: "ignorado", reason: "mensagem sem conteúdo suportado" };
  // Telefone: @lid não traz o número; usa o alternativo quando o provedor envia (remoteJidAlt).
  const lidOnly = jid.endsWith("@lid") && !e.payload.jidAlt;
  const phone = lidOnly ? "" : (jid.endsWith("@lid") ? e.payload.jidAlt! : jid).split("@")[0];
  const at = e.provider_ts ?? e.received_at;

  // Conversa do escritório por telefone (últimos 11 dígitos) ou pelo jid; cria se não existir.
  const { data: convs } = await db.from("org_records").select("id,data").eq("organization_id", org).eq("collection", "conversations");
  let conv = (convs ?? []).find((c) => { const d = c.data as { phone?: string; jid?: string }; return d.jid === jid || (!!phone && digits(String(d.phone ?? "")) === digits(phone)); });
  if (!conv) {
    const id = `conv-${crypto.createHash("sha256").update(`${org}:${jid}`).digest("hex").slice(0, 16)}`; // determinístico: corrida não duplica
    const data = { id, organizationId: org, contactName: e.payload.pushName || (phone ? `+${phone}` : "Contato do WhatsApp"), phone: phone ? `+${phone}` : "", jid, channel: "whatsapp", status: "aguardando_equipe", aiActive: false, unread: 0, lastMessageAt: at, summary: "", missingDocs: [] };
    const { error } = await db.from("org_records").insert({ organization_id: org, collection: "conversations", id, data });
    if (error && error.code !== "23505") throw new Error(`conversa não criada: ${error.message}`);
    conv = { id, data };
  }
  const mid = `wa-${e.provider_id}`.slice(0, 200);
  const shown = text.trim() || `[${media} recebido — abra no WhatsApp do escritório; esta versão mostra só o aviso]`;
  if (e.from_me) {
    // Mensagem enviada pelo próprio aparelho do escritório (fora do painel) ou eco de envio nosso.
    const { data: mine } = await db.from("org_records").select("id").eq("organization_id", org).eq("collection", "messages").contains("data", { providerId: e.provider_id }).limit(1);
    if (mine?.length) return { status: "ignorado", reason: "eco de envio da LexSion" };
    // Corrida: o eco pode chegar antes de gravarmos o id do provedor. Envio da LexSion em andamento com o mesmo
    // texto nos últimos 2 min é eco (não suspende a IA nem duplica).
    const { data: pend } = await db.from("org_records").select("id,data").eq("organization_id", org).eq("collection", "messages").contains("data", { conversationId: conv.id, status: "enviando" }).limit(20);
    if ((pend ?? []).some((p) => { const d = p.data as { text?: string; at?: string }; return d.text === shown && Date.now() - Date.parse(d.at ?? "") < 120_000; })) return { status: "ignorado", reason: "eco de envio da LexSion (antes do id)" };
    await db.from("org_records").insert({ organization_id: org, collection: "messages", id: mid, data: { id: mid, organizationId: org, conversationId: conv.id, author: "equipe", text: shown.slice(0, 4000), at, status: "enviada", providerId: e.provider_id, viaPhone: true } }).then(() => null);
    // Regra: resposta humana pelo aparelho suspende a IA nesta conversa (não é gatilho de IA).
    await db.from("conversation_control").upsert({ organization_id: org, conversation_id: conv.id, mode: "humano", updated_at: new Date().toISOString() }, { onConflict: "organization_id,conversation_id" });
    await db.from("ai_jobs").update({ status: "cancelado", reason: "resposta humana pelo aparelho", finished_at: new Date().toISOString() }).eq("organization_id", org).eq("conversation_id", conv.id).in("status", ["pendente", "gerando", "erro"]);
    return { status: "feito" };
  }
  const { error } = await db.from("org_records").insert({ organization_id: org, collection: "messages", id: mid, data: { id: mid, organizationId: org, conversationId: conv.id, author: "contato", text: shown.slice(0, 4000), at, media } });
  if (error && error.code !== "23505") throw new Error(`mensagem não gravada: ${error.message}`);
  if (error?.code === "23505") return { status: "ignorado", reason: "mensagem já registrada" };
  const c = conv.data as Record<string, unknown> & { unread?: number; lastMessageAt?: string };
  // Fora de ordem: só avança lastMessageAt se esta mensagem for mais nova.
  await db.from("org_records").update({ data: { ...c, unread: (c.unread ?? 0) + 1, lastMessageAt: !c.lastMessageAt || at > c.lastMessageAt ? at : c.lastMessageAt, status: c.status === "ia" ? "ia" : "aguardando_equipe" } }).eq("organization_id", org).eq("collection", "conversations").eq("id", conv.id);

  // IA: só se o escritório habilitou, a conversa está em modo IA e há texto. Debounce de 8 s (mensagens seguidas).
  const { data: o } = await db.from("organizations").select("ai_enabled_at,status").eq("id", org).single();
  const aiOn = !!o?.ai_enabled_at && ["ativa", "trial"].includes(o.status);
  let { data: ctl } = await db.from("conversation_control").select("mode,version,is_group").eq("organization_id", org).eq("conversation_id", conv.id).maybeSingle();
  if (!ctl) {
    // Conversa nova: começa com a assistente só se o titular habilitou a IA e há assistente publicada; senão, humano.
    const { data: ags } = aiOn ? await db.from("org_records").select("id").eq("organization_id", org).eq("collection", "agents").contains("data", { status: "publicado" }).limit(1) : { data: [] };
    await db.from("conversation_control").upsert({ organization_id: org, conversation_id: conv.id, mode: ags?.length ? "ia" : "humano" }, { onConflict: "organization_id,conversation_id", ignoreDuplicates: true });
    ({ data: ctl } = await db.from("conversation_control").select("mode,version,is_group").eq("organization_id", org).eq("conversation_id", conv.id).maybeSingle());
  }
  if (!ctl || ctl.mode !== "ia" || ctl.is_group || !text.trim() || !aiOn) return { status: "feito", aiJob: null };
  await db.from("ai_jobs").update({ status: "cancelado", reason: "nova mensagem do contato (agrupada)", finished_at: new Date().toISOString() }).eq("organization_id", org).eq("conversation_id", conv.id).eq("status", "pendente");
  const { data: job } = await db.from("ai_jobs").insert({ organization_id: org, conversation_id: conv.id, trigger_message_id: mid, control_version: ctl.version, run_after: new Date(Date.now() + 8_000).toISOString() }).select("id").maybeSingle();
  return { status: "feito", aiJob: (job?.id as number | undefined) ?? null };
}

/** Processa os eventos pendentes (ordem de chegada). Chamado pelo webhook (após gravar) e pelo cron (retry). */
export async function drainEvents(org?: string, limit = 50) {
  const db = supabaseAdmin();
  let q = db.from("wa_events").select("*").in("status", ["pendente", "erro"]).lt("attempts", 5).order("received_at").limit(limit);
  if (org) q = q.eq("organization_id", org);
  const { data } = await q;
  const out = { feitos: 0, ignorados: 0, erros: 0 };
  for (const e of (data ?? []) as Ev[]) {
    const { data: got } = await db.from("wa_events").update({ status: "processando", attempts: e.attempts + 1 }).eq("id", e.id).in("status", ["pendente", "erro"]).select("id").maybeSingle();
    if (!got) continue; // outro processador pegou
    try {
      const r = await processEvent(e);
      await db.from("wa_events").update({ status: r.status, reason: r.reason ?? null, processed_at: new Date().toISOString() }).eq("id", e.id);
      if (r.status === "feito") out.feitos++; else out.ignorados++;
    } catch (err) {
      await db.from("wa_events").update({ status: "erro", reason: (err as Error).message.slice(0, 300) }).eq("id", e.id);
      out.erros++;
    }
  }
  return out;
}
