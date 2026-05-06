-- Migration: 001_initial.sql | Date: 2026-04-27 | Author: supabase-architect
--
-- Schema base del pipeline MeisterTask multi-tenant.
-- Crea las 5 tablas core:
--   1. leads                  — fila por tarea de MeisterTask, PK compuesta (client_slug, meistertask_id)
--   2. lead_section_history   — log inmutable de cambios de sección (movimientos en el tablero)
--   3. lead_monetary          — datos monetarios extraídos de notes/comments (cuota, capitas, precio)
--   4. lead_activity          — comentarios del CRM, dedup por hash del body
--   5. import_runs            — bitácora de cada corrida del pipeline (observabilidad)
--
-- Convenciones:
--   - client_slug TEXT NOT NULL en TODAS las tablas (multi-tenant día 1)
--   - PK compuesta (client_slug, external_id) cuando hay ID de API externa
--   - Índices secundarios siempre con client_slug adelante (planner los usa bien)
--   - TIMESTAMPTZ para todos los timestamps
--   - BIGINT para meistertask_id (IDs grandes de la API)
--   - NUMERIC(12,2) para dinero
--
-- Idempotencia: CREATE TABLE/INDEX IF NOT EXISTS — re-ejecutar la migración no rompe nada.

-- ============================================================
-- 1) Tabla `leads`
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  client_slug       TEXT NOT NULL,
  meistertask_id    BIGINT NOT NULL,
  token             TEXT NOT NULL,

  -- Parsed from title (NOMBRE // CANAL // TELÉFONO)
  nombre            TEXT,
  canal             TEXT,
  telefono          TEXT,
  name_raw          TEXT,

  -- Content
  notes             TEXT,
  checklists        TEXT,

  -- Pipeline (funnel_stage NO vive acá — se deriva vía vista leads_with_stage)
  section           TEXT NOT NULL,

  -- Assignment
  assignee          TEXT,

  -- Dates
  lead_created_at   TIMESTAMPTZ,
  lead_updated_at   TIMESTAMPTZ,
  due_date          TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ,
  mt_status         INTEGER,

  -- Tags (raw + categorized)
  tags_raw          TEXT,
  tipification      TEXT,
  lead_month        TEXT,
  prepaga           TEXT,
  operatoria        TEXT,
  has_cotizado_tag  BOOLEAN DEFAULT false,

  -- Import tracking
  last_imported_at  TIMESTAMPTZ DEFAULT NOW(),
  import_run_id     UUID,

  PRIMARY KEY (client_slug, meistertask_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_section      ON leads(client_slug, section);
CREATE INDEX IF NOT EXISTS idx_leads_assignee     ON leads(client_slug, assignee);
CREATE INDEX IF NOT EXISTS idx_leads_tipification ON leads(client_slug, tipification);
CREATE INDEX IF NOT EXISTS idx_leads_lead_month   ON leads(client_slug, lead_month);

-- ============================================================
-- 2) Tabla `lead_section_history`
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_section_history (
  id              BIGSERIAL PRIMARY KEY,
  client_slug     TEXT NOT NULL,
  meistertask_id  BIGINT NOT NULL,
  section_from    TEXT,
  section_to      TEXT NOT NULL,
  detected_at     TIMESTAMPTZ DEFAULT NOW(),
  import_run_id   UUID,

  CONSTRAINT fk_history_lead
    FOREIGN KEY (client_slug, meistertask_id)
    REFERENCES leads(client_slug, meistertask_id)
    ON DELETE CASCADE,

  -- Evita duplicar el mismo cambio si el pipeline corre 2x sin cambios reales
  CONSTRAINT uq_history_change
    UNIQUE (client_slug, meistertask_id, section_from, section_to, detected_at)
);

CREATE INDEX IF NOT EXISTS idx_history_lead       ON lead_section_history(client_slug, meistertask_id);
CREATE INDEX IF NOT EXISTS idx_history_section_to ON lead_section_history(client_slug, section_to);

-- ============================================================
-- 3) Tabla `lead_monetary`
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_monetary (
  id               BIGSERIAL PRIMARY KEY,
  client_slug      TEXT NOT NULL,
  meistertask_id   BIGINT NOT NULL,

  -- Plan info
  plan_code        TEXT,
  capitas          INTEGER,

  -- Pricing
  cuota_mensual    NUMERIC(12,2),
  descuento_pct    NUMERIC(5,2),
  precio_final     NUMERIC(12,2),

  -- Metadata
  data_source      TEXT,        -- 'notes_parsed' | 'comments_parsed' | 'manual'
  is_closed        BOOLEAN DEFAULT false,
  requires_update  BOOLEAN DEFAULT false,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_monetary_lead
    FOREIGN KEY (client_slug, meistertask_id)
    REFERENCES leads(client_slug, meistertask_id)
    ON DELETE CASCADE,

  -- Dedup de cotizaciones múltiples por (lead, plan_code, capitas)
  CONSTRAINT uq_monetary_offer
    UNIQUE (client_slug, meistertask_id, plan_code, capitas)
);

