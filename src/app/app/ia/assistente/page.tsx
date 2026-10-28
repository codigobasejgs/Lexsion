"use client";

import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/ui";
import { useSession } from "@/components/providers";
import { AiAssistant, AiConsent } from "@/modules/integrations/real-panels";

// Assistente de IA REAL (Gemini pelo servidor). Na demonstração, use "Simulador de agentes".
export default function AssistentePage() {
  const { mode } = useSession();
  return (
    <Guard area="ia">
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader title="Assistente de IA" description="Resumos, respostas, triagem e rascunhos. Toda saída é sugestão para revisão de um profissional; nada é enviado ao cliente automaticamente." />
        {mode === "real" ? <><AiConsent /><AiAssistant /></> : <p className="panel p-4 text-sm">Na demonstração, o assistente usa respostas fixas: abra <a className="text-accent underline" href="/app/ia/simulador">Simulador de agentes</a>.</p>}
      </div>
    </Guard>
  );
}
