import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Busca em precedentes qualificados do STJ (dados abertos, CC-BY). Sempre devolve o link oficial: a citação em peça
// deve ser conferida no portal do tribunal. Nenhum texto é gerado aqui.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  const area = (req.nextUrl.searchParams.get("area") ?? "").trim().slice(0, 60);
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: { message: "Sessão expirada." } }, { status: 401 });
  if (q.length < 3 && !area) return NextResponse.json({ ok: true, items: [] });
  let query = sb.from("legal_precedents").select("id,court,kind,number,situation,question,thesis,legislation,judged_on,areas,official_url").limit(30);
  if (q.length >= 3) query = /^\d{1,5}$/.test(q) ? query.eq("number", q) : query.textSearch("search", q, { type: "websearch", config: "portuguese" });
  if (area) query = query.contains("areas", [area]);
  const { data, error } = await query.order("judged_on", { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ ok: false, error: { message: "Busca indisponível agora." } }, { status: 502 });
  const { data: prov } = await sb.from("legal_source_providers").select("last_success_at").eq("id", "stj-precedentes").maybeSingle();
  return NextResponse.json({ ok: true, items: data ?? [], updatedAt: prov?.last_success_at ?? null });
}
