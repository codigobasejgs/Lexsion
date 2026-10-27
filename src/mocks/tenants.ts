// Três escritórios DEMONSTRATIVOS com identidades distintas (nomes, cores e logos fictícios).
import { DEFAULT_BRANDING, type Tenant } from "@/domain/tenancy";

export const tenants: Tenant[] = [
  {
    id: "org-aurora", slug: "aurora-advocacia", name: "Aurora Advocacia Previdenciária", hostname: "aurora-advocacia.lexsion.com.br",
    status: "ativa", plan: "profissional", cycle: "anual", createdAt: "2025-01-15T10:00:00-03:00",
    ownerName: "Helena Prado", ownerEmail: "helena@aurora.exemplo.test", document: "00.000.001/0001-00",
    settings: {
      ...DEFAULT_BRANDING, brandName: "Aurora Advocacia", pwaShortName: "Aurora",
      logoLight: "/tenants/aurora-advocacia/logo.svg", logoDark: "/tenants/aurora-advocacia/logo.svg",
      primary: "#b07a2a", secondary: "#7a5418", accent: "#e0b36a", backgroundLight: "#fbf7f0", backgroundDark: "#120d07", surface: "#ffffff", text: "#2a1d0c",
      template: "executivo",
    },
  },
  {
    id: "org-boreal", slug: "atlas-juridico", name: "Atlas Jurídico Associados", hostname: "atlas-juridico.lexsion.com.br",
    status: "ativa", plan: "essencial", cycle: "mensal", createdAt: "2025-03-22T14:30:00-03:00",
    ownerName: "Otávio Reis", ownerEmail: "otavio@atlas.exemplo.test", document: "00.000.002/0001-00",
    settings: {
      ...DEFAULT_BRANDING, brandName: "Atlas Jurídico", pwaShortName: "Atlas",
      logoLight: "/tenants/atlas-juridico/logo.svg", logoDark: "/tenants/atlas-juridico/logo.svg",
      primary: "#1d4ed8", secondary: "#1e3a8a", accent: "#60a5fa", backgroundLight: "#f5f8ff", backgroundDark: "#0a1020", surface: "#ffffff", text: "#0f1b33",
      template: "classico", density: "compacta",
    },
  },
  {
    id: "org-novo", slug: "novo-escritorio", name: "Novo Escritório (teste)", hostname: "novo-escritorio.lexsion.com.br",
    status: "trial", plan: "trial", cycle: "mensal", trialEndsAt: "2026-11-10T23:59:59-03:00", createdAt: "2026-10-20T09:00:00-03:00",
    ownerName: "Carlos Exemplo", ownerEmail: "carlos@novo.exemplo.test",
    settings: {
      ...DEFAULT_BRANDING, brandName: "Novo Escritório", pwaShortName: "Novo",
      logoLight: "/tenants/novo-escritorio/logo.svg", logoDark: "/tenants/novo-escritorio/logo.svg",
      primary: "#047857", secondary: "#065f46", accent: "#34d399", backgroundLight: "#f3faf7", backgroundDark: "#06130e", surface: "#ffffff", text: "#0b2a20",
      template: "moderno",
    },
  },
];
