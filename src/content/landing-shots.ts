// Catálogo dos prints REAIS usados na landing. Cada um é capturado do app por tests/capture/landing.capture.ts
// com o perfil fictício indicado; `href` leva ao módulo correspondente na demonstração.
export interface LandingShot {
  id: string;
  title: string;
  caption: string;
  route: string;
  profile: string; // nome do usuário fictício na /demonstracao
  waitFor: string; // seletor que precisa estar visível antes da captura
  href: string; // destino na demonstração (pede escolha de perfil antes)
}

export const LANDING_SHOTS: LandingShot[] = [
  { id: "meu-dia", title: "Meu dia", caption: "O que precisa de atenção hoje, do mais urgente ao menos urgente — prazos, tarefas, atendimentos e cobranças.", route: "/app/inicio", profile: "Helena Prado", waitFor: '[data-tour="meu-dia-lista"]', href: "/demonstracao" },
  { id: "crm", title: "Atendimento e funil", caption: "Do primeiro contato à contratação: funil por etapa, triagem por área do Direito e conversão em cliente e caso.", route: "/app/crm", profile: "Beatriz Lima", waitFor: '[data-tour="funil"]', href: "/demonstracao" },
  { id: "caso", title: "Casos e processos", caption: "Ficha do caso com partes, prazos, documentos, linha do tempo e atualização ao cliente só depois de revisada.", route: "/app/casos/k-maria-bpc", profile: "Rafael Nunes", waitFor: "h1", href: "/demonstracao" },
  { id: "agenda", title: "Agenda, audiências e prazos", caption: "Compromissos, audiências e perícias por responsável, com exportação para o calendário.", route: "/app/agenda", profile: "Dora Sampaio", waitFor: "h1", href: "/demonstracao" },
  { id: "minuta", title: "Minutas e Word", caption: "Minutas com campos obrigatórios, aprovação por advogado(a) e exportação em .docx com a marca do escritório.", route: "/app/minutas/dr-lucia", profile: "Rafael Nunes", waitFor: '[data-tour="editor-minuta"]', href: "/demonstracao" },
  { id: "previdenciario", title: "Previdenciário", caption: "Análise previdenciária por etapas, com pendências de documentos e comparação de cenários para revisão profissional.", route: "/app/previdenciario/analises/pa-joao", profile: "Rafael Nunes", waitFor: "h1", href: "/demonstracao" },
  { id: "financeiro", title: "Honorários e financeiro", caption: "Parcelas, baixas parciais com estorno, caixa por mês, conciliação e recibos — separado da assinatura da plataforma.", route: "/app/financeiro", profile: "Caio Martins", waitFor: "h1", href: "/demonstracao" },
  { id: "identidade", title: "Sua marca e seu aplicativo", caption: "Logotipo, cores com contraste verificado e o aplicativo do escritório com QR Code de instalação.", route: "/app/configuracoes/branding", profile: "Helena Prado", waitFor: "h1", href: "/demonstracao" },
  { id: "portal", title: "Portal do cliente", caption: "O cliente acompanha o caso em linguagem simples, envia documentos e vê só o que o escritório publicou.", route: "/portal", profile: "Maria das Graças", waitFor: "h1", href: "/demonstracao" },
  { id: "superadmin", title: "Gestão da plataforma", caption: "Para quem opera a LexSion: escritórios, planos, períodos de teste e faturas da assinatura.", route: "/admin", profile: "Suporte LexSion", waitFor: "h1", href: "/demonstracao" },
];
