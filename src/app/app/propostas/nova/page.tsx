"use client";

import { useRouter } from "next/navigation";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/ui";
import { ProposalForm } from "@/modules/commercial/proposal-form";

export default function NovaPropostaPage() {
  const router = useRouter();
  return (
    <Guard area="propostas">
      <div className="mx-auto max-w-3xl">
        <PageHeader breadcrumb={[{ href: "/app/propostas", label: "Propostas" }]} title="Nova proposta" description="Honorários com base e percentual explícitos. Nada é enviado de verdade." />
        <div className="panel p-5"><ProposalForm onSaved={(p) => router.push(`/app/propostas/${p.id}`)} /></div>
      </div>
    </Guard>
  );
}
