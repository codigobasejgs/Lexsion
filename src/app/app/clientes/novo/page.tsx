"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Guard } from "@/components/guard";
import { useInvalidate, useSession } from "@/components/providers";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "@/modules/clients/client-form";
import { clientService } from "@/services/mock/crm-repo";

export default function NovoClientePage() {
  const { ctx } = useSession();
  const router = useRouter();
  const invalidate = useInvalidate();
  const key = useRef(crypto.randomUUID().slice(0, 8)); // duplo clique não cria dois clientes

  return (
    <Guard area="clientes">
      <div className="mx-auto max-w-3xl">
        <PageHeader breadcrumb={[{ href: "/app/clientes", label: "Clientes" }]} title="Novo cliente" description="Cadastro de pessoa física ou jurídica. Campos obrigatórios sem a marca “opcional”." />
        <div className="panel p-5" data-tour="form-novo-cliente">
          <ClientForm
            submitLabel="Salvar cliente"
            onCancel={() => router.back()}
            onPickExisting={(id) => router.push(`/app/clientes/${id}`)}
            onSubmit={async (input) => {
              if (!ctx) return "Sessão expirada. Entre novamente.";
              const r = await clientService.create(input, { ...ctx, idempotencyKey: key.current });
              if (!r.ok) return r.error.message;
              await invalidate("clients", "audit");
              router.push(`/app/clientes/${r.data.id}?criado=1`);
              return null;
            }}
          />
        </div>
      </div>
    </Guard>
  );
}
