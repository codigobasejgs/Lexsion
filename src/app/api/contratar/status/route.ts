import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { confirmOrder } from "@/lib/billing";

// Retorno do checkout (navegador). Os parâmetros da URL NÃO liberam nada sozinhos: viram uma consulta ao
// /payment_check. Resposta mínima (sem dados do titular): só o estado do pedido.
export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ ok: false, state: "desconhecido" }, { status: 503 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const order = String(b?.order_nsu ?? "").slice(0, 80), tx = String(b?.transaction_nsu ?? "").slice(0, 80), slug = String(b?.slug ?? "").slice(0, 80);
  if (!order.startsWith("lx-")) return NextResponse.json({ ok: false, state: "desconhecido" }, { status: 400 });
  let reason: string | undefined;
  if (tx && slug) {
    try { const r = await confirmOrder(order, tx, slug, "retorno", { capture_method: String(b?.capture_method ?? "").slice(0, 20) || undefined }); if (!r.ok) reason = r.reason; }
    catch { return NextResponse.json({ ok: true, state: "verificando", message: "Não foi possível confirmar com a InfinitePay agora. Se o pagamento foi feito, ele será confirmado automaticamente." }); }
  }
  const { data: o } = await supabaseAdmin().from("saas_orders").select("status,activation").eq("order_nsu", order).maybeSingle();
  if (!o) return NextResponse.json({ ok: false, state: "desconhecido" }, { status: 404 });
  const state = o.status === "pago" ? (o.activation === "concluida" ? "ativo" : o.activation === "falhou" ? "ativacao_pendente" : "ativando") : o.status;
  return NextResponse.json({ ok: true, state, ...(reason && o.status === "pendente" ? { message: "O pagamento ainda não foi confirmado pela InfinitePay." } : {}) });
}
