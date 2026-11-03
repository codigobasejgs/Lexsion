"use client";

import { PageHeader } from "@/components/ui";
import { useLive } from "@/modules/shared";
import { DataLifecycle } from "@/modules/admin/data-lifecycle";

// Dados e LGPD da plataforma (operação real): eliminação assistida após 90 dias e registro de incidentes.
export default function DadosPage() {
  const live = useLive();
  return (
    <div className="space-y-5">
      <PageHeader title="Dados e LGPD" description="Eliminação assistida de escritórios encerrados e registro de incidentes de segurança." />
      {live ? <DataLifecycle /> : <p className="panel p-5 text-sm">Disponível só na operação real.</p>}
    </div>
  );
}
