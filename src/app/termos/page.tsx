import type { Metadata } from "next";
import { SiteShell } from "@/components/marketing/site-shell";
import { CONTRACT_VERSION } from "@/domain/saas";

export const metadata: Metadata = { title: { absolute: "Termos de uso — LexSion" }, alternates: { canonical: "/termos" }, robots: { index: true, follow: true } };

// Termos resumidos, coerentes com o contrato SaaS 2026.11-1 (decisões do proprietário em 03/11/2026). O contrato
// integral, preenchido com os dados do contratante, é exibido e aceito em /contratar.
export default function TermosPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl space-y-4 px-5 py-12 text-fg-muted">
        <h1 className="text-3xl font-semibold text-fg">Termos de uso</h1>
        <p className="text-sm text-fg-muted">Versão {CONTRACT_VERSION}. Resumo do contrato SaaS (modelo 2026.11-1); prevalece o contrato integral exibido na contratação.</p>
        <p>A LexSion é um software de gestão para escritórios de advocacia. Não presta serviços jurídicos nem garante resultados. Cálculos, prazos, sugestões e minutas produzidos com o sistema dependem de revisão do profissional responsável.</p>
        <p>A demonstração pública é oferecida apenas para conhecer o sistema, com dados fictícios. Não insira dados reais de clientes na demonstração.</p>
        <h2 id="contratacao" className="pt-4 text-xl font-semibold text-fg">Termos de contratação</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li><strong>Objeto.</strong> Licença de uso do sistema LexSion pelo escritório contratante, no plano escolhido e com o limite de usuários do plano.</li>
          <li><strong>Pagamento.</strong> Por Pix ou cartão na InfinitePay (CloudWalk), em nome da LexSion. A LexSion não recebe nem guarda dados de cartão.</li>
          <li><strong>Ativação.</strong> O escritório é criado depois que a InfinitePay confirma o pagamento. O acesso é enviado ao e-mail do(a) titular informado no cadastro.</li>
          <li><strong>Teste grátis.</strong> Quando o plano oferece teste, o escritório é criado na hora, sem cobrança e sem pedir cartão. Há um teste por CPF/CNPJ e por e-mail. Antes do fim do teste, o link da primeira mensalidade é enviado por e-mail; sem pagamento, valem as regras de atraso abaixo, contadas do fim do teste.</li>
          <li><strong>Renovação.</strong> Não há débito automático. Antes de cada vencimento, a cobrança do próximo período é enviada por e-mail e fica visível em Configurações → Plano.</li>
          <li><strong>Atraso.</strong> Sem pagamento até 5 dias depois do vencimento, o acesso é suspenso, sem multa nem juros. Nenhum dado é apagado, e o acesso volta assim que o pagamento é confirmado.</li>
          <li><strong>Descumprimento.</strong> Em descumprimento que possa ser corrigido, a rescisão depende de notificação formal com 10 dias corridos para regularizar.</li>
          <li><strong>Troca de plano.</strong> O(a) titular pode pedir a troca em Configurações → Plano. A mudança vale a partir do próximo período, com o novo valor.</li>
          <li><strong>Cancelamento.</strong> O(a) titular pode cancelar a qualquer momento, com efeito ao fim do período já pago, sem reembolso proporcional do período em curso. Os dados ficam preservados por 90 dias depois do fim do período, para exportação ou reativação; depois, podem ser eliminados, sempre com confirmação humana e registro (nunca automaticamente). Contratos e pagamentos são guardados por obrigação legal.</li>
          <li><strong>Direito de arrependimento.</strong> Em até 7 dias da primeira contratação, o valor é devolvido integralmente a pedido do contratante (art. 49 do CDC).</li>
          <li><strong>Preço contratado.</strong> O valor do período contratado não muda. Uma mudança de tabela vale só para novas contratações ou para a próxima renovação, com aviso prévio de 30 dias.</li>
          <li><strong>Dados.</strong> O escritório é o controlador dos dados dos seus clientes, e a LexSion é a operadora (LGPD). Os dados são isolados por escritório e têm backup diário cifrado. O titular exporta todos os dados do escritório em Configurações → Dados e LGPD. Incidente que possa afetar dados pessoais é comunicado ao titular em até 1 dia útil.</li>
          <li><strong>Integrações em auditoria.</strong> O assistente de IA e o WhatsApp não estão ativos para dados de clientes nesta versão.</li>
          <li><strong>Suporte e foro.</strong> Atendimento por e-mail em dias úteis, sem prazo fixo (SLA). Nas relações de consumo, vale o foro do domicílio do consumidor; nas demais, o da sede da LexSion.</li>
        </ol>
      </article>
    </SiteShell>
  );
}
