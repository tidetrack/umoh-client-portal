-- Migration: 005_rls_policies.sql | Date: 2026-04-27 | Author: supabase-architect
--
-- Row-Level Security en todas las tablas del pipeline MeisterTask.
--
-- Política base:
--   - service_role: full access (SELECT/INSERT/UPDATE/DELETE) — usado por el pipeline Python
--   - anon:         read-only filtrado por client_slug del JWT — preparado para futuro
--                   frontend que consulte Supabase directo (Fase 4+). En v1 no se usa.
--   - authenticated: reservado para Fase 4 (auth de usuarios por cliente)
--
-- El frontend de v1 NO consulta Supabase directamente — pasa por endpoints PHP que
-- usan el service_role. Estas políticas anon quedan listas para activarse cuando
-- el dashboard tenga login propio.
--
-- Para que las políticas anon funcionen, el JWT del cliente debe llevar el claim
-- `client_slug` (ej: en login se firma un token con `{"client_slug": "prepagas"}`).
--
-- Idempotencia: DROP POLICY IF EXISTS antes de CREATE POLICY para poder re-ejecutar.

-- ============================================================
-- 1) Habilitar RLS
-- ============================================================

ALTER TABLE leads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_section_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_monetary        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activity        ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_stages        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2) Policy helper: extrae client_slug del JWT (para anon)
-- ============================================================
--
-- Postgres permite leer claims del JWT actual vía:
--   current_setting('request.jwt.claims', true)::json->>'client_slug'
--
-- Si no hay JWT (request sin auth), retorna NULL y la política deniega.

-- ============================================================
-- 3) Tabla: leads
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_leads" ON leads;
CREATE POLICY "service_role_full_leads" ON leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_leads" ON leads;
CREATE POLICY "anon_read_by_slug_leads" ON leads
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');

-- ============================================================
-- 4) Tabla: lead_section_history
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_history" ON lead_section_history;
CREATE POLICY "service_role_full_history" ON lead_section_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_history" ON lead_section_history;
CREATE POLICY "anon_read_by_slug_history" ON lead_section_history
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');

-- ============================================================
-- 5) Tabla: lead_monetary
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_monetary" ON lead_monetary;
CREATE POLICY "service_role_full_monetary" ON lead_monetary
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_monetary" ON lead_monetary;
CREATE POLICY "anon_read_by_slug_monetary" ON lead_monetary
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');

-- ============================================================
-- 6) Tabla: lead_activity
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_activity" ON lead_activity;
CREATE POLICY "service_role_full_activity" ON lead_activity
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_activity" ON lead_activity;
CREATE POLICY "anon_read_by_slug_activity" ON lead_activity
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');

-- ============================================================
-- 7) Tabla: import_runs
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_runs" ON import_runs;
CREATE POLICY "service_role_full_runs" ON import_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- import_runs es metadata operacional — NO se expone al anon (no hace falta en frontend)

-- ============================================================
-- 8) Tabla: funnel_stages
-- ============================================================

DROP POLICY IF EXISTS "service_role_full_stages" ON funnel_stages;
CREATE POLICY "service_role_full_stages" ON funnel_stages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_stages" ON funnel_stages;
CREATE POLICY "anon_read_by_slug_stages" ON funnel_stages
  FOR SELECT
  TO anon
  USING (
    client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug'
    AND is_active = true
  );

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
--
-- DROP POLICY IF EXISTS "anon_read_by_slug_stages" ON funnel_stages;
-- DROP POLICY IF EXISTS "service_role_full_stages" ON funnel_stages;
-- DROP POLICY IF EXISTS "service_role_full_runs" ON import_runs;
-- DROP POLICY IF EXISTS "anon_read_by_slug_activity" ON lead_activity;
-- DROP POLICY IF EXISTS "service_role_full_activity" ON lead_activity;
-- DROP POLICY IF EXISTS "anon_read_by_slug_monetary" ON lead_monetary;
-- DROP POLICY IF EXISTS "service_role_full_monetary" ON lead_monetary;
-- DROP POLICY IF EXISTS "anon_read_by_slug_history" ON lead_section_history;
-- DROP POLICY IF EXISTS "service_role_full_history" ON lead_section_history;
-- DROP POLICY IF EXISTS "anon_read_by_slug_leads" ON leads;
-- DROP POLICY IF EXISTS "service_role_full_leads" ON leads;
--
-- ALTER TABLE funnel_stages        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE import_runs          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE lead_activity        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE lead_monetary        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE lead_section_history DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE leads                DISABLE ROW LEVEL SECURITY;
