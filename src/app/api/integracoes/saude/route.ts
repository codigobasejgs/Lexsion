import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aiEnabled, whatsappEnabled } from "@/lib/feature-gates";
import { connectionState, evolutionConfigured, instanceFor } from "@/lib/evolution";

// Saúde REAL das integrações para o escritório da sessão (nada de catálogo fixo): cada item diz o estado verificado
// agora, o que falta e quem resolve. Nunca devolve chave, URL de servidor ou segredo.
export const dynamic = "force-dynamic";
type Item = { id: string; name: string; owner: "plataforma" | "escritorio"; state: "operacional" | "pendente_escritorio" | "desligada" | "nao_contratada" | "erro"; detail: string; action?: string; href?: string };

export async function GET(req: Request) {
  const org = new URL(req.url).searchParams.get("org") ?? "";
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: me } = await sb.from("organization_memberships").select("role").eq("organization_id", org).eq("user_id", auth.user.id).maybeSingle();
  if (!me) return NextResponse.json({ ok: false }, { status: 403 });
  const db = supabaseAdmin();
  const [{ data: o }, { data: inst }, { data: agents }, { data: lastBackup }] = await Promise.all([
    db.from("organizations").select("slug,ai_enabled_at").eq("id", org).single(),
    db.from("whatsapp_instances").select("status,updated_at").eq("organization_id", org).maybeSingle(),
    db.from("org_records").select("data").eq("organization_id", org).eq("collection", "agents"),
    db.from("audit_logs").select("at").eq("action", "backup.ok").order("at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { data: creds } = await db.from("org_credentials").select("provider,status").eq("organization_id", org);
  const cred = (id: string) => (creds ?? []).find((c) => c.provider === id)?.status as string | undefined;
  const published = (agents ?? []).some((a) => (a.data as { status?: string }).status === "publicado");
  let wa: Item;
  if (!whatsappEnabled()) wa = { id: "evolution", name: "WhatsApp (Evolution)", owner: "plataforma", state: "desligada", detail: "A LexSion ainda não liberou o WhatsApp na plataforma. Nada é recebido nem enviado." };
  else if (!evolutionConfigured()) wa = { id: "evolution", name: "WhatsApp (Evolution)", owner: "plataforma", state: "erro", detail: "Servidor de WhatsApp sem configuração na plataforma. A LexSion foi avisada." };
  else {
    const st = inst ? await connectionState(instanceFor(o!.slug)) : "missing";
    wa = st === "open" ? { id: "evolution", name: "WhatsApp (Evolution)", owner: "escritorio", state: "operacional", detail: "Número conectado. Mensagens de contatos individuais entram em Conversas." }
      : st === "erro" ? { id: "evolution", name: "WhatsApp (Evolution)", owner: "plataforma", state: "erro", detail: "O servidor de WhatsApp não respondeu agora. Tente de novo em instantes." }
      : { id: "evolution", name: "WhatsApp (Evolution)", owner: "escritorio", state: "pendente_escritorio", detail: st === "connecting" ? "Aguardando a leitura do QR no celular do escritório." : "Número ainda não conectado.", action: "Gerar QR e conectar", href: "/app/integracoes/evolution" };
  }
  const ia: Item = !aiEnabled() ? { id: "gemini", name: "Assistente de IA (Gemini)", owner: "plataforma", state: "desligada", detail: "A LexSion ainda não liberou a IA na plataforma." }
    : !o?.ai_enabled_at ? { id: "gemini", name: "Assistente de IA (Gemini)", owner: "escritorio", state: "pendente_escritorio", detail: "O titular ainda não habilitou a IA para o escritório.", action: "Habilitar IA", href: "/app/integracoes/gemini" }
    : !published ? { id: "gemini", name: "Assistente de IA (Gemini)", owner: "escritorio", state: "pendente_escritorio", detail: "IA habilitada. Falta publicar uma assistente para responder no WhatsApp (o assistente de sugestões já funciona).", action: "Criar assistente", href: "/app/ia/agentes" }
    : { id: "gemini", name: "Assistente de IA (Gemini)", owner: "escritorio", state: "operacional", detail: `IA habilitada e assistente publicada${cred("gemini") === "verificada" ? ", com a chave Google do escritório" : ", com a chave da LexSion"}.` };
  if (ia.state !== "desligada" && cred("gemini") === "recusada") Object.assign(ia, { state: "erro", detail: "A chave Google do escritório foi recusada no último teste. Corrija em Contas do escritório (abaixo).", action: undefined, href: undefined });
  const keyItem = (id: "zapsign" | "pagamentos", name: string, providers: string[], none: string): Item => {
    const st = providers.map(cred).find(Boolean);
    return st === "recusada" ? { id, name, owner: "escritorio", state: "erro", detail: "A chave do escritório foi recusada no último teste. Corrija em Contas do escritório." }
      : st ? { id, name, owner: "escritorio", state: "nao_contratada", detail: "Conta do escritório conectada e testada. O uso dentro da LexSion (emitir/assinar) ainda não está implementado nesta versão." }
      : { id, name, owner: "escritorio", state: "nao_contratada", detail: none };
  };
  const items: Item[] = [
    wa, ia,
    { id: "resend", name: "E-mail (Resend)", owner: "plataforma", state: process.env.RESEND_API_KEY ? "operacional" : "erro", detail: process.env.RESEND_API_KEY ? "Convites, recuperação de senha e avisos da plataforma." : "E-mail da plataforma sem configuração." },
    { id: "backup", name: "Backup cifrado", owner: "plataforma", state: lastBackup && Date.now() - Date.parse(lastBackup.at) < 36 * 3_600_000 ? "operacional" : "erro", detail: lastBackup ? `Último backup conferido: ${new Date(lastBackup.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` : "Nenhum backup registrado." },
    { id: "fontes", name: "Câmara e Senado (Jornal)", owner: "plataforma", state: "operacional", detail: "Coleta automática a cada 3 horas.", href: "/app/jornal" },
    keyItem("zapsign", "Assinatura eletrônica (ZapSign)", ["zapsign"], "Cadastre o token em Contas do escritório. Emitir assinatura pela LexSion ainda não está implementado nesta versão."),
    keyItem("pagamentos", "Cobrança online (Asaas, InfinitePay, Mercado Pago)", ["asaas", "mercadopago", "infinitepay"], "Cadastre a conta em Contas do escritório. Emitir cobrança pela LexSion ainda não está implementado; parcelas e baixas manuais funcionam no Financeiro."),
  ];
  return NextResponse.json({ ok: true, items, canManage: me.role === "admin" }, { headers: { "Cache-Control": "no-store" } });
}
