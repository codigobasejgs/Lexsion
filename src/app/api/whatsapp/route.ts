import crypto from "node:crypto";
import { sha } from "@/lib/evolution";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { connectionState, createOrConnect, evolutionConfigured, instanceFor, logout, sendText } from "@/lib/evolution";

const err = (status: number, code: string, message: string) => NextResponse.json({ ok: false, error: { code, message } }, { status });
type Body = { organizationId?: string; action?: "status" | "connect" | "disconnect" | "send"; conversationId?: string; messageId?: string };

/**
 * WhatsApp do escritório (Evolution). Toda ação confere com a sessão do PEDINTE (RLS) o vínculo e o papel.
 * Conectar/desconectar: titular. Enviar: quem atende (admin, gestor, advogado, atendimento), só de conversa do próprio escritório
 * com a IA pausada e mensagem já gravada (a tela grava; aqui só despacha e marca enviada/erro). Nunca envia em massa.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !evolutionConfigured()) return err(503, "not_configured", "WhatsApp não configurado neste ambiente.");
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return err(403, "origin", "Origem não permitida.");
  const b = ((await req.json().catch(() => null)) ?? {}) as Body;
  if (!b.organizationId || !b.action) return err(400, "invalid", "Pedido inválido.");
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return err(401, "unauthenticated", "Sessão expirada. Entre novamente.");
  const { data: me } = await sb.from("organization_memberships").select("role").eq("organization_id", b.organizationId).eq("user_id", auth.user.id).maybeSingle();
  const { data: org } = await sb.from("organizations").select("slug,status").eq("id", b.organizationId).maybeSingle();
  if (!me || !org || !["ativa", "trial"].includes(org.status)) return err(403, "forbidden", "Sem acesso a este escritório.");
  const admin = supabaseAdmin();
  const instance = instanceFor(org.slug);

  if (b.action === "status") {
    const st = await connectionState(instance);
    const status = st === "open" ? "operacional" : st === "connecting" ? "conectando" : st === "missing" ? "desconectado" : st === "close" ? "desconectado" : "erro";
    await admin.from("whatsapp_instances").update({ status, updated_at: new Date().toISOString() }).eq("organization_id", b.organizationId);
    return NextResponse.json({ ok: true, data: { status, instance } });
  }
  if (b.action === "connect" || b.action === "disconnect") {
    if (me.role !== "admin") return err(403, "forbidden", "Somente o titular conecta ou desconecta o WhatsApp do escritório.");
    if (b.action === "disconnect") {
      await logout(instance);
      await admin.from("whatsapp_instances").update({ status: "desconectado", updated_at: new Date().toISOString() }).eq("organization_id", b.organizationId);
      return NextResponse.json({ ok: true, data: { status: "desconectado" } });
    }
    // Segredo do webhook: só o hash fica no banco; o segredo vai na URL do webhook registrada na Evolution.
    const secret = crypto.randomBytes(24).toString("base64url");
    const proto = req.headers.get("host")?.startsWith("localhost") ? "http" : "https";
    const hook = `${proto}://${req.headers.get("host")}/api/whatsapp/webhook?org=${b.organizationId}&s=${secret}`;
    const { data: existing } = await admin.from("whatsapp_instances").select("webhook_secret_hash").eq("organization_id", b.organizationId).maybeSingle();
    const r = await createOrConnect(instance, hook);
    if (!r.ok) return err(502, "evolution", `O servidor do WhatsApp recusou a conexão (${r.error}).`);
    if (!existing) await admin.from("whatsapp_instances").insert({ organization_id: b.organizationId, instance_name: instance, status: "conectando", webhook_secret_hash: sha(secret) });
    else await admin.from("whatsapp_instances").update({ status: "conectando", updated_at: new Date().toISOString() }).eq("organization_id", b.organizationId);
    // Instância já existente mantém o webhook e o segredo registrados na criação.
    await admin.from("audit_logs").insert({ organization_id: b.organizationId, actor_id: auth.user.id, action: "whatsapp.connect", entity: "whatsapp_instances", entity_id: instance, detail: existing ? "Novo QR solicitado" : "Instância criada; aguardando leitura do QR" });
    return NextResponse.json({ ok: true, data: { status: "conectando", qr: r.qr } });
  }
  if (b.action === "send") {
    if (!["admin", "tenant_admin", "advogado", "atendimento"].includes(me.role)) return err(403, "forbidden", "Seu perfil não envia mensagens.");
    if (!b.conversationId || !b.messageId) return err(400, "invalid", "Mensagem inválida.");
    // Leitura com a sessão do pedinte: a RLS garante que a conversa e a mensagem são do escritório dele.
    const [{ data: conv }, { data: msg }] = await Promise.all([
      sb.from("org_records").select("data,version").eq("organization_id", b.organizationId).eq("collection", "conversations").eq("id", b.conversationId).maybeSingle(),
      sb.from("org_records").select("data,version").eq("organization_id", b.organizationId).eq("collection", "messages").eq("id", b.messageId).maybeSingle(),
    ]);
    const c = conv?.data as { phone?: string; aiActive?: boolean; consentWhatsapp?: boolean } | undefined;
    const m = msg?.data as { text?: string; status?: string; author?: string; conversationId?: string } | undefined;
    if (!c || !m || m.conversationId !== b.conversationId || m.author !== "equipe") return err(404, "not_found", "Conversa ou mensagem não encontrada.");
    if (c.aiActive) return err(409, "ai_active", "Assuma o atendimento antes de responder.");
    if (m.status === "enviada" || m.status === "entregue" || m.status === "lida") return NextResponse.json({ ok: true, data: { status: m.status, duplicate: true } }); // idempotente
    const number = String(c.phone ?? "").replace(/\D/g, "");
    if (!/^55\d{10,11}$/.test(number.length <= 11 ? `55${number}` : number)) return err(400, "phone", "Telefone do contato inválido.");
    if ((await connectionState(instance)) !== "open") return err(409, "disconnected", "WhatsApp do escritório desconectado. A mensagem ficou na fila.");
    const s = await sendText(instance, number.length <= 11 ? `55${number}` : number, String(m.text).slice(0, 4000));
    const next = { ...m, status: s.ok ? "enviada" : "erro", providerId: s.ok ? s.id : undefined };
    await admin.from("org_records").update({ data: next }).eq("organization_id", b.organizationId).eq("collection", "messages").eq("id", b.messageId);
    return s.ok ? NextResponse.json({ ok: true, data: { status: "enviada" } }) : err(502, "send_failed", "O WhatsApp não aceitou a mensagem. Ela ficou marcada com erro para reenviar.");
  }
  return err(400, "invalid", "Ação desconhecida.");
}

