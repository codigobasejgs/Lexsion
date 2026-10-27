import { describe, expect, it } from "vitest";
import { TEMPLATES, renderEmail } from "@/domain/email-templates";
import { tenants } from "@/mocks/tenants";

const aurora = tenants[0].settings;
const atlas = tenants[1].settings;

describe("modelos de e-mail com a marca do escritório", () => {
  it("todos os modelos renderizam com assunto e marca do escritório", () => {
    for (const t of TEMPLATES) {
      const r = renderEmail(t.id, { nome: "Maria", documento: "RG", caso: "BPC", valor: "R$ 150,00", vencimento: "10/11/2026" }, aurora);
      expect(r.subject.length, t.id).toBeGreaterThan(5);
      expect(r.html, t.id).toContain("Aurora Advocacia");
    }
  });
  it("variáveis são escapadas (sem injeção de HTML)", () => {
    const r = renderEmail("boas-vindas", { nome: '<script>alert(1)</script><img src=x onerror=alert(1)>' }, aurora);
    // Nenhuma TAG nasce do conteúdo do usuário: só texto escapado (o "<" vira "&lt;").
    expect(r.html).not.toMatch(/<script|<img src=x/);
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(r.subject).toContain("&lt;script&gt;");
  });
  it("marca do escritório A não aparece no e-mail do escritório B", () => {
    const b = renderEmail("recibo", { nome: "Rita", valor: "R$ 10,00" }, atlas).html;
    expect(b).toContain("Atlas Jurídico");
    expect(b).not.toMatch(/Aurora/);
  });
  it("logo só de imagem raster validada ou asset próprio — URL externa ou javascript: é ignorada", () => {
    expect(renderEmail("convite", { nome: "A" }, { ...aurora, logoLight: "javascript:alert(1)" }).html).not.toContain("javascript:");
    expect(renderEmail("convite", { nome: "A" }, { ...aurora, logoLight: "https://site-malicioso.test/x.png" }).html).not.toContain("site-malicioso");
    expect(renderEmail("convite", { nome: "A" }, aurora).html).toContain('src="/tenants/aurora-advocacia/logo.svg"');
  });
  it("sem scripts e com rodapé de preferência de envio", () => {
    for (const t of TEMPLATES) expect(renderEmail(t.id, {}, aurora).html).toMatch(/ajuste suas preferências/);
  });
});
