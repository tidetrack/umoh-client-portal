-- Migration: 002_funnel_stages.sql | Date: 2026-04-27 | Author: supabase-architect
--
-- Tabla `funnel_stages` — configuración del funnel por cliente. Cache vivo del YAML.
--
-- Cada cliente define en `config/clients/{slug}.yaml` cómo se mapea cada sección
-- de su CRM (MeisterTask) al funnel canónico (TOFU/MOFU/BOFU/excluded) y qué flags
-- semánticos aplican. El pipeline sincroniza el YAML a esta tabla en cada run.
--
-- Flags semánticos (8):
--   - is_high_intent   : lead listo para cerrar (Cotizados, Prioritarios, En Auditoria)
--   - is_closed_won    : venta cerrada (Ventas Ganadas)
--   - is_typified      : lead con segmento asignado (Voluntario/Monotributista/Obligatorio)
--   - is_lost          : lead que descartó (No prospera). Reemplaza hardcoding por nombre.
--   - is_incubating    : lead con potencial pero no listo (A futuro, Mes que viene).
--   - is_active        : soft-delete. false = sección huérfana del YAML, no participa de métricas.
--
-- Esta tabla NO almacena leads; es solo configuración. La PK incluye client_slug
-- porque cada cliente define sus propias secciones — un mismo nombre puede tener
-- semántica distinta entre clientes.

CREATE TABLE IF NOT EXISTS funnel_stages (
  client_slug      TEXT NOT NULL,
  section_name     TEXT NOT NULL,
  funnel_stage     TEXT NOT NULL CHECK (funnel_stage IN ('tofu','mofu','bofu','excluded')),

  -- Flags semánticos
  is_high_intent   BOOLEAN DEFAULT false,
  is_closed_won    BOOLEAN DEFAULT false,
  is_typified      BOOLEAN DEFAULT false,
  is_lost          BOOLEAN DEFAULT false,
  is_incubating    BOOLEAN DEFAULT false,

  -- Soft-delete: si la sección desaparece del YAML, queda is_active=false (no DELETE)
  is_active        BOOLEAN DEFAULT true,

  -- Orden visual en el dashboard
  display_order    INTEGER,

  -- Auditoría
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (client_slug, section_name)
);

CREATE INDEX IF NOT EXISTS idx_funnel_stage  ON funnel_stages(client_slug, funnel_stage);
CREATE INDEX IF NOT EXISTS idx_funnel_active ON funnel_stages(client_slug, is_active) WHERE is_active = true;

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
--
-- DROP INDEX IF EXISTS idx_funnel_active;
-- DROP INDEX IF EXISTS idx_funnel_stage;
-- DROP TABLE IF EXISTS funnel_stages;
