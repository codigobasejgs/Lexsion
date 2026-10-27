# 09 — Evidências

| Evidência | Caminho | Observação |
|---|---|---|
| Logs da baseline (antes de editar) | `docs/qa/logs/baseline-*.txt` | install, lint, typecheck, test, build, E2E |
| Logs finais | `docs/qa/logs/final-*.txt` | lint, typecheck, test, build, test-e2e (204 passaram) |
| Medição de desempenho antes/depois | `docs/qa/logs/perf-antes.txt`, `perf-depois.txt` | LCP/CLS/TBT, JS transferido |
| Tamanho da primeira carga | `docs/qa/logs/bundle-primeira-carga.txt`, `bundle-depois.txt` | bruto e gzip por rota |
| Prints reais da ajuda (38) | `public/help/screenshots/0.1.0/*.png` + `manifest.json` | gerados pelo app com Playwright e fixtures fictícias; 6 em viewport de celular |
| Telas de referência (QA) | `test-results/ref/*.png` (local, não versionado) | geradas pelos E2E de fundação |
| DOCX aberto no Word | sessão COM do Word 16, somente leitura, macros desativadas | 7 parágrafos, estilo “Título 1”, cabeçalho e rodapé, acentos corretos |
| Leitura da planilha Tícius | `../_scratch/xlsb_sheets.py` (fora do repositório) | só nomes de abas; arquivo contém VBA, não executado |
| Tentativa de instalar Firefox/WebKit | saída: `connect ECONNREFUSED 127.0.0.1:1081` e `connect ETIMEDOUT` | ambiente sem acesso ao servidor de download |
| Histórico de alterações | `git log` em `siwiltec/` | cada etapa em commit separado |

Traces do Playwright só são gravados em falha (`test-results/`); a execução final não teve falhas.
