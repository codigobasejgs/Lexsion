# 17 — Bugs e regressões

Histórico das fases anteriores (BUG-01..13): `docs/qa/04-BUGS_ENCONTRADOS_E_CORRIGIDOS.md`.

## Encontrados e corrigidos nesta fase
| ID | Sev. | Reprodução | Correção | Regressão |
|---|---|---|---|---|
| LX-01 | P0 | Sair do sistema apagava dados criados na demo | `signOut` só limpa sessão e caches de shell; migração `mergeSeed` sem perda | DATA-02/03, unit `data-safety` |
| LX-02 | P2 | Celular: aviso de armazenamento cobria “Entrar” | aviso em barra fixa superior | ROB-01 |
| LX-03 | P2 | `<link rel=manifest>` duplicado e título vazio após navegação | `TenantTheme` deduplica e ajusta título; cookie demo antes de navegar | PWA-013 |
| LX-04 | P2 | Aba da demo do escritório entrava sozinha após reativação | `decided` (ref) na página `/demo/tenant/[slug]` | QA-115/120 |
| LX-05 | P2 | Contraste: sucesso no tema claro e marca cinza do escritório | `#0f6b59`; marca escurecida até 4,5:1 | unit `contrast`, `tenant-brand` |
| LX-06 | P2 | QR versão 10 ilegível | posicionamento dos padrões de alinhamento | unit `qr`, OpenCV 6/6 |
| LX-07 | P3 | Linguagem simples explicava termo dentro da explicação | faixas protegidas, função idempotente | unit `plain-language` |
| LX-08 | P2 | Gestor operacional veria a assinatura (regra: só titular) | aba restrita a `admin` | QA-RBAC-06 |
| LX-09 | P3 | Tour do Super Admin existia sem ponto de acesso | botão “Tour guiado” no menu | QA-RBAC-07 |
| LX-10 | P3 | Celular baixava 1,3 MB de prints na landing (variante desktop do diálogo + print 1024 px) | imagem do diálogo só ao abrir; 720 px | `landing.perf.ts` |

Nenhum P0/P1 aberto.

## Antirregressões exigidas (seção 24 do prompt)
| # | Item | Situação | Teste |
|---|---|---|---|
| 1 | localStorage bloqueado não trava a demo | OK | ROB-01 |
| 2 | Persistência e aviso de sessão temporária | OK | DATA-02, ROB-01/03 |
| 3 | Rascunho não publicado ao cliente | OK | FLUXO G / PORT-02 |
| 4 | Minuta com campo vazio não aprova | OK | DOC-03 |
| 5 | DOCX abrível e sem injeção | OK | DOC-04/05/07, unit `docx` |
| 6 | Overflow 320/768/zoom 200% | OK | `qa-responsivo` |
| 7 | Contraste ouro no tema claro | OK | unit `contrast`, axe tema claro |
| 8 | CRM paginação; caixa por mês | OK | CRM-05, FIN-06 |
| 9 | Tícius sem macros nem dado real | OK | unit `importer`, `docs/MATRIZ_TICIUS.md` |
| 10 | Prints da ajuda após mudança de layout | OK | recapturados 27/10/2026; unit `help` |
| 11 | Papéis e triagem por área | OK | QA-RBAC-*, unit `crm` |
| 12 | Cache PWA sem marca/dado de outro tenant | OK | DATA-03, BRAND-010, unit `tenant-brand` |
| 13 | Super Admin sem honorários na receita | OK | QA-165/166 |
| 14 | Navegação landing/login/demo coerente | OK | QA-ROTA-01, QA-LANDING-03 |
| 15 | 12 papéis declarados e existentes (14 perfis na demo cobrem os 12) | OK | QA-RBAC-01, QA-DEMO-01 |
