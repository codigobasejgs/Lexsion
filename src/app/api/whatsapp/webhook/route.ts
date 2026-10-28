import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sha } from "@/lib/evolution";

// Webhook da Evolution para UM escritório. Autenticação: segredo por escritório (só o hash fica no banco),
// comparado em tempo constante. Evento de instância que não é deste escritório é ignorado. Idempotente pelo id da mensagem.
type Evo = { event?: string; instance?: string; data?: { key?: { id?: string; remoteJid?: string; fromMe?: boolean }; pushName?: string; message?: { conversation?: string; extendedTextMessage?: { text?: string } }; messageTimestamp?: number; state?: string } };
const ok = () => NextResponse.json({ ok: true });

export async function POST(req: NextRequest) {
  const org = req.nextUrl.searchParams.get("org") ?? "";
  const secret = req.nextUrl.searchParams.get("s") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(org) || secret.length < 20) return new NextResponse(null, { status: 401 });
  const admin = supabaseAdmin();
  const { data: inst } = await admin.from("whatsapp_instances").select("instance_name,webhook_secret_hash").eq("organization_id", org).maybeSingle();
  const a = Buffer.from(inst?.webhook_secret_hash ?? "0".repeat(64)), b = Buffer.from(sha(secret));
  if (!inst || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new NextResponse(null, { status: 401 });
  const ev = (await req.json().catch(() => null)) as Evo | null;
  if (!ev || ev.instance !== inst.instance_name) return ok();
  const event = String(ev.event ?? "").toLowerCase().replace(/_/g, ".");

  if (event === "connection.update") {
    const st = ev.data?.state;
    const status = st === "open" ? "operacional" : st === "connecting" ? "conectando" : "desconectado";
    await admin.from("whatsapp_instances").update({ status, updated_at: new Date().toISOString() }).eq("organization_id", org);
    return ok();
  }
  if (event !== "messages.upsert") return ok();
  const k = ev.data?.key;
  const jid = String(k?.remoteJid ?? "");
  if (!k?.id || k.fromMe || !jid.endsWith("@s.whatsapp.net")) return ok(); // ignora grupos, status e as próprias
  const text = ev.data?.message?.conversation ?? ev.data?.message?.extendedTextMessage?.text ?? "";
  if (!text.trim()) return ok(); // mídia: fase seguinte (download + Storage)
  const phone = jid.split("@")[0];
  const at = ev.data?.messageTimestamp ? new Date(ev.data.messageTimestamp * 1000).toISOString() : new Date().toISOString();

  // Conversa do escritório por telefone (últimos 11 dígitos); cria se não existir.
  const { data: convs } = await admin.from("org_records").select("id,data").eq("organization_id", org).eq("collection", "conversations");
  const digits = (s: string) => s.replace(/\D/g, "").slice(-11);
  let conv = (convs ?? []).find((c) => digits(String((c.data as { phone?: string }).phone ?? "")) === digits(phone));
  if (!conv) {
    const id = `conv-${crypto.randomUUID().slice(0, 12)}`;
    const data = { id, organizationId: org, contactName: String(ev.data?.pushName ?? "").slice(0, 120) || `+${phone}`, phone: `+${phone}`, channel: "whatsapp", status: "aguardando_equipe", aiActive: false, unread: 0, lastMessageAt: at, summary: "", missingDocs: [], tags: [] };
    await admin.from("org_records").insert({ organization_id: org, collection: "conversations", id, data });
    conv = { id, data };
  }
  const mid = `wa-${k.id}`.slice(0, 200);
  const { error } = await admin.from("org_records").insert({ organization_id: org, collection: "messages", id: mid, data: { id: mid, organizationId: org, conversationId: conv.id, author: "contato", text: text.slice(0, 4000), at, status: "entregue" } });
  if (error && error.code === "23505") return ok(); // reentrega do mesmo evento
  const c = conv.data as { unread?: number };
  await admin.from("org_records").update({ data: { ...(conv.data as object), unread: (c.unread ?? 0) + 1, lastMessageAt: at, status: "aguardando_equipe" } }).eq("organization_id", org).eq("collection", "conversations").eq("id", conv.id);
  return ok();
}
