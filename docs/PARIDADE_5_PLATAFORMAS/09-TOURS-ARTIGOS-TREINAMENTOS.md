# 09 — Tours, artigos e treinamentos

| Artigo novo | Rota | Perfis | Prints reais | Teste |
|---|---|---|---|---|
| `workflows-por-caso` | `/app/workflows` | Titular, advogado(a), controladoria | `workflows-por-caso-2.png` | unit `help` (rota → artigo → print) |
| `analisar-cnis-bpc-ppp` | `/app/previdenciario/...` | Advogado(a), estagiário(a), titular | `analisar-cnis-bpc-ppp-1.png`, `-3.png` | unit `help` |
| `fontes-e-versoes-da-minuta` | `/app/minutas/[id]` | Advogado(a), titular | `fontes-e-versoes-da-minuta-2.png` | unit `help` |
| `follow-up-e-opt-out` | `/app/crm/leads/[id]` | Atendimento, titular | `follow-up-e-opt-out-1.png` | unit `help` |
| `usar-calculos` (atualizado) | `/app/calculos` | Titular, advogado(a), estagiário(a) | prints anteriores mantidos | unit `help` |

- Ajuda contextual: `/app/workflows` foi incluída em `route-help.ts`. O teste exige artigo para **toda** rota do escritório, e ele pegou essa falta.
- Total: 37 artigos, 47 prints da ajuda (42 anteriores preservados + 5 novos), 18 tours (inalterados).
- Prints das telas novas para revisão: `08-PRINTS-REVISADOS/` (desktop 1440 e celular 390, dados fictícios).
- Linguagem leiga: artigos dizem o que é simulação, o que não decide direito e o que fazer em cada erro.
- Não feito: tour guiado novo para as telas da paridade (os artigos e a ajuda contextual cobrem o uso). Fica como melhoria P3.
