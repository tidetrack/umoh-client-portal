-- Migration: 004_views.sql | Date: 2026-04-27 | Author: supabase-architect
--
-- Vista `leads_with_stage` — fuente de verdad para todas las métricas del dashboard.
--
-- JOINea `leads` con `funnel_stages` por (client_slug, section_name) y solo
-- considera filas activas (is_active=true). Si una sección está soft-deleted
-- en funnel_stages, sus leads caen automáticamente a funnel_stage='excluded'
-- por el COALESCE — no contaminan métricas pero se preservan en `leads`.
--
-- Ventajas de la vista vs columna en `leads`:
--   1. Reclasificar una sección (ej: mover "En Auditoria" de MOFU a BOFU) NO
--      requiere reimportar nada. Solo se actualiza el YAML, se sincroniza la
--      tabla, y la vista refleja el cambio.
--   2. Evita inconsistencias entre el snapshot de leads y la configuración
--      vigente del funnel.
--   3. Las métricas operan sobre flags semánticos, no sobre nombres hardcoded.
--
-- IMPORTANTE: requiere que exista la tabla `leads` (migración 001) y
-- `funnel_stages` (migración 002). Aplicar en orden.

CREATE OR REPLACE VIEW leads_with_stage AS
SELECT
  l.*,
  -- Funnel derivation
  COALESCE(fs.funnel_stage, 'excluded') AS funnel_stage,

  -- Flags semánticos (con fallback a false si la sección no está en funnel_stages)
  COALESCE(fs.is_high_intent, false)    AS is_high_intent,
  COALESCE(fs.is_closed_won, false)     AS is_closed_won,
  COALESCE(fs.is_typified, false)       AS is_typified,
  COALESCE(fs.is_lost, false)           AS is_lost,
  COALESCE(fs.is_incubating, false)     AS is_incubating,

  -- Display
  fs.display_order                      AS funnel_display_order
FROM leads l
LEFT JOIN funnel_stages fs
  ON fs.client_slug  = l.client_slug
 AND fs.section_name = l.section
 AND fs.is_active    = true;            -- soft-delete: huérfanas no matchean

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
--
-- DROP VIEW IF EXISTS leads_with_stage;
