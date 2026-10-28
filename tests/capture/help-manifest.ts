// Manifesto dos prints reais da central de ajuda (M23).
// Cada entrada: artigo, passo, rota, perfil, viewport, fixture, seletor de espera e legenda.
// A legenda e o passo vêm de `shots` do artigo; aqui ficam rota/perfil/seletor.
import { HELP_ARTICLES, HELP_VERSION, shotPath } from "../../src/content/help";

export interface ShotSpec {
  article: string;
  step: number;
  mobile: boolean;
  caption: string;
  route: string;
  profile: string; // nome do usuário fictício em /demonstracao
  selector: string; // elemento que precisa estar visível antes da captura
  fixture: string;
  out: string; // caminho em public/
}

const ADMIN = "Helena Prado";
const FIN = "Caio Martins";
const WHERE: Record<string, { route: string; selector: string; profile?: string }> = {
  "entender-modo-demo:1": { route: "/app/inicio", selector: "text=Ambiente demonstrativo — dados fictícios" },
  "primeiro-acesso:2": { route: "/demonstracao", selector: "role=radio[name=/Helena Prado/]", profile: "" },
  "primeiro-acesso:4": { route: "/app/inicio", selector: '[data-tour="meu-dia-lista"]' },
  "operar-no-celular:1": { route: "/app/inicio", selector: 'nav[aria-label="Navegação rápida"]' },
  "operar-no-celular:2": { route: "/app/configuracoes?aba=dispositivo", selector: "text=Pedir armazenamento persistente" },
  "recuperar-erros:4": { route: "/app/ajuda", selector: 'input[type="search"]' },
  "assumir-conversa:2": { route: "/app/atendimento/cv-novo", selector: '[data-tour="assumir"]' },
  "organizar-lead:1": { route: "/app/crm", selector: '[data-tour="funil"]' },
  "converter-lead:1": { route: "/app/crm/leads/l-novo", selector: '[data-tour="converter-lead"]' },
  "enviar-proposta:2": { route: "/app/propostas/nova", selector: "text=Cronograma (entrada + parcelas)" },
  "enviar-proposta:4": { route: "/app/propostas/pp-paulo", selector: '[data-tour="fluxo-proposta"]' },
  "assinatura:2": { route: "/app/contratos/ct-ronaldo", selector: '[data-tour="signatarios"]' },
  "cadastrar-cliente:3": { route: "/app/clientes/novo", selector: '[data-tour="form-novo-cliente"]' },
  "abrir-caso:2": { route: "/app/clientes/c-maria", selector: '[data-tour="abrir-caso"]' },
  "solicitar-documento:2": { route: "/app/documentos/solicitacoes", selector: '[data-tour="nova-solicitacao"]' },
  "revisar-extracao:2": { route: "/app/documentos/doc-cnis-joao", selector: "text=Dados extraídos" },
  "registrar-prazo:4": { route: "/app/prazos", selector: '[data-tour="confirmar-prazo"]' },
  "agendar-pericia:1": { route: "/app/agenda", selector: '[data-tour="novo-compromisso"]' },
  "comparar-cenarios:4": { route: "/app/previdenciario/analises/pa-joao", selector: '[data-tour="cenarios"]' },
  "revisar-minuta:2": { route: "/app/minutas/dr-lucia", selector: "text=Texto da minuta" },
  "entrada-e-parcelas:1": { route: "/app/propostas/nova", selector: "text=Cronograma (entrada + parcelas)" },
  "baixa-parcial:2": { route: "/app/financeiro/receber", selector: "text=Registrar pagamento", profile: FIN },
  "emitir-recibo:3": { route: "/app/financeiro/recibos", selector: "h1", profile: FIN },
  "conciliacao:2": { route: "/app/financeiro/conciliacao", selector: '[data-tour="extrato"]', profile: FIN },
  "importar-csv:3": { route: "/app/importacoes", selector: "text=Prévia" },
  "configurar-notificacoes:2": { route: "/app/configuracoes?aba=notificacoes", selector: "text=Salvar preferências" },
  "usar-calculos:1": { route: "/app/calculos", selector: "text=Cálculos do escritório" },
  "acompanhar-rpv:1": { route: "/app/requisitorios", selector: "h1" },
  "usar-jornal-pesquisa:2": { route: "/app/jornal", selector: "h1" },
  "ler-relatorios:2": { route: "/app/relatorios", selector: "figure" },
  "gerir-equipe:2": { route: "/app/equipe", selector: "text=Matriz de acesso por perfil" },
  "conectar-whatsapp:2": { route: "/app/integracoes/evolution", selector: '[data-tour="conexao-whatsapp"]' },
  "trocar-logo-e-cores:4": { route: "/app/configuracoes/branding", selector: "text=Prévia ao vivo" },
  "instalar-app-do-escritorio:1": { route: "/app/configuracoes/branding", selector: 'role=img[name=/QR Code/]' },
  "tarefas-recorrentes:2": { route: "/app/tarefas", selector: "h1" },
  "workflows-por-caso:2": { route: "/app/workflows", selector: '[data-tour="workflow-modelo"]' },
  "analisar-cnis-bpc-ppp:1": { route: "/app/previdenciario/analises/pa-joao", selector: '[data-testid="cnis-diagnostico"]' },
  "analisar-cnis-bpc-ppp:3": { route: "/app/previdenciario/especializadas/as-bpc-maria", selector: '[data-testid="bpc-per-capita"]' },
  "fontes-e-versoes-da-minuta:2": { route: "/app/minutas/dr-lucia", selector: '[data-testid="painel-fontes"]' },
  "follow-up-e-opt-out:1": { route: "/app/crm/leads/l-01", selector: '[data-testid="follow-up"]' },
  "super-admin-escritorios:1": { route: "/admin", selector: "text=Receita recorrente mensal", profile: "Suporte LexSion" },
};

export const SHOTS: ShotSpec[] = HELP_ARTICLES.flatMap((a) =>
  a.shots.map((s) => {
    const w = WHERE[`${a.slug}:${s.step}`];
    if (!w) throw new Error(`Manifesto sem rota para ${a.slug}:${s.step}`);
    return { article: a.slug, step: s.step, mobile: !!s.mobile, caption: s.caption, route: w.route, profile: w.profile ?? ADMIN, selector: w.selector, fixture: "FIXTURE_VERSION atual (dados fictícios)", out: `public${shotPath(a.slug, s)}` };
  }),
);

export { HELP_VERSION };
