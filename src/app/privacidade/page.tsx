import type { Metadata } from "next";
import { SiteShell } from "@/components/marketing/site-shell";

export const metadata: Metadata = { title: { absolute: "Privacidade — LexSion" }, alternates: { canonical: "/privacidade" }, robots: { index: true, follow: true } };

// Resumo factual do tratamento de dados (coerente com o Anexo III do contrato 2026.11-1). Itens ainda em verificação
// (transferência internacional por fornecedor) são declarados como tal, sem afirmar conformidade não comprovada.
export default function PrivacidadePage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-semibold">Privacidade</h1>
        <p className="mt-2 text-sm text-fg-muted">Resumo. O tratamento de dados dos escritórios contratantes está detalhado no Anexo III do contrato SaaS.</p>
        <h2 className="mt-8 text-xl font-semibold">Demonstração</h2>
        <p className="mt-2 text-fg-muted">A demonstração usa apenas dados fictícios. O que você altera fica guardado somente no seu navegador e pode ser apagado a qualquer momento em Configurações → Dados e LGPD. Nada é enviado aos nossos servidores.</p>
        <h2 className="mt-8 text-xl font-semibold">Formulário de contato</h2>
        <p className="mt-2 text-fg-muted">Nesta versão, o formulário de contato não envia nem guarda os dados preenchidos.</p>
        <h2 className="mt-8 text-xl font-semibold">Operação real</h2>
        <p className="mt-2 text-fg-muted">Nos dados que o escritório insere, o escritório é o controlador e a LexSion é a operadora; nos dados de contratação e faturamento do próprio escritório, a LexSion é a controladora. Os dados de cada escritório ficam separados no banco, com acesso por papéis, registro de ações e cópia de segurança diária cifrada. Na contratação, registramos data e hora do aceite, o navegador e um código derivado do IP (não o IP).</p>
        <p className="mt-2 text-fg-muted">Fornecedores: Supabase (banco, autenticação e arquivos, EUA), Vercel (hospedagem, EUA), Cloudflare R2 (cópias cifradas), Resend (e-mails) e InfinitePay (pagamentos). O assistente de IA e o WhatsApp não estão ativos para dados de clientes. A avaliação de cada transferência internacional, fornecedor a fornecedor, está em andamento.</p>
        <p className="mt-2 text-fg-muted">O titular do escritório exporta todos os dados em Configurações → Dados e LGPD. Depois do encerramento, os dados ficam guardados por 90 dias e podem então ser eliminados, com confirmação humana. Pedidos de titulares sobre dados de um escritório são atendidos pelo próprio escritório.</p>
      </article>
    </SiteShell>
  );
}
