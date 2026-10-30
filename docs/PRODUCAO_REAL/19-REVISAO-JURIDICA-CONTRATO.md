# Revisão jurídica — Contrato SaaS LexSion, minuta 2026.10-1

Documento gerado a partir do texto exato exibido em /contratar. **Nenhuma decisão jurídica foi tomada pelo sistema.**
O aceite público só é liberado depois que a versão sem nenhum “[PENDENTE]” for aprovada (nome e OAB) e publicada em Super Admin → Contratos SaaS. O banco recusa aprovar texto com pendência.

## 1. Decisões pendentes

| # | Onde | Decisão necessária | Opção de redação para avaliar (não é recomendação jurídica) | Responsável | Situação |
|---|---|---|---|---|---|
| P1 | Cláusula 2 — Plano, preço e ciclo | prazo de aviso de reajuste | Ex.: “mediante aviso prévio de 30 (trinta) dias por e-mail ao titular”. | Advogado(a) / proprietário | Pendente |
| P2 | Cláusula 6 — Obrigações da CONTRATADA | política de suporte e SLA a aprovar; nenhuma meta de disponibilidade é prometida nesta minuta | Definir canais, horários e prazos de resposta reais; não prometer disponibilidade (uptime) sem medição. | Advogado(a) / proprietário | Pendente |
| P3 | Cláusula 8 — Pagamentos, renovação e inadimplência | multa, juros e correção, se houver, a definir; nenhum encargo é cobrado enquanto não definido | Definir se haverá multa/juros/correção; alternativa: “não há encargos; o atraso gera apenas a suspensão prevista em 8.2”. | Advogado(a) / proprietário | Pendente |
| P4 | Cláusula 9 — Cancelamento, rescisão e arrependimento | política de reembolso a definir | Ex.: “sem reembolso proporcional do período em curso, salvo o direito de arrependimento”. | Advogado(a) / proprietário | Pendente |
| P5 | Cláusula 9 — Cancelamento, rescisão e arrependimento | análise jurídica de aplicabilidade conforme o perfil da CONTRATANTE | Avaliar o art. 49 do CDC para PF (advogado autônomo) e PJ; redigir prazo e forma do reembolso. | Advogado(a) / proprietário | Pendente |
| P6 | Cláusula 9 — Cancelamento, rescisão e arrependimento | prazo | Ex.: “notificação com 10 (dez) dias para regularização antes da rescisão”. | Advogado(a) / proprietário | Pendente |
| P7 | Cláusula 11 — Armazenamento, backups, retenção e portabilidade | política de retenção a aprovar | Ex.: “dados mantidos por 90 dias após o encerramento para exportação; depois, eliminados, salvo obrigação legal”. | Advogado(a) / proprietário | Pendente |
| P8 | Cláusula 18 — Solução de controvérsias e foro | cláusula de foro a definir em revisão jurídica, observadas as normas de proteção ao consumidor quando aplicáveis | Ex.: foro do domicílio do contratante quando consumidor; caso contrário, comarca de São Paulo/SP. | Advogado(a) / proprietário | Pendente |
| P10 | Cláusulas 6, 10 e 18 (dados da contratada) | canal oficial de atendimento e comunicações contratuais | Cadastrar e-mail monitorado em Super Admin → Contratos SaaS → Contratada (a pendência some sozinha do texto). | Proprietário | Pendente |
| P9 | Cláusula Anexo III — Tratamento de dados e suboperadores | acordo de tratamento de dados (DPA) a aprovar. | Anexar DPA com finalidades, segurança, incidentes, suboperadores e transferência internacional. | Advogado(a) / proprietário | Pendente |

## 2. Pontos para conferência obrigatória (sem pendência marcada, mas exigem revisão)

