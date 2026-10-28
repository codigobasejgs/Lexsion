# 03 — Conversão de mocks para real

| Antes (demo) | Agora na operação |
|---|---|
| Sessão em `localStorage` com perfis fictícios | Sessão Supabase (cookie) + vínculos reais (`my_access`); sem vínculo = não entra |
| IndexedDB com fixtures | `org_records` no Supabase, via RLS; escritório novo começa **vazio** |
| Data fixa 26/10/2026 | Data real (America/Sao_Paulo) |
| Lista de pessoas fictícias | Equipe real do escritório (`org_team`) |
| Arquivo como Blob local | Storage privado; visualização por link temporário de 5 min |
| Convite "simulado" | Convite real por e-mail (Supabase Auth + Resend) |
| Criar escritório local | Escritório real + convite do titular (`/api/admin/escritorios`) |
| Portal com filtro na tela | Portal com filtro no banco (`portal_snapshot`) |
| Restaurar demo / escritório | Desligado na operação (nunca apaga dado real) |
| Falha de rede | Tela "Sem conexão" — **nunca** cai na demonstração |

## Ações simuladas retiradas da operação
| Tela | Na operação |
|---|---|
| Assinatura de contrato | "Registrar assinatura" (assinatura em papel/outra ferramenta), com aviso de que ZapSign não está ativo |
| Aceite/recusa de proposta | "Cliente aceitou / recusou" (registro da resposta recebida fora do sistema) |
| Follow-up e lembrete de parcela | "Registrar contato feito" — nada é enviado |
| Eventos de provedor (faturas SaaS, integrações, WhatsApp) | Ocultos |
| Envio de e-mail de teste | Oculto |
| Formulário de campanha simulado | Oculto |
| Atendimento WhatsApp, IA, automações, cobranças online, assinatura eletrônica, marketing/anúncios, jornal, pesquisa de jurisprudência | **Bloqueados** com o motivo e o que falta (ver `08`) |

A demonstração (`/demonstracao`) mantém todas as simulações, isoladas no navegador.
