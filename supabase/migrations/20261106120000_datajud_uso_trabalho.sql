-- DataJud (CNJ): consulta pontual de metadados por número CNJ, para uso de trabalho dos escritórios.
-- Decisão do proprietário em 06/11/2026 ("não será vendido, apenas uso de trabalho conforme fornecido"), à luz do
-- termo de uso v1.2 (itens 3.3 e 3.8). Sem coleta em massa, sem revenda; limite diário por escritório e auditoria.
update public.legal_source_providers
   set status = 'REAL_ATIVA', enabled = false, -- sem coleta agendada: só consulta sob demanda pela tela
       coverage = 'Capa e andamentos públicos de um processo, consultados pelo número CNJ (tribunais da API pública; STF fora)',
       status_note = 'Consulta pontual autenticada, sob demanda, para o trabalho do escritório. Sem partes, documentos ou sigilosos. Limite diário por escritório e cada consulta auditada. Termo de uso do CNJ v1.2: sem revenda nem exploração comercial dos dados.',
       updated_at = now()
 where id = 'datajud-cnj';