- Qualificação da contratada (nome empresarial, natureza, CNPJ, endereço) e o uso da marca “LexSion — ERP Jurídico SaaS”.
- Cláusula 5 e Anexo II: limites da IA, caráter demonstrativo dos cálculos e o fato de que o software não presta serviços advocatícios.
- Cláusula 10 e Anexo III: papéis LGPD (controlador/operador), suboperadores e transferência internacional (Supabase/Vercel nos EUA).
- Cláusula 11: ausência de PITR e perda máxima de ~24 h (declaração factual da operação atual).
- Cláusula 17: aceite por clickwrap com código de uso único (art. 10, § 2º, MP 2.200-2/2001); confirmar suficiência para PF e PJ.
- Cláusula 2.2 e Termos: teste grátis de 30 dias sem cartão e a primeira cobrança por link (não há débito automático).

## 3. Como registrar a aprovação

1. No Super Admin → Contratos SaaS → “Criar nova versão a partir desta”, substitua cada “[PENDENTE: …]” pelo texto decidido e informe o motivo.
2. “Enviar para revisão jurídica”.
3. O(a) advogado(a) informa nome e OAB, confirma a revisão e clica em “Aprovar versão”.
4. Concluído o checklist (contratada, fiscal, InfinitePay, cláusulas críticas, consumo, LGPD), clique em “Publicar”.

## 4. Texto integral da minuta

### Partes

CONTRATADA: {{contratada.qualificacao}}.

CONTRATANTE: {{contratante.qualificacao}}.

As partes celebram este contrato, que se rege pelas cláusulas a seguir e pelo Quadro-Resumo (Anexo I).

### 1. Objeto

1.1. Licença de uso limitada, não exclusiva, intransferível e revogável nos termos deste contrato, para acesso pela internet (navegador e aplicativo instalável/PWA) ao software de gestão jurídica LexSion, no modelo de assinatura (SaaS), para uso interno e lícito do escritório da CONTRATANTE, com os módulos do plano contratado.

1.2. Este contrato não transfere propriedade de código-fonte, não inclui hospedagem dedicada nem garante resultado jurídico de qualquer natureza.

### 2. Plano, preço e ciclo

2.1. Plano {{plano.nome}} (versão comercial {{plano.versao}}), ciclo {{plano.ciclo}}, valor de {{plano.valor}} por ciclo, com até {{plano.usuarios}}.

2.2. Condição inicial: {{plano.teste}}.

2.3. Modalidade de cobrança: {{cobranca.modalidade}}.

2.4. O preço contratado fica congelado neste documento. Alteração de tabela vale apenas para novas contratações ou para renovação, mediante aviso prévio de [PENDENTE: prazo de aviso de reajuste].

2.5. Não há cobrança de excedentes: o limite de usuários é aplicado pelo sistema, e a ampliação depende de troca de plano.

### 3. Ativação, acesso e usuários

3.1. O ambiente do escritório é criado após a confirmação do pagamento pela InfinitePay ou, havendo teste gratuito, após o aceite deste contrato. O acesso de titular é enviado ao e-mail indicado no cadastro.

3.2. A CONTRATANTE designa e retira os acessos de sua equipe, define papéis e permissões e responde pelo uso feito com as credenciais de seus membros.

3.3. A identidade visual do escritório (marca própria) e o aplicativo instalável (PWA) são configurados pela CONTRATANTE dentro da plataforma.

### 4. Funcionalidades incluídas e serviços de terceiros

4.1. Recursos ativos no plano na data deste contrato: {{plano.recursos_ativos}}.

4.2. Recursos NÃO ativos nesta data (não integram o objeto até sua disponibilização formal): {{plano.recursos_nao_ativos}}.

4.3. Recursos que dependem de terceiros (por exemplo: WhatsApp, inteligência artificial, fontes legislativas e de jurisprudência, assinatura eletrônica, cobrança online de honorários) estão sujeitos à disponibilidade, licenças, limites e eventual cobrança desses terceiros, não sendo prometidos como plenamente operacionais quando não homologados.

4.4. Cálculos previdenciários e demais cálculos têm natureza demonstrativa até validação profissional, conforme Anexo II.

### 5. Limites da informação e responsabilidade profissional

5.1. A LexSion é ferramenta de apoio administrativo e jurídico. Pesquisas, resumos, minutas, monitoramento legislativo e cálculos exigem verificação humana das fontes, premissas e legislação aplicável.

