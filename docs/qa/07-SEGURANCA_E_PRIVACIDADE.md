# 07 — Segurança e privacidade

Revisão estática do frontend. **Não é certificação de segurança**: sem backend não existe autenticação real nem isolamento por servidor.

| Verificação | Método | Resultado |
|---|---|---|
| Segredos no código | busca por padrões (`sk_live`, `pk_live`, `AKIA…`, `ghp_…`, JWT `eyJ…`, `service_role`, `api_key=`, `senha:`) em `src`, `tests`, `docs`, `public`, `scripts` | nenhum segredo |
| `NEXT_PUBLIC_*` com chave | busca | nenhum; `.env.example` só com nomes vazios e aviso |
| Credenciais na página de integrações | E2E lê o HTML de Asaas, Mercado Pago, InfinitePay, ZapSign | nenhum valor do tipo chave/token |
| Dados de clientes reais | comparação de nomes próprios da conversa de WhatsApp com `src/tests/docs` | 0 ocorrências; fixtures marcadas “Exemplo/Fictício/Teste” |
| Materiais confidenciais no Git | `Documentação/` está fora do diretório do repositório | não versionados |
| Macros da planilha | arquivo contém VBA; lido só o índice de abas (ZIP) por script, sem Excel | não executado |
| XSS | editor de minuta, nomes, importação: React escapa texto; `dangerouslySetInnerHTML` só no script fixo de tema; impressão escapa `& < >`; DOCX escapa XML | E2E DOC-07 sem execução de script |
| CSV injection | `csvCell` prefixa `'` em `= + - @`; E2E exporta caixa com justificativa `=1+1` | neutralizado |
| Links externos | `target="_blank"` com `rel="noopener noreferrer"` | ok |
| Cabeçalhos | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` em todas as rotas; `sw.js` sem cache e com CSP própria | ok |
| Dependências | auditoria `pnpm audit` **não executada** (sem rede) | pendente |
| CSP das páginas | não configurada (Next.js usa scripts inline); avaliar com nonce na fase backend. `Permissions-Policy` também não configurada | pendente |

## Limites da demonstração
- Perfis só escondem telas no navegador. Qualquer pessoa com acesso ao navegador vê os dados fictícios guardados nele.
- Sessão demo é um id em `localStorage` — sem senha, sem token.
- Uploads ficam no IndexedDB do próprio navegador; a tela avisa para não usar documentos reais.
- LGPD: pedidos de eliminação passam por revisão de retenção; exportação JSON só de dados fictícios.

## Risco registrado
A conversa de WhatsApp em `Documentação/` contém marcadores de login/senha de serviços de terceiros. Recomenda-se **trocar essas senhas** e não reenviá-las por mensagem. Os valores não foram lidos para nenhum relatório, código ou log.
