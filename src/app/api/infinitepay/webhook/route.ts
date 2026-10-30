import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { confirmOrder, flagReversal } from "@/lib/billing";

// Aviso da InfinitePay. NÃO é assinado: só dispara a conferência no /payment_check. Corpo idêntico repetido é
// registrado uma vez. Responde 200 quando processou (ou não há o que fazer) e 400 quando deve ser reenviado.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 20_000) return new NextResponse(null, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return new NextResponse(null, { status: 400 });
  const orderNsu = typeof body.order_nsu === "string" ? body.order_nsu.slice(0, 80) : "";
  const tx = typeof body.transaction_nsu === "string" ? body.transaction_nsu.slice(0, 80) : "";
  const slug = typeof body.invoice_slug === "string" ? body.invoice_slug.slice(0, 80) : typeof body.slug === "string" ? body.slug.slice(0, 80) : "";
  const event = typeof body.event === "string" ? body.event : typeof body.type === "string" ? body.type : "paid";
  const db = supabaseAdmin();
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const { error: dup } = await db.from("saas_webhook_events").insert({ order_nsu: orderNsu || null, body_sha256: hash, body: { ...body, customer: undefined } });
  const repeated = dup?.code === "23505";
  if (!orderNsu.startsWith("lx-")) return NextResponse.json({ ok: true, ignored: "pedido de outra origem" });
  if (/refund|cancel|chargeback/i.test(event)) { if (!repeated) await flagReversal(orderNsu, event); return NextResponse.json({ ok: true }); }
  if (/fail/i.test(event)) return NextResponse.json({ ok: true });
  if (!tx || !slug) return NextResponse.json({ ok: true, ignored: "aviso sem transação" });
  try {
    const r = await confirmOrder(orderNsu, tx, slug, "webhook", { receipt_url: typeof body.receipt_url === "string" ? body.receipt_url.slice(0, 300) : undefined });
    await db.from("saas_webhook_events").update({ outcome: r.ok ? "confirmado" : `recusado: ${r.reason}` }).eq("body_sha256", hash);
    return NextResponse.json({ ok: true });
  } catch {
    // payment_check fora do ar: 400 pede reenvio (a InfinitePay tenta de novo); o cron diário também reconsulta.
    await db.from("saas_webhook_events").update({ outcome: "erro: conferência indisponível" }).eq("body_sha256", hash);
    return new NextResponse(null, { status: 400 });
  }
}