5.2. O sistema não substitui o(a) advogado(a), não representa a CONTRATANTE em juízo e não garante êxito, cumprimento de prazo processual ou atualização instantânea de fontes externas.

### 6. Obrigações da CONTRATADA

6.1. Disponibilizar os recursos ativos do plano, manter controles de segurança (isolamento entre escritórios, verificação em duas etapas para a administração da plataforma, trilha de auditoria) e prestar atendimento pelo canal {{contratada.contato}}.

6.2. Nível de serviço (disponibilidade e prazos de atendimento): [PENDENTE: política de suporte e SLA a aprovar; nenhuma meta de disponibilidade é prometida nesta minuta].

### 7. Obrigações da CONTRATANTE

7.1. Usar o sistema de forma lícita; manter dados cadastrais corretos; guardar o sigilo das credenciais; respeitar a LGPD e o sigilo profissional; gerir sua equipe; usar a automação de atendimento com responsabilidade; não compartilhar acessos indevidamente.

7.2. Observar as normas da OAB aplicáveis à publicidade e ao marketing jurídico.

### 8. Pagamentos, renovação e inadimplência

8.1. A cada período, a cobrança do período seguinte é emitida por link e enviada ao e-mail do titular com antecedência de 7 (sete) dias do vencimento.

8.2. Sem pagamento até 5 (cinco) dias após o vencimento, o acesso é suspenso, sem exclusão de dados, e reativado após a confirmação do pagamento.

8.3. Encargos por atraso: [PENDENTE: multa, juros e correção, se houver, a definir; nenhum encargo é cobrado enquanto não definido].

### 9. Cancelamento, rescisão e arrependimento

9.1. A CONTRATANTE pode cancelar a qualquer tempo pela própria plataforma (Configurações > Assinatura), com efeito ao fim do período já pago.

9.2. Reembolso de período em curso: [PENDENTE: política de reembolso a definir].

9.3. Direito de arrependimento (art. 49 do CDC), quando aplicável à contratação: [PENDENTE: análise jurídica de aplicabilidade conforme o perfil da CONTRATANTE]. Nada neste contrato afasta direitos legais irrenunciáveis.

9.4. A rescisão por descumprimento depende de notificação prévia com prazo para regularização: [PENDENTE: prazo].

### 10. Dados pessoais, LGPD e sigilo profissional

10.1. Quanto aos dados dos clientes e processos que insere, a CONTRATANTE é controladora e a CONTRATADA atua como operadora, tratando-os apenas para prestar o serviço.

10.2. Quanto aos dados cadastrais e de faturamento da própria CONTRATANTE, a CONTRATADA é controladora, para as finalidades de contratação, cobrança, segurança e cumprimento legal.

10.3. A administração da plataforma não tem permissão para ler documentos e dados jurídicos dos escritórios por meio das funções comerciais e de faturamento.

10.4. Suboperadores e detalhes do tratamento: Anexo III. Comunicação de incidentes: pelo canal {{contratada.contato}}, nos termos da lei.

### 11. Armazenamento, backups, retenção e portabilidade

11.1. Os dados são armazenados em infraestrutura de nuvem (Supabase), com cópia de segurança diária cifrada em provedor distinto (Cloudflare R2). Não há recuperação de ponto exato no tempo (PITR): a perda máxima em caso de desastre é de até aproximadamente 24 (vinte e quatro) horas.

11.2. A CONTRATANTE pode exportar seus dados pelas funções disponíveis na plataforma.

11.3. Prazo de retenção após o encerramento e procedimento de eliminação: [PENDENTE: política de retenção a aprovar].

### 12. Propriedade intelectual e marcas

12.1. O software, sua marca LexSion e componentes são de titularidade da CONTRATADA ou de seus licenciantes, nos termos dos documentos de titularidade aplicáveis.

12.2. A CONTRATANTE mantém os direitos sobre o conteúdo que insere e autoriza a exibição de sua marca no próprio ambiente, apenas para a prestação do serviço.

