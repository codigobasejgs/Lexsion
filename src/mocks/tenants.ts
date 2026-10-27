// Fixtures de tenants para evolução SaaS multi-tenant (Onda 1).
import type { Tenant } from "@/domain/tenancy";

export const tenants: Tenant[] = [
  {
    id: "org-aurora",
    slug: "aurora-advocacia",
    name: "Aurora Advocacia Previdenciária",
    status: "ativa",
    plan: "profissional",
    cycle: "anual",
    createdAt: "2025-01-15T10:00:00Z",
    settings: {
      primaryColor: "#d6ae62",
      accentColor: "#f1d397",
      template: "executivo",
      density: "confortavel",
      textSize: "padrao",
    },
  },
  {
    id: "org-boreal",
    slug: "atlas-juridico",
    name: "Atlas Jurídico Associados",
    status: "ativa",
    plan: "essencial",
    cycle: "mensal",
    createdAt: "2025-03-22T14:30:00Z",
    settings: {
      primaryColor: "#2563eb",
      accentColor: "#60a5fa",
      template: "classico",
      density: "compacta",
      textSize: "padrao",
    },
  },
  {
    id: "org-novo",
    slug: "novo-escritorio",
    name: "Novo Escritório (trial)",
    status: "trial",
    plan: "trial",
    cycle: "mensal",
    trialEndsAt: "2026-11-10T23:59:59Z",
    createdAt: "2026-10-20T09:00:00Z",
    settings: {
      primaryColor: "#059669",
      accentColor: "#34d399",
      template: "moderno",
      density: "confortavel",
      textSize: "padrao",
    },
  },
];
