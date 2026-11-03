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
  // Alerta só quando a fonte está REALMENTE fora: 2 falhas seguidas (≥ 6 h sem coleta). Um 504 isolado da Câmara
  // se resolve na execução seguinte e não justifica e-mail (a dedup de 12 h continua em opsAlert).
  const failed = [["Câmara", camara], ["Senado", senado]].filter(([, r]) => (r as { status: string; consecutiveFailures?: number }).status === "erro" && ((r as { consecutiveFailures?: number }).consecutiveFailures ?? 0) >= 2).map(([n]) => n);
  if (failed.length) await opsAlert(`Fonte jurídica sem coleta: ${failed.join(", ")}`, `A coleta automática falhou duas vezes seguidas em ${failed.join(" e ")} (mais de 6 horas sem coleta). O último dado íntegro continua no ar; o painel mostra o erro e a próxima tentativa é automática.`).catch(() => false);
  return NextResponse.json({ ok: true, at: new Date().toISOString(), camara, senado });
}