### 13. Terceiros e integrações

13.1. O serviço depende de terceiros, entre eles: Supabase (banco de dados e autenticação), Vercel (hospedagem), Cloudflare (cópias de segurança), Resend (e-mails), InfinitePay (pagamentos) e, quando ativados pela CONTRATANTE, provedores de WhatsApp e de inteligência artificial.

13.2. Não há promessa de acesso a sistemas de tribunais, do INSS ou a bases privadas sem a respectiva autorização ou licença.

### 14. Segurança e incidentes

14.1. Isolamento de dados por escritório no banco (políticas de acesso por linha), verificação em duas etapas obrigatória para a administração da plataforma, trilha de auditoria e cópias de segurança cifradas.

14.2. A CONTRATANTE responde pela segurança das contas de sua equipe e deve comunicar imediatamente suspeita de acesso indevido.

### 15. Comunicações

15.1. Comunicações contratuais, de cobrança e de alterações relevantes são enviadas ao e-mail do titular cadastrado e ficam registradas.

15.2. Comunicações de marketing dependem de consentimento próprio, separado deste contrato e revogável a qualquer tempo.

### 16. Vigência, alterações e documentos

16.1. Vigência a partir do aceite eletrônico, por prazo indeterminado, renovando-se a cada ciclo pago.

16.2. Integram este contrato: o Quadro-Resumo (Anexo I), os avisos do Anexo II, o Anexo III, a Política de Privacidade e os Termos de Uso publicados.

16.3. Alterações relevantes deste contrato exigem nova versão e novo aceite; a versão aceita não é substituída silenciosamente.

### 17. Aceite eletrônico e integridade

17.1. O aceite é feito por meio eletrônico (clickwrap): leitura do texto integral, confirmação expressa e código de uso único enviado ao e-mail do titular. São registrados data e hora (UTC), versão do modelo, impressão digital SHA-256 do texto aceito, e-mail, identificação do navegador e um código derivado do endereço IP.

17.2. As partes reconhecem esse meio como apto à comprovação de autoria e integridade, nos termos do art. 10, § 2º, da MP 2.200-2/2001, sem que isso caracterize assinatura qualificada ICP-Brasil. A cópia em PDF é disponibilizada à CONTRATANTE após o aceite.

### 18. Solução de controvérsias e foro

18.1. As partes buscarão solução amigável pelo canal {{contratada.contato}}.

18.2. Foro: [PENDENTE: cláusula de foro a definir em revisão jurídica, observadas as normas de proteção ao consumidor quando aplicáveis].

### Anexo I. Quadro-resumo da contratação

Contrato nº {{contrato.numero}} · modelo {{contrato.versao}} · {{contrato.data}}.

Contratada: {{contratada.nome}}.

Contratante: {{contratante.nome}}.

Plano: {{plano.nome}} (versão {{plano.versao}}) · ciclo {{plano.ciclo}} · {{plano.valor}} por ciclo · até {{plano.usuarios}}.

Condição inicial: {{plano.teste}}.

Cobrança: {{cobranca.modalidade}}.

Recursos ativos: {{plano.recursos_ativos}}.

Recursos não ativos: {{plano.recursos_nao_ativos}}.

### Anexo II. Avisos sobre serviços jurídicos, IA e limites técnicos

Informações legislativas são coletadas de fontes oficiais (Câmara dos Deputados e Senado Federal) e podem ter atraso. Sugestões de inteligência artificial exigem revisão humana antes de qualquer uso. Cálculos são demonstrativos até validação profissional. Integrações dependem de licenças e credenciais de terceiros.

### Anexo III. Tratamento de dados e suboperadores

[PENDENTE: acordo de tratamento de dados (DPA) a aprovar.] Suboperadores atuais: Supabase (banco de dados e autenticação, EUA), Vercel (hospedagem, EUA), Cloudflare (cópias de segurança), Resend (e-mails), InfinitePay (pagamentos, Brasil) e, quando ativados, provedores de WhatsApp e de inteligência artificial.
