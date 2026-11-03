import { NextResponse } from "next/server";
import { aiEnabled, whatsappEnabled } from "@/lib/feature-gates";

// Estado das integrações que tratam dados de clientes (sem segredos): a tela mostra "em auditoria" quando desligadas.
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ ai: aiEnabled(), whatsapp: whatsappEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
