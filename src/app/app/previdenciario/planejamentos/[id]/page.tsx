"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

// Planejamento é uma análise com modalidade "planejamento": mesma tela, URL própria.
export default function PlanejamentoPage({ params }: PageProps<"/app/previdenciario/planejamentos/[id]">) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/app/previdenciario/analises/${id}`);
  }, [id, router]);
  return <p className="p-6 text-fg-muted">Abrindo planejamento…</p>;
}
