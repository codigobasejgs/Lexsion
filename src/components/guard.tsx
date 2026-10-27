"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useSession } from "@/components/providers";
import { can, type Area } from "@/domain/permissions";

/** Estado "sem permissão" demonstrativo — não substitui autorização no servidor. */
export function Guard({ area, children }: { area: Area; children: React.ReactNode }) {
  const { user } = useSession();
  if (!user) return null;
  if (!can(user.role, area))
    return (
      <div role="alert" className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 text-center">
        <Lock aria-hidden className="size-8 text-fg-muted" />
        <h1 className="text-xl font-semibold">Você não tem acesso a esta área</h1>
        <p className="text-fg-muted">Seu perfil não inclui este módulo. Peça acesso ao administrador do escritório.</p>
        <Link href="/app/inicio" className="btn btn-secondary">Voltar ao Meu dia</Link>
      </div>
    );
  return <>{children}</>;
}
