"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers";

export default function DemoTenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { tenant, ready } = useSession();

  useEffect(() => {
    if (!ready) return;
    // Redireciona se tenant não existe ou está suspensa/removida
    if (!tenant || tenant.status === "removida") {
      router.replace("/entrar?erro=tenant-nao-encontrado");
    } else if (tenant.status === "suspensa") {
      router.replace("/suspensa");
    }
  }, [ready, tenant, router]);

  return <>{children}</>;
}
