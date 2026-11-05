import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Atualizações das séries oficiais posteriores ao arquivo versionado (o navegador sobrepõe com withUpdates).
// Leitura pela sessão do usuário (RLS: qualquer membro autenticado). Dado público, sem informação de escritório.
export async function GET() {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: { message: "Sessão expirada." } }, { status: 401 });
  const { data } = await sb.from("official_series").select("series,month,value").gte("month", "2025-01").order("month");
  return NextResponse.json({ ok: true, rows: data ?? [] }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
