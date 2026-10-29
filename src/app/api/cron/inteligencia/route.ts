import { NextResponse, type NextRequest } from "next/server";
import { syncSource } from "@/lib/legal-intel/sync";
import { opsAlert } from "@/lib/ops-alert";

// Agendador ÚNICO: Vercel Cron chama esta rota (vercel.json). Autenticação por CRON_SECRET no cabeçalho
// (padrão da Vercel); sem segredo, recusa. Plano Hobby da Vercel: no máximo 1 execução por dia; a frequência
// configurada por fonte vale para execuções manuais/externas autenticadas.
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24 || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  // Em sequência (não em paralelo): cada fonte tem sua trava, e o limite de tempo da função é compartilhado.
  const camara = await syncSource("camara-proposicoes", "cron");
  const senado = await syncSource("senado-materias", "cron");
  const failed = [["Câmara", camara], ["Senado", senado]].filter(([, r]) => (r as { status: string }).status === "erro").map(([n]) => n);
  if (failed.length) await opsAlert(`Fonte jurídica sem coleta: ${failed.join(", ")}`, `A coleta automática falhou em ${failed.join(" e ")}. O último dado íntegro continua no ar; o painel mostra o erro.`).catch(() => false);
  return NextResponse.json({ ok: true, at: new Date().toISOString(), camara, senado });
}
