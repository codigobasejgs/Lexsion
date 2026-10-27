# 05 — Arquitetura comercial, login e demonstração

| Rota | Objetivo | Indexação | Observação |
|---|---|---|---|
| `/` | landing: proposta, módulos, prints reais, segurança, FAQ, CTA | indexável, canonical | 3 CTAs com destinos distintos (demo, funcionalidades, contato) |
| `/funcionalidades`, `/solucoes`, `/planos`, `/sobre`, `/contato`, `/instalar`, `/privacidade`, `/termos` | institucionais | indexáveis | planos **sem preço** (“Solicitar proposta”); termos e privacidade publicados como "versão provisória" até revisão jurídica do proprietário |
| `/entrar` | login profissional (escritório × cliente) | `noindex` | valida campos, mostra/oculta senha, resposta em tempo constante; **não cria sessão** |
| `/recuperar-acesso` | pedido de redefinição | `noindex` | declara que nenhum e-mail é enviado |
| `/demonstracao` | escolher escritório e função fictícios | `noindex` | prévia do que a função vê; “Entrar como …” |
| `/app`, `/portal`, `/admin` | sistema | `noindex` | sem sessão demo redireciona para `/demonstracao` |

## Redirects e links antigos
- Links profundos (`/app/...`, `/portal/...`) continuam válidos; sem sessão vão para `/demonstracao` (GEN-03/04).
- `/entrar` deixou de listar perfis; quem tinha esse link encontra o atalho “Explorar a demonstração”.
- `sitemap.xml` lista só páginas públicas (`SITE_URL = https://lexsion.com.br`).

## Formulário de contato
Valida e diz claramente que **nada foi enviado** (QA-LANDING-04). Envio real depende de Resend no servidor (fase 2).

## Regras de conteúdo cumpridas
Sem depoimentos, clientes, números de usuários, certificações, preços ou “IA real” inventados; linguagem compatível com o Provimento OAB 205/2021 (sem promessa de resultado).
