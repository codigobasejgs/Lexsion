"use client";

import { Badge, PageHeader } from "@/components/ui";
import { ALL_PROVIDERS } from "@/services/adapters";
import { INTEGRATION_STATUS_LABEL } from "@/domain/saas";

const CATEGORY: Record<string, string> = { dados: "Dados e login", mensagens: "Mensagens", email: "E-mail", pagamentos: "Pagamentos", assinatura: "Assinatura", armazenamento: "Arquivos", juridico: "Fontes jurídicas", ia: "Inteligência artificial" };

// Integrações globais da plataforma. Estado honesto: nenhum aparece "Ativo" sem backend e credenciais no servidor.
export default function IntegracoesGlobaisPage() {
  return (
    <>
      <PageHeader title="Integrações" description="Provedores preparados para a fase com backend. As credenciais ficarão somente no servidor; esta tela nunca mostra nem guarda chaves." />
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ALL_PROVIDERS.map((p) => (
          <li key={p.id} className="panel space-y-2 p-4 text-sm" data-testid={`provedor-${p.id}`}>
            <div className="flex items-start gap-2"><h2 className="flex-1 font-semibold">{p.name}</h2><Badge tone={p.status === "planned" ? "neutral" : "warning"}>{INTEGRATION_STATUS_LABEL[p.status]}</Badge></div>
            <p className="text-xs uppercase tracking-wider text-fg-muted">{CATEGORY[p.category]} · {p.owner === "platform" ? "contratado pela plataforma" : "configurado por escritório"}</p>
            <p className="text-fg-muted">{p.notes}</p>
            <p className="text-xs">Modo: <strong>{p.mode === "demo" ? "demonstração (simulado)" : "não configurado"}</strong></p>
            <details><summary className="cursor-pointer text-xs text-accent">O que é necessário para ativar</summary><ul className="mt-1 list-disc pl-5 text-xs text-fg-muted">{p.requires.map((r) => <li key={r}><code>{r}</code></li>)}</ul></details>
          </li>
        ))}
      </ul>
    </>
  );
}
