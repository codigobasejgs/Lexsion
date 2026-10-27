// Validação de formulários (Zod). Mensagens em pt-BR, exibidas ao lado do campo.
import { z } from "zod";
import { isValidCnpj, isValidCpf, isValidPhone } from "./crm";
import { isCivilDate } from "@/lib/dates";
import { ALL_AREAS } from "./areas";

const UF = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
export const UFS = UF;

const phone = z.string().trim().refine(isValidPhone, "Informe DDD + número, por exemplo (71) 98888-7777.");
const optEmail = z.union([z.literal(""), z.email("E-mail inválido.")]).optional();
const area = z.string().refine((a) => ALL_AREAS.includes(a), "Escolha uma área.");

export const leadSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome (mínimo 3 letras)."),
  phone,
  email: optEmail,
  city: z.string().trim().optional(),
  uf: z.union([z.literal(""), z.enum(UF)]).optional(),
  area,
  service: z.string().trim().min(2, "Informe o serviço de interesse."),
  ownerId: z.string().optional(),
  declaredOrigin: z.string().trim().optional(),
  consentContact: z.boolean(),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const campaignLeadSchema = leadSchema.omit({ ownerId: true, declaredOrigin: true }).extend({
  consentContact: z.literal(true, { error: "É preciso autorizar o contato para enviar." }),
  campaign: z.string().optional(),
  landingPage: z.string().optional(),
  utm: z.record(z.string(), z.string()).optional(),
  clickId: z.string().optional(),
});
export type CampaignLeadInput = z.infer<typeof campaignLeadSchema>;

export const clientSchema = z
  .object({
    kind: z.enum(["PF", "PJ"]),
    name: z.string().trim().min(3, "Informe o nome completo ou razão social."),
    socialName: z.string().trim().optional(),
    document: z.string().trim(),
    birthDate: z.union([z.literal(""), z.string().refine(isCivilDate, "Data inválida.")]).optional(),
    phone,
    email: optEmail,
    city: z.string().trim().min(2, "Informe a cidade."),
    uf: z.enum(UF, { error: "Escolha a UF." }),
    profession: z.string().trim().optional(),
    ownerId: z.string().min(1, "Escolha o responsável."),
    origin: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    const ok = v.kind === "PF" ? isValidCpf(v.document) : isValidCnpj(v.document);
    if (!ok) ctx.addIssue({ code: "custom", path: ["document"], message: v.kind === "PF" ? "CPF inválido (confira os dígitos)." : "CNPJ inválido (confira os dígitos)." });
  });
export type ClientInput = z.infer<typeof clientSchema>;

export const caseSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(3, "Dê um título ao caso."),
  area,
  service: z.string().trim().min(2, "Informe o serviço."),
  kind: z.enum(["consultivo", "administrativo", "judicial"]),
  priority: z.enum(["baixa", "normal", "alta"]),
  ownerId: z.string().min(1, "Escolha o responsável."),
  confidential: z.boolean(),
});
export type CaseInput = z.infer<typeof caseSchema>;

/** Converte erros do Zod em { campo: mensagem } (primeira mensagem por campo). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "_");
    out[k] ??= i.message;
  }
  return out;
}
