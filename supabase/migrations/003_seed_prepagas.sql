-- Migration: 003_seed_prepagas.sql | Date: 2026-04-27 | Author: supabase-architect
--
-- Seed inicial de funnel_stages para client_slug='prepagas' (Prevención Salud).
-- Bootstraps las 14 secciones del CRM MeisterTask con los flags semánticos correctos.
--
-- Idempotente: usa ON CONFLICT (client_slug, section_name) DO UPDATE para que
-- re-ejecutar la migración sincronice cualquier cambio sin duplicar filas.
--
-- En cada run del pipeline, este seed es sobrescrito por el sync desde
-- config/clients/prepagas.yaml — el YAML es la fuente de verdad. Este archivo
-- existe solo para que el dashboard funcione antes del primer run del pipeline.

INSERT INTO funnel_stages (
  client_slug, section_name, funnel_stage,
  is_high_intent, is_closed_won, is_typified, is_lost, is_incubating, is_active,
  display_order
) VALUES
  ('prepagas', 'Inbox',              'mofu',     false, false, false, false, false, true,  1),
  ('prepagas', 'Nuevo',              'mofu',     false, false, false, false, false, true,  2),
  ('prepagas', 'Prioritarios',       'mofu',     true,  false, true,  false, false, true,  3),
  ('prepagas', 'Para Hoy',           'mofu',     false, false, true,  false, false, true,  4),
  ('prepagas', 'Procesando',         'mofu',     false, false, true,  false, false, true,  5),
  ('prepagas', 'Contactados',        'mofu',     false, false, true,  false, false, true,  6),
  ('prepagas', 'Cotizados',          'mofu',     true,  false, true,  false, false, true,  7),
  ('prepagas', 'En Auditoria',       'mofu',     true,  false, true,  false, false, true,  8),
  ('prepagas', 'Mes que viene',      'mofu',     false, false, true,  false, true,  true,  9),
  ('prepagas', 'A futuro',           'mofu',     false, false, true,  false, true,  true, 10),
  ('prepagas', 'Ventas Ganadas',     'bofu',     false, true,  true,  false, false, true, 11),
  ('prepagas', 'No prospera',        'mofu',     false, false, true,  true,  false, true, 12),
  ('prepagas', 'Erroneos',           'excluded', false, false, false, false, false, true, 13),
  ('prepagas', 'Tareas Finalizadas', 'excluded', false, false, false, false, false, true, 14)
ON CONFLICT (client_slug, section_name) DO UPDATE SET
  funnel_stage   = EXCLUDED.funnel_stage,
  is_high_intent = EXCLUDED.is_high_intent,
  is_closed_won  = EXCLUDED.is_closed_won,
  is_typified    = EXCLUDED.is_typified,
  is_lost        = EXCLUDED.is_lost,
  is_incubating  = EXCLUDED.is_incubating,
  is_active      = EXCLUDED.is_active,
  display_order  = EXCLUDED.display_order,
  updated_at     = NOW();

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
--
-- DELETE FROM funnel_stages WHERE client_slug = 'prepagas';
