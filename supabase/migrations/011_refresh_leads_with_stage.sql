-- Migration: 011_refresh_leads_with_stage.sql | Date: 2026-05-05
--
-- Refresca la vista `leads_with_stage` para que incluya las columnas
-- agregadas a `leads` después de su creación original (migración 004).
--
-- Concretamente: la migración 008 agregó la columna generada
-- `is_campaign_lead` a `leads`, pero la vista (con `l.*`) no la había
-- incorporado en su definición cacheada. Esto rompía los stored
-- procedures `compute_mofu_facts` y `compute_bofu_facts` (migración 009)
-- que referencian `lws.is_campaign_lead`.
--
-- Solución: DROP + CREATE para forzar la regeneración de la lista de
-- columnas. Los stored procedures siguen funcionando porque la vista
-- se vuelve a crear inmediatamente con la misma estructura + columnas
-- nuevas.

DROP VIEW IF EXISTS leads_with_stage CASCADE;

CREATE VIEW leads_with_stage AS
SELECT
  l.*,
  COALESCE(fs.funnel_stage, 'excluded') AS funnel_stage,
  COALESCE(fs.is_high_intent, false)    AS is_high_intent,
  COALESCE(fs.is_closed_won, false)     AS is_closed_won,
  COALESCE(fs.is_typified, false)       AS is_typified,
  COALESCE(fs.is_lost, false)           AS is_lost,
  COALESCE(fs.is_incubating, false)     AS is_incubating,
  fs.display_order                      AS funnel_display_order
FROM leads l
LEFT JOIN funnel_stages fs
  ON fs.client_slug  = l.client_slug
 AND fs.section_name = l.section
 AND fs.is_active    = true;

COMMENT ON VIEW leads_with_stage IS
  'Vista canónica leads + funnel_stages. Refresca columnas de leads tras 008.';

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
-- DROP VIEW IF EXISTS leads_with_stage CASCADE;
