import { NextResponse, type NextRequest } from "next/server";
import { syncOfficial } from "@/lib/official-sources";
import { opsAlert } from "@/lib/ops-alert";

// Fontes oficiais (BCB e STJ), 1×/dia pelo pg_cron (Vault). Sem segredo, recusa.
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 24 || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse(null, { status: 401 });
  const out = await syncOfficial("cron");
  const failed = Object.entries(out).filter(([, r]) => (r as { status: string }).status === "erro").map(([k]) => k);
  if (failed.length) await opsAlert(`Fonte oficial sem coleta: ${failed.join(", ")}`, "A coleta diária falhou. Os cálculos continuam com a última tabela íntegra; a próxima tentativa é automática.").catch(() => false);
  return NextResponse.json({ ok: true, at: new Date().toISOString(), ...out });
}
