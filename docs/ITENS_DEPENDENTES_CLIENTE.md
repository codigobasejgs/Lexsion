# Itens que dependem da cliente

| Item | Por que | Onde entra |
|---|---|---|
| Nome final (SIWILTEC ou SIWILTECK.IA) | Grafia diverge entre imagem e prompt | `DECISOES_MARCA.md` |
| Logo em vetor (SVG) + autorização de uso | Só há JPEG de WhatsApp | ícones PWA, cabeçalho |
| Material dos dois livros (“O segredo do empreendedorismo jurídico na era da tecnologia” e “A saga do advogado-vendedor”) | Não fornecidos; nada foi criado no lugar | Academia (hoje: “Aguardando material da autora”) |
| Termos de uso e política de privacidade | Texto jurídico próprio do escritório | Configurações → Dados e LGPD |
| Validação dos roteiros de triagem por área | Perguntas são ponto de partida | `src/domain/triage.ts` |
| Regras previdenciárias e de cálculo validadas | Resultados atuais são exemplos | Previdenciário, Cálculos |
| Calendário de feriados/suspensões por tribunal | Lista atual é de exemplo | Configurações → Feriados |
| Escolha do provedor de pagamento e de assinatura | Asaas / InfinitePay / Mercado Pago; ZapSign | `INTEGRACOES_BACKEND_FASE_2.md` |
| Instância Evolution existente (transporte) | Baileys × Cloud API muda o fluxo | Integrações |
| Contas e acessos (GitHub, Vercel, Supabase) | Publicação exige autorização | `GUIA_GITHUB_VERCEL.md` |
| Teste em aparelhos reais | Não há aparelho no ambiente | `qa/06-PWA_CROSS_BROWSER.md` |
| Inspeção das fórmulas/macros da planilha Tícius | Só a estrutura foi lida, por segurança | `MATRIZ_TICIUS.md` |
| **Troca das senhas citadas na conversa de WhatsApp** | A conversa contém credenciais de terceiros | ação imediata recomendada |
