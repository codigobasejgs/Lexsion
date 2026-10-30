"use client";

import { PageHeader } from "@/components/ui";
import { useLive } from "@/modules/shared";
import { SaasContracts } from "@/modules/admin/contracts";

// Contratos SaaS (LexSion ⇄ escritórios). Só operação real; a demonstração não tem contratos reais.
export default function ContratosPage() {
  const live = useLive();
  return (
    <>
      <PageHeader title="Contratos SaaS" description="Contratos entre a LexSion e os escritórios: modelos com aprovação jurídica, aceite comprovado e PDFs. Não inclui os contratos que os escritórios firmam com os próprios clientes." />
      {live ? <SaasContracts /> : <p className="panel p-5 text-sm text-fg-muted">Na demonstração não há contratos reais. Contratos SaaS existem só na operação, com aceite comprovado.</p>}
    </>
  );
}
