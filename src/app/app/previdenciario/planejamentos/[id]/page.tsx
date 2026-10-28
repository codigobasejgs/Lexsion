"use client";

import { use } from "react";
import { PensionAnalysisView } from "../../analises/[id]/page";

// Planejamento é uma análise com modalidade "planejamento": mesma tela, URL própria.
// Antes redirecionava no cliente; a tela intermediária "Abrindo planejamento…" deixava o teste intermitente (baseline 1/261).
export default function PlanejamentoPage({ params }: PageProps<"/app/previdenciario/planejamentos/[id]">) {
  return <PensionAnalysisView id={use(params).id} />;
}
