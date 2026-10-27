import { describe, expect, it } from "vitest";
import { ALL_ROLES, ROLE_PRODUCT, allowed, can, isPlatformRole } from "@/domain/permissions";
import { users } from "@/mocks/fixtures";

// QA-RBAC — matriz demonstrativa (UX). Não substitui autorização no servidor (fase backend).
describe("RBAC — 12 papéis do produto", () => {
  it("existem exatamente os 12 papéis da especificação, sem duplicar nome técnico", () => {
    const product = Object.values(ROLE_PRODUCT).sort();
    expect(ALL_ROLES).toHaveLength(12);
    expect(product).toEqual(["assistant", "controller", "external_collaborator", "finance", "intern", "lawyer", "platform_admin", "platform_owner", "platform_support", "tenant_admin", "tenant_client", "tenant_owner"]);
  });

  it("cada papel tem ao menos um perfil fictício na demonstração", () => {
    expect(ALL_ROLES.filter((r) => !users.some((u) => u.role === r))).toEqual([]);
  });

  it("plataforma não entra em módulos do escritório; escritório não entra no Super Admin", () => {
    for (const r of ALL_ROLES) {
      expect(can(r, "admin"), r).toBe(isPlatformRole(r));
      if (isPlatformRole(r)) expect(can(r, "casos") || can(r, "financeiro") || can(r, "documentos"), r).toBe(false);
    }
  });

  it("só advogado(a) e titular aprovam peças e publicam no portal", () => {
    expect(ALL_ROLES.filter((r) => allowed(r, "aprovar_peca")).sort()).toEqual(["admin", "advogado"]);
    expect(ALL_ROLES.filter((r) => allowed(r, "publicar_portal")).sort()).toEqual(["admin", "advogado"]);
  });

  it("cliente, correspondente, estagiário e atendimento não veem honorários nem casos sigilosos", () => {
    for (const r of ["cliente", "external_collaborator", "estagiario", "atendimento"] as const) {
      expect(allowed(r, "ver_honorarios"), r).toBe(false);
      expect(allowed(r, "ver_casos_sigilosos"), r).toBe(false);
    }
  });

  it("gestor(a) operacional não altera a marca, não aprova peças e não vê integrações; suporte da plataforma não opera assinaturas", () => {
    expect(allowed("tenant_admin", "gerir_marca")).toBe(false);
    expect(allowed("tenant_admin", "aprovar_peca")).toBe(false);
    expect(can("tenant_admin", "integracoes")).toBe(false);
    expect(allowed("platform_support", "gerir_assinatura_saas")).toBe(false);
  });

  it("correspondente externo só vê casos, documentos, agenda e tarefas; nunca financeiro, CRM ou equipe", () => {
    for (const a of ["financeiro", "crm", "equipe", "configuracoes", "relatorios"] as const) expect(can("external_collaborator", a), a).toBe(false);
  });
});
