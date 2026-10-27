"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/providers";
import { readAll } from "@/services/mock/db";
import { users } from "@/mocks/fixtures";

// Entrada demonstrativa de um escritório: escolhe o perfil administrador desse escritório e abre o ERP.
// Escritório inexistente, removido ou suspenso: tela própria, sem expor dados.
export default function DemoTenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { ready, signIn } = useSession();
  const t = useQuery({ queryKey: ["tenants"], queryFn: () => readAll("tenants"), enabled: ready });
  const tenant = t.data?.find((x) => x.slug === slug);
  const blocked = !tenant || tenant.status === "removida" || tenant.status === "suspensa" || tenant.status === "cancelada";

  // Decide UMA vez, ao abrir. Sem isso, uma aba antiga “Acesso suspenso” entrava sozinha quando outra aba
  // reativava o escritório e trocava a sessão de todas as abas (BUG LX-05).
  const decided = useRef(false);
  useEffect(() => {
    if (!t.data || decided.current) return;
    decided.current = true;
    if (blocked) return;
    const admin = users.find((u) => u.organizationId === tenant!.id && u.role === "admin");
    if (!admin) return;
    signIn(admin.id, tenant!.id);
    router.replace("/app/inicio");
  }, [t.data, blocked, tenant, signIn, router]);

  if (!t.data) return <main id="conteudo" className="min-h-dvh bg-canvas" aria-busy="true" />;
  if (!blocked && users.some((u) => u.organizationId === tenant!.id && u.role === "admin")) return <main id="conteudo" className="min-h-dvh bg-canvas" aria-busy="true"><p className="sr-only">Abrindo o escritório…</p></main>;
  const title = !tenant || tenant.status === "removida" ? "Escritório não encontrado" : tenant.status === "suspensa" ? "Acesso suspenso" : tenant.status === "cancelada" ? "Assinatura encerrada" : "Escritório sem administrador de demonstração";
  const text = !tenant || tenant.status === "removida"
    ? "Este endereço não corresponde a nenhum escritório ativo nesta demonstração."
    : tenant.status === "suspensa" ? "O acesso a este escritório está temporariamente suspenso. Os dados foram preservados. Fale com o responsável pelo escritório ou com o suporte LexSion."
    : tenant.status === "cancelada" ? "A assinatura deste escritório foi encerrada. Os dados ficam disponíveis para exportação conforme a política de retenção."
    : "Escritórios criados no Super Admin ganham um administrador fictício na fase com backend; por enquanto entre pelo Super Admin.";
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-fg-muted">{text}</p>
      <Link href="/demonstracao" className="btn btn-secondary">Escolher outro perfil</Link>
    </main>
  );
}
