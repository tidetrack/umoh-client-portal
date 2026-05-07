-- 015_ai_summaries.sql
-- Tabla de cache para los resúmenes heurísticos de la sección "Inicio" del dashboard.
--
-- Decisión de Franco (2026-05-07): no usar Claude API on-the-fly en cada request.
-- Un script Python corre las heurísticas sobre los datos de Supabase, genera el
-- resumen y lo guarda aquí. El endpoint /api/inicio.php lee de esta tabla.
--
-- PK: (client_slug, period) — un resumen activo por cliente y período.
-- Si se regenera el resumen, el UPSERT sobreescribe la fila existente
-- actualizando generated_at automáticamente.
--
-- Campo generated_by: permite auditar si el resumen fue generado por el script
-- heurístico ('heuristic'), por la Claude API ('claude') o manualmente ('manual').
-- Esto facilita migrar a Claude API en el futuro sin cambiar el schema.

CREATE TABLE IF NOT EXISTS ai_summaries (
  client_slug    TEXT        NOT NULL,
  period         TEXT        NOT NULL,  -- '7d', '30d', '90d', 'all', 'custom'
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by   TEXT        NOT NULL DEFAULT 'heuristic',  -- 'heuristic' | 'claude' | 'manual'
  headline       TEXT        NOT NULL,
  highlights     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  recommendation TEXT        NOT NULL,
  PRIMARY KEY (client_slug, period)
);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_client
  ON ai_summaries (client_slug, generated_at DESC);

ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_full_ai_summaries ON ai_summaries;
CREATE POLICY service_role_full_ai_summaries ON ai_summaries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS anon_read_by_slug_ai_summaries ON ai_summaries;
CREATE POLICY anon_read_by_slug_ai_summaries ON ai_summaries
  FOR SELECT TO anon
  USING (client_slug = COALESCE(current_setting('request.jwt.claim.client_slug', true), client_slug));

COMMENT ON TABLE ai_summaries IS
  'Cache de resúmenes generados para la sección Inicio del dashboard. Decisión de Franco (2026-05-07): no usar Claude API directamente — un script Python heurístico genera estos resúmenes y los guarda acá. El endpoint /api/inicio.php lee de esta tabla en vez de generar on-the-fly.';
