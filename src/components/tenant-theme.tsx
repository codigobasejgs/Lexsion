"use client";

import { useSession } from "@/components/providers";
import { useEffect } from "react";

// Aplica tokens de branding do tenant como CSS custom properties.
// ponytail: validação AA contrast quando personalizado; agora aceita direto.
export function TenantTheme() {
  const { tenant } = useSession();

  useEffect(() => {
    if (!tenant) return;
    const { primaryColor, accentColor } = tenant.settings;

    // Escuro (padrão)
    document.documentElement.style.setProperty("--brand", primaryColor);
    document.documentElement.style.setProperty("--accent", accentColor);
    document.documentElement.style.setProperty("--focus", accentColor);

    // ponytail: derivar brand-hover, on-brand, selection quando backend calcular; agora fixo.
  }, [tenant]);

  return null;
}
