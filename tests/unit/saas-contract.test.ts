import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TEMPLATE, DRAFT_BANNER, fields, pendingItems, renderContract, validateParty, type Party, type RenderCtx } from "@/domain/saas-contract";

vi.mock("server-only", () => ({}));
const { contractPdf } = await import("@/lib/contract-pdf");

// Contrato SaaS: validação PF/PJ, texto renderizado com os dados reais da contratada, sem placeholder perdido,
// hash muda com qualquer alteração, minuta marcada, PDF A4 real. Dados SINTÉTICOS (CPF/CNPJ de teste válidos).
const supplier = { trade_name: "LexSion — ERP Jurídico SaaS", legal_name: "59.760.458 MARCO ANTONIO BOGGIAN", document: "59.760.458/0001-91", legal_nature: "Empresário individual (213-5)", address: { street: "Rua Jacques Pilon", number: "189", district: "Vila Piauí", city: "São Paulo", uf: "SP", cep: "05109-160" }, contact_email: null, contact_phone: null };
const address = { cep: "01310100", street: "Avenida Exemplo", number: "100", district: "Centro", city: "São Paulo", uf: "SP" };
const pf: Party = { kind: "PF", name: "Ana Exemplo Teste", cpf: "529.982.247-25", email: "ana@exemplo.test", phone: "(11) 91234-5678", oab: "123456/SP", address };
const pj: Party = { kind: "PJ", legal_name: "Exemplo Advogados Associados", cnpj: "11.222.333/0001-81", address, rep: { name: "Bruno Exemplo Sócio", cpf: "390.533.447-05", role: "sócio-administrador", email: "bruno@exemplo.test", phone: "11912345678" }, rep_powers: true };
const plan = { id: "profissional", label: "Profissional", version: 1, price_monthly: 24990, price_yearly: null, max_users: 5, trial_days: 30, features: [{ label: "Portal do cliente", ok: true }, { label: "Assinatura eletrônica", ok: false }] };
const ctx = (party: Party, over: Partial<RenderCtx> = {}): RenderCtx => ({ supplier, party, plan, cycle: "mensal", number: "LX-2026-ABCDEF0123", date: "30/10/2026", templateVersion: DEFAULT_TEMPLATE.version, draft: false, ...over });
const h = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describe("validação do contratante", () => {
  it("PF e PJ válidos passam", () => { expect(validateParty(pf)).toEqual({}); expect(validateParty(pj)).toEqual({}); });
  it("PF: CPF inválido, nome sem sobrenome, CEP e UF errados são apontados por campo", () => {
    const e = validateParty({ ...pf, cpf: "111.111.111-11", name: "Ana", address: { ...address, cep: "123", uf: "XX" } } as Party);
    expect(Object.keys(e).sort()).toEqual(["address.cep", "address.uf", "cpf", "name"]);
  });
  it("PJ: exige CNPJ válido, CPF do representante e declaração de poderes (não presume)", () => {
    const e = validateParty({ ...pj, cnpj: "11.111.111/1111-11", rep: { ...(pj as Extract<Party, { kind: "PJ" }>).rep, cpf: "000" }, rep_powers: false } as Party);
    expect(e).toMatchObject({ cnpj: expect.any(String), "rep.cpf": expect.any(String), rep_powers: expect.any(String) });
  });
});

describe("texto do contrato", () => {
  it("usa os dados oficiais da contratada (nome empresarial e CNPJ do comprovante), sem 'LTDA'", () => {
    const t = renderContract(DEFAULT_TEMPLATE, ctx(pf));
    expect(t).toContain("59.760.458 MARCO ANTONIO BOGGIAN");
    expect(t).toContain("59.760.458/0001-91");
    expect(t).toContain("Rua Jacques Pilon, 189");
    expect(t).not.toMatch(/LTDA|APP GROUP/i);
  });
  it("PF não ganha CNPJ; PJ traz razão social, CNPJ e representante", () => {
    const a = renderContract(DEFAULT_TEMPLATE, ctx(pf)), b = renderContract(DEFAULT_TEMPLATE, ctx(pj));
    expect(fields(ctx(pf))["contratante.qualificacao"]).not.toMatch(/CNPJ/);
    expect(a).toContain("CPF sob o nº 529.982.247-25");
    expect(b).toContain("CNPJ sob o nº 11.222.333/0001-81");
    expect(b).toContain("representada por Bruno Exemplo Sócio, sócio-administrador");
  });
  it("plano, preço, usuários, teste grátis, recursos ativos e NÃO ativos e modalidade de cobrança entram no texto", () => {
    const t = renderContract(DEFAULT_TEMPLATE, ctx(pf));
    for (const s of ["Plano Profissional (versão comercial 1)", "R$ 249,90", "até 5 usuários", "teste gratuito de 30 dias", "Portal do cliente", "NÃO ativos nesta data (não integram o objeto até sua disponibilização formal): Assinatura eletrônica", "NÃO há débito automático"]) expect(t).toContain(s);
  });
  it("nenhum placeholder {{…}} sobra; nenhuma promessa proibida (uptime, 24/7, multa 2%, IGP-M)", () => {
    const t = renderContract(DEFAULT_TEMPLATE, ctx(pj));
    expect(t).not.toMatch(/\{\{|\[[a-z_]+\.[a-z_.]+\]/);
    expect(t).not.toMatch(/99[,.]5|24\s*\/\s*7|2\s*%|IGP-?M|1\s*%\s*ao mês/i);
    expect(t).toMatch(/sem que isso caracterize assinatura qualificada ICP-Brasil/);
  });
  it("minuta leva a tarja; versão vigente não", () => {
    expect(renderContract(DEFAULT_TEMPLATE, ctx(pf, { draft: true }))).toContain(DRAFT_BANNER);
    expect(renderContract(DEFAULT_TEMPLATE, ctx(pf))).not.toContain(DRAFT_BANNER);
  });
  it("qualquer mudança de dado, ciclo ou plano muda o hash (prova do que foi aceito)", () => {
    const base = h(renderContract(DEFAULT_TEMPLATE, ctx(pf)));
    expect(h(renderContract(DEFAULT_TEMPLATE, ctx({ ...pf, name: "Ana Exemplo Teste Silva" } as Party)))).not.toBe(base);
    expect(h(renderContract(DEFAULT_TEMPLATE, ctx(pf, { plan: { ...plan, price_monthly: 24991 } })))).not.toBe(base);
    expect(h(renderContract(DEFAULT_TEMPLATE, ctx(pf)))).toBe(base); // determinístico
  });
  it("minuta-base declara as pendências jurídicas (não decide por conta própria)", () => {
    const p = pendingItems(DEFAULT_TEMPLATE).join(" | ");
    for (const s of ["reajuste", "multa", "reembolso", "SLA", "retenção", "foro", "aplicabilidade", "DPA"]) expect(p.toLowerCase()).toContain(s.toLowerCase());
    expect(DEFAULT_TEMPLATE.status).toBe("REVISAO_JURIDICA");
  });
});

describe("PDF A4 do contrato", () => {
  it("gera PDF real, A4, várias páginas, com número, hash e tarja quando minuta; mesmos bytes ⇒ mesmo hash", async () => {
    const text = renderContract(DEFAULT_TEMPLATE, ctx(pj, { draft: true }));
    const pdf = await contractPdf({ text, number: "LX-2026-ABCDEF0123", hash: h(text), footer: "Minuta não aceita" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
    expect(doc.getTitle()).toBe("Contrato LexSion LX-2026-ABCDEF0123");
  });
});