CREATE INDEX IF NOT EXISTS idx_monetary_lead            ON lead_monetary(client_slug, meistertask_id);
CREATE INDEX IF NOT EXISTS idx_monetary_requires_update ON lead_monetary(client_slug, requires_update) WHERE requires_update = true;

-- ============================================================
-- 4) Tabla `lead_activity`
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_activity (
  id                BIGSERIAL PRIMARY KEY,
  client_slug       TEXT NOT NULL,
  meistertask_id    BIGINT NOT NULL,
  author            TEXT,
  body              TEXT,
  commented_at      TIMESTAMPTZ,
  extracted_amount  NUMERIC(12,2),

  CONSTRAINT fk_activity_lead
    FOREIGN KEY (client_slug, meistertask_id)
    REFERENCES leads(client_slug, meistertask_id)
    ON DELETE CASCADE
);

-- Columna generada con hash MD5 del body, para soportar el UNIQUE de abajo.
-- Postgres no acepta md5(coalesce(body,'')) directamente en UNIQUE constraint,
-- por eso lo materializamos como columna generada.
ALTER TABLE lead_activity
  ADD COLUMN IF NOT EXISTS body_hash TEXT
  GENERATED ALWAYS AS (md5(coalesce(body, ''))) STORED;

-- Dedup de comentarios por (lead, autor, timestamp, hash del body).
-- Se agrega después del ADD COLUMN para que body_hash exista.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_activity_comment'
  ) THEN
    ALTER TABLE lead_activity
      ADD CONSTRAINT uq_activity_comment
      UNIQUE (client_slug, meistertask_id, author, commented_at, body_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_activity_lead   ON lead_activity(client_slug, meistertask_id);
CREATE INDEX IF NOT EXISTS idx_activity_author ON lead_activity(client_slug, author);

-- ============================================================
-- 5) Tabla `import_runs`
-- ============================================================

CREATE TABLE IF NOT EXISTS import_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_slug     TEXT NOT NULL,
  run_at          TIMESTAMPTZ DEFAULT NOW(),
  source_file     TEXT,
  total_tasks     INTEGER,
  new_tasks       INTEGER,
  updated_tasks   INTEGER,
  skipped_tasks   INTEGER,
  errors          JSONB
);

CREATE INDEX IF NOT EXISTS idx_runs_client ON import_runs(client_slug, run_at DESC);

-- ============================================================
-- ROLLBACK (commented — apply manually if needed)
-- ============================================================
--
-- DROP INDEX IF EXISTS idx_runs_client;
-- DROP INDEX IF EXISTS idx_activity_author;
-- DROP INDEX IF EXISTS idx_activity_lead;
-- DROP INDEX IF EXISTS idx_monetary_requires_update;
-- DROP INDEX IF EXISTS idx_monetary_lead;
-- DROP INDEX IF EXISTS idx_history_section_to;
-- DROP INDEX IF EXISTS idx_history_lead;
-- DROP INDEX IF EXISTS idx_leads_lead_month;
-- DROP INDEX IF EXISTS idx_leads_tipification;
-- DROP INDEX IF EXISTS idx_leads_assignee;
-- DROP INDEX IF EXISTS idx_leads_section;
--
-- DROP TABLE IF EXISTS import_runs;
-- DROP TABLE IF EXISTS lead_activity;
-- DROP TABLE IF EXISTS lead_monetary;
-- DROP TABLE IF EXISTS lead_section_history;
-- DROP TABLE IF EXISTS leads;
