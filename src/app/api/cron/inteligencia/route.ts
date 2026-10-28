import { NextResponse, type NextRequest } from "next/server";
import { syncCamara } from "@/lib/legal-intel/sync";

// Agendador ÚNICO: Vercel Cron chama esta rota (vercel.json). Autenticação por CRON_SECRET no cabeçalho
// (padrão da Vercel); sem segredo, recusa. Plano Hobby da Vercel: no máximo 1 execução por dia; a frequência
// configurada por fonte vale para execuções manuais/externas autenticadas.
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24 || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  const camara = await syncCamara("cron");
  return NextResponse.json({ ok: true, at: new Date().toISOString(), camara });
}
