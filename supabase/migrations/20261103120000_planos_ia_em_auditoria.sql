-- Decisão do proprietário (03/11/2026): IA (Gemini) e WhatsApp (Evolution) NÃO ficam ativos para dados de clientes
-- até a auditoria. O catálogo dos planos passa a listar "Assistente de IA" como recurso NÃO ativo (ok=false), para que
-- /planos, o resumo e a cláusula 4.2 do contrato (recursos não ativos) digam a verdade. Preço, limites e demais
-- recursos não mudam. Idempotente. Reversão: trocar o rótulo de volta e ok=true.
update public.saas_plans p set features = (
  select jsonb_agg(case when f->>'label' = 'Assistente de IA com revisão humana'
                        then jsonb_build_object('label', 'Assistente de IA com revisão humana (em auditoria; não ativo para dados de clientes)', 'ok', false)
                        else f end order by ord)
  from jsonb_array_elements(p.features) with ordinality as x(f, ord)), updated_at = now()
where p.features @> '[{"label":"Assistente de IA com revisão humana"}]';
