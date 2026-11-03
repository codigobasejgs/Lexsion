import crypto from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sha } from "@/lib/evolution";
import { whatsappEnabled } from "@/lib/feature-gates";
import { drainEvents, recordEvent, type Evo } from "@/lib/wa-inbox";
import { drainJobs } from "@/lib/wa-ai";

// Webhook da Evolution para UM escritório. Autenticação: segredo por escritório (só o hash fica no banco),
// comparado em tempo constante. O evento é GRAVADO (deduplicado) antes do 200; o processamento roda depois da resposta
// (after) e, se falhar, o cron de atendimento repete. Grupo/status/broadcast/próprias nunca disparam IA (wa-inbox).
export const maxDuration = 60;
const ok = () => NextResponse.json({ ok: true });

export async function POST(req: NextRequest) {
  if (!whatsappEnabled()) return new NextResponse(null, { status: 503 }); // integração desligada: nada é gravado
  const org = req.nextUrl.searchParams.get("org") ?? "";
  const secret = req.nextUrl.searchParams.get("s") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(org) || secret.length < 20) return new NextResponse(null, { status: 401 });
  const admin = supabaseAdmin();
  const { data: inst } = await admin.from("whatsapp_instances").select("instance_name,webhook_secret_hash").eq("organization_id", org).maybeSingle();
  const a = Buffer.from(inst?.webhook_secret_hash ?? "0".repeat(64)), b = Buffer.from(sha(secret));
  if (!inst || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new NextResponse(null, { status: 401 });
  const ev = (await req.json().catch(() => null)) as Evo | null;
  if (!ev || ev.instance !== inst.instance_name) return ok();
  // Falha ao gravar ⇒ 500: a Evolution reenvia; o evento não se perde.
  const id = await recordEvent(org, inst.instance_name, ev).catch(() => undefined);
  if (id === undefined) return new NextResponse(null, { status: 500 });
  if (id !== null) after(async () => {
    await drainEvents(org);
    await new Promise((r) => setTimeout(r, 9_000)); // espera o debounce (8 s) das mensagens seguidas
    await drainJobs();
  });
  return ok();
}
