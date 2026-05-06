-- Migration: 006_tofu.sql | Date: 2026-04-27 | Author: supabase-architect
--
-- Schema TOFU (top of funnel) en Supabase.
-- Reemplaza Google Sheets como fuente de verdad para los datos de awareness/tráfico.
--
-- Dos tablas porque las métricas de Ads y de GA tienen shapes distintos:
--   - tofu_ads_daily   : impresiones / clicks / spend / cpc por plataforma de pauta
--   - ga_traffic_daily : sessions / users / pageviews / conversions de Google Analytics
--
-- Convenciones:
--   - client_slug TEXT NOT NULL en todas las tablas (multi-tenant día 1)
--   - PK compuesta con client_slug primero
--   - JSONB para breakdowns y top-N rankings
--   - TIMESTAMPTZ para auditoría, DATE (sin hora) para la dimensión temporal del reporte
--
-- Idempotencia: CREATE TABLE/INDEX IF NOT EXISTS — re-ejecutar no rompe nada.

-- ============================================================
-- 1) Tabla `tofu_ads_daily`
-- ============================================================

CREATE TABLE IF NOT EXISTS tofu_ads_daily (
  client_slug         TEXT NOT NULL,
  date                DATE NOT NULL,
  platform            TEXT NOT NULL CHECK (platform IN ('google','meta','linkedin')),

  -- Métricas base (todos los Ads las tienen)
  impressions         INTEGER NOT NULL DEFAULT 0,
  clicks              INTEGER NOT NULL DEFAULT 0,
  spend               NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Derivadas (las pre-calculamos en el loader para queries simples)
  cpc                 NUMERIC(10,4) NOT NULL DEFAULT 0,
  ctr                 NUMERIC(7,4) NOT NULL DEFAULT 0,    -- clicks / impressions * 100

  -- Breakdowns (JSONB para que cada plataforma meta su shape sin migración)
  -- Google Ads: {"Search": 1234, "Display": 567, "YouTube": 890}
  -- Meta:       {"feed": 1234, "stories": 567, "reels": 890}
  channel_breakdown   JSONB,
  -- Estructura igual: {"Mobile": 12000, "Desktop": 3000, "Tablet": 200}
  device_breakdown    JSONB,
  -- Top N términos (Google Search) o ad creatives (Meta/LinkedIn)
  -- Formato: [{"term": "prepaga mendoza", "clicks": 42}, ...]
  top_search_terms    JSONB,

  -- Tracking del pipeline
  last_imported_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  import_run_id       UUID,

  PRIMARY KEY (client_slug, date, platform)
);

CREATE INDEX IF NOT EXISTS idx_tofu_ads_client_date  ON tofu_ads_daily(client_slug, date DESC);
CREATE INDEX IF NOT EXISTS idx_tofu_ads_platform     ON tofu_ads_daily(client_slug, platform, date DESC);

-- ============================================================
-- 2) Tabla `ga_traffic_daily`
-- ============================================================

CREATE TABLE IF NOT EXISTS ga_traffic_daily (
  client_slug              TEXT NOT NULL,
  date                     DATE NOT NULL,

  -- Métricas de tráfico
  sessions                 INTEGER NOT NULL DEFAULT 0,
  users                    INTEGER NOT NULL DEFAULT 0,
  new_users                INTEGER NOT NULL DEFAULT 0,
  pageviews                INTEGER NOT NULL DEFAULT 0,

  -- Calidad / engagement
  bounce_rate              NUMERIC(5,2) NOT NULL DEFAULT 0,    -- 0-100
  avg_session_duration_sec INTEGER NOT NULL DEFAULT 0,

  -- Conversiones (eventos definidos como conversion en GA4)
  conversions              INTEGER NOT NULL DEFAULT 0,
  conversion_rate          NUMERIC(5,2) NOT NULL DEFAULT 0,    -- conversions / sessions * 100

  -- Breakdowns
  -- {"Organic Search": 1234, "Paid Search": 567, "Direct": 890, "Social": 100, "Referral": 50}
  channel_breakdown        JSONB,
  -- Top 10 landings: [{"url": "/", "sessions": 450}, {"url": "/planes", "sessions": 200}, ...]
  landing_pages            JSONB,
  -- {"mobile": 12000, "desktop": 3000, "tablet": 200}
  device_breakdown         JSONB,

  -- Tracking del pipeline
  last_imported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  import_run_id            UUID,

  PRIMARY KEY (client_slug, date)
);

CREATE INDEX IF NOT EXISTS idx_ga_traffic_client_date ON ga_traffic_daily(client_slug, date DESC);

-- ============================================================
-- 3) RLS + Policies (mismo patrón que las tablas MOFU/BOFU)
-- ============================================================

ALTER TABLE tofu_ads_daily   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga_traffic_daily ENABLE ROW LEVEL SECURITY;

-- tofu_ads_daily

DROP POLICY IF EXISTS "service_role_full_tofu_ads" ON tofu_ads_daily;
CREATE POLICY "service_role_full_tofu_ads" ON tofu_ads_daily
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_tofu_ads" ON tofu_ads_daily;
CREATE POLICY "anon_read_by_slug_tofu_ads" ON tofu_ads_daily
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');

-- ga_traffic_daily

DROP POLICY IF EXISTS "service_role_full_ga_traffic" ON ga_traffic_daily;
CREATE POLICY "service_role_full_ga_traffic" ON ga_traffic_daily
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_ga_traffic" ON ga_traffic_daily;
CREATE POLICY "anon_read_by_slug_ga_traffic" ON ga_traffic_daily
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
--
-- DROP POLICY IF EXISTS "anon_read_by_slug_ga_traffic" ON ga_traffic_daily;
-- DROP POLICY IF EXISTS "service_role_full_ga_traffic" ON ga_traffic_daily;
-- DROP POLICY IF EXISTS "anon_read_by_slug_tofu_ads"   ON tofu_ads_daily;
-- DROP POLICY IF EXISTS "service_role_full_tofu_ads"   ON tofu_ads_daily;
-- ALTER TABLE ga_traffic_daily DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tofu_ads_daily   DISABLE ROW LEVEL SECURITY;
-- DROP INDEX IF EXISTS idx_ga_traffic_client_date;
-- DROP INDEX IF EXISTS idx_tofu_ads_platform;
-- DROP INDEX IF EXISTS idx_tofu_ads_client_date;
-- DROP TABLE IF EXISTS ga_traffic_daily;
-- DROP TABLE IF EXISTS tofu_ads_daily;
