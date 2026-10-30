"use client";

import { use } from "react";
import Link from "next/link";
import { useLive } from "@/modules/shared";
import { Org360 } from "@/modules/admin/org-360";

// Ficha 360º do escritório: só na operação real (dados do banco). Na demonstração, volta para a lista.
export default function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const live = useLive();
  if (!live) return <p className="panel p-5 text-sm">A ficha detalhada existe só na operação real. <Link href="/admin/organizacoes" className="text-accent underline">Voltar</Link></p>;
  return <Org360 id={id} />;
}
