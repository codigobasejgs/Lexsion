import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { caudit, sha256 } from "@/lib/saas-contract-server";

// Titular baixa o PDF aceito do PRÓPRIO escritório. A leitura passa pela RLS com a sessão do pedinte (só titular
// do escritório dono do contrato enxerga a linha); o arquivo vem do bucket privado e é conferido pelo SHA-256.
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") && new URL(req.headers.get("origin")!).host !== req.headers.get("host")) return NextResponse.json({ ok: false }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { number?: string };
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: { message: "Sessão expirada." } }, { status: 401 });
  const { data: c } = await sb.from("saas_contracts").select("id,number").eq("number", String(b.number ?? "")).maybeSingle();
  if (!c) return NextResponse.json({ ok: false, error: { message: "Contrato não encontrado." } }, { status: 404 });
  const db = supabaseAdmin();
  const { data: f } = await db.from("saas_contract_files").select("storage_path,sha256").eq("contract_id", c.id).eq("kind", "contrato_aceito").maybeSingle();
  if (!f) return NextResponse.json({ ok: false, error: { message: "PDF ainda não disponível." } }, { status: 404 });
  const { data: blob } = await db.storage.from("contratos-saas").download(f.storage_path);
  const buf = Buffer.from(await blob!.arrayBuffer());
  if (sha256(buf) !== f.sha256) return NextResponse.json({ ok: false, error: { message: "Falha de integridade do arquivo." } }, { status: 500 });
  await caudit(c.id, "contrato.baixado_titular", "download pelo titular", auth.user.id);
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="contrato-lexsion-${c.number}.pdf"`, "Cache-Control": "no-store" } });
}
