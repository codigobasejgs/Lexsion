// Modelos de e-mail transacionais com a marca do REMETENTE (escritório ou plataforma). Somente prévia nesta fase.
// Toda variável é escapada (nome com <script> vira texto). Cores passam pelo tema seguro do escritório.
import type { TenantBranding } from "./tenancy";
import { tenantTheme } from "@/lib/tenant-tokens";

export type TemplateId = "boas-vindas" | "convite" | "redefinir-senha" | "documento-pendente" | "atualizacao-caso" | "parcela-vencendo" | "recibo";
export const TEMPLATES: { id: TemplateId; label: string; subject: string; body: string; cta?: string; vars: string[] }[] = [
  { id: "boas-vindas", label: "Boas-vindas ao cliente", subject: "Bem-vindo(a), {{nome}}", body: "Olá, {{nome}}. A partir de agora você acompanha seu caso pela área do cliente do {{escritorio}}.", cta: "Acessar minha área", vars: ["nome", "escritorio"] },
  { id: "convite", label: "Convite para a equipe", subject: "Convite para a equipe do {{escritorio}}", body: "{{nome}}, você foi convidado(a) para usar o sistema do {{escritorio}}.", cta: "Aceitar convite", vars: ["nome", "escritorio"] },
  { id: "redefinir-senha", label: "Redefinir senha", subject: "Redefinição de senha", body: "Recebemos um pedido para redefinir sua senha. Se não foi você, ignore este e-mail.", cta: "Criar nova senha", vars: [] },
  { id: "documento-pendente", label: "Documento pendente", subject: "Precisamos de um documento: {{documento}}", body: "Olá, {{nome}}. Para seguir com seu caso, envie {{documento}} pela sua área do cliente.", cta: "Enviar documento", vars: ["nome", "documento"] },
  { id: "atualizacao-caso", label: "Atualização do caso", subject: "Novidade no seu caso", body: "Olá, {{nome}}. Há uma nova atualização sobre {{caso}}. Veja os detalhes na sua área do cliente.", cta: "Ver atualização", vars: ["nome", "caso"] },
  { id: "parcela-vencendo", label: "Parcela vencendo", subject: "Lembrete: parcela vence em {{vencimento}}", body: "Olá, {{nome}}. A parcela de {{valor}} vence em {{vencimento}}.", cta: "Ver pagamento", vars: ["nome", "valor", "vencimento"] },
  { id: "recibo", label: "Recibo de pagamento", subject: "Recibo do seu pagamento", body: "Olá, {{nome}}. Confirmamos o recebimento de {{valor}}. O recibo está disponível na sua área do cliente.", cta: "Ver recibo", vars: ["nome", "valor"] },
];

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => escapeHtml(vars[k] ?? `[${k}]`));

/** HTML de e-mail (tabelas e estilos inline, como clientes de e-mail exigem). Sem scripts, sem recursos externos além do logo. */
export function renderEmail(id: TemplateId, vars: Record<string, string>, brand: Pick<TenantBranding, "brandName" | "primary" | "accent" | "logoLight"> & Partial<TenantBranding>): { subject: string; html: string } {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const theme = tenantTheme({ ...(brand as TenantBranding), secondary: brand.primary, backgroundLight: "#ffffff", backgroundDark: "#0e1116", surface: "#ffffff", text: "#18202b", themeMode: "light", template: "executivo", density: "confortavel", textSize: "padrao", radius: "suave", showPoweredBy: true, brandingVersion: 1, pwaShortName: brand.brandName });
  const c = theme.light;
  const name = escapeHtml(brand.brandName);
  // Logo só se for imagem raster já validada (data:image/png) ou asset da própria aplicação.
  const logo = brand.logoLight && /^(data:image\/(png|jpeg|webp);base64,|\/)/.test(brand.logoLight) ? `<img src="${escapeHtml(brand.logoLight)}" alt="${name}" width="48" height="48" style="display:block;border-radius:8px">` : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f2ee;font-family:Arial,Helvetica,sans-serif;color:#18202b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:20px 24px;border-bottom:4px solid ${c.brand}"><table role="presentation"><tr><td>${logo}</td><td style="padding-left:${logo ? 12 : 0}px;font-size:18px;font-weight:bold">${name}</td></tr></table></td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.5"><p style="margin:0 0 16px">${fill(t.body, { escritorio: brand.brandName, ...vars })}</p>
${t.cta ? `<a href="#" style="display:inline-block;background:${c.brand};color:${c.onBrand};padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(t.cta)}</a>` : ""}</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#535b68;border-top:1px solid #ddd6c8">Você recebe este e-mail porque é cliente ou faz parte da equipe de ${name}. Para não receber avisos opcionais, ajuste suas preferências na área do cliente.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: fill(t.subject, { escritorio: brand.brandName, ...vars }), html };
}
