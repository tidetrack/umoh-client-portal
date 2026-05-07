-- 014_tofu_search_terms.sql
-- Tabla dedicada para términos de búsqueda TOFU.
--
-- Problema resuelto: la vista search_term_view de Google Ads solo devuelve
-- datos para campañas Search tradicionales. Las cuentas que usan exclusivamente
-- Performance Max (PMAX) — como Prepagas — siempre obtienen 0 filas de esa view.
-- Google expone las búsquedas PMAX vía campaign_search_term_insight, que devuelve
-- "category labels" (agrupaciones semánticas de términos, no los términos exactos).
--
-- Esta tabla unifica ambas fuentes en un schema único. El campo `source` discrimina
-- el origen para que el frontend pueda mostrar un aviso si corresponde.
--
-- PK compuesta: (client_slug, date, campaign_id, term).
-- Un mismo término puede aparecer en distintas campañas el mismo día.
-- El campo campaign_id permite ese desglose y hace la PK correctamente única.

CREATE TABLE IF NOT EXISTS tofu_search_terms (
  client_slug   TEXT        NOT NULL,
  date          DATE        NOT NULL,
  campaign_id   TEXT        NOT NULL DEFAULT '',
  campaign_name TEXT        NOT NULL DEFAULT '',

  -- "term" para PMAX es el category_label (agrupación semántica de Google).
  -- Para Search tradicional es el search_term real (texto exacto del usuario).
  -- Ambos se tratan como strings — el campo `source` indica cuál es cuál.
  term          TEXT        NOT NULL,

  -- 'search_term_view'              → campañas Search tradicionales (término exacto)
  -- 'campaign_search_term_insight'  → campañas PMAX (category label)
  source        TEXT        NOT NULL CHECK (source IN ('search_term_view', 'campaign_search_term_insight')),

  clicks        INTEGER     NOT NULL DEFAULT 0,
  impressions   INTEGER     NOT NULL DEFAULT 0,

  import_run_id  UUID,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (client_slug, date, campaign_id, term)
);

-- Índice para las consultas más frecuentes: todos los términos de un cliente
-- en un rango de fechas, ordenados cronológicamente descendente.
CREATE INDEX IF NOT EXISTS idx_tofu_search_terms_client_date
  ON tofu_search_terms (client_slug, date DESC);

-- RLS consistente con las demás facts tables del proyecto.
ALTER TABLE tofu_search_terms ENABLE ROW LEVEL SECURITY;

-- service_role tiene acceso total (el pipeline Python usa service_role).
DROP POLICY IF EXISTS service_role_full_tofu_search_terms ON tofu_search_terms;
CREATE POLICY service_role_full_tofu_search_terms ON tofu_search_terms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- anon (frontend / PHP) solo puede leer su propio client_slug.
-- El claim viene del JWT que setea el endpoint PHP al autenticar.
-- Si no hay claim (ej: entorno local sin JWT), la condición es tautológica
-- (client_slug = client_slug) y permite leer todo — aceptable para dev.
DROP POLICY IF EXISTS anon_read_by_slug_tofu_search_terms ON tofu_search_terms;
CREATE POLICY anon_read_by_slug_tofu_search_terms ON tofu_search_terms
  FOR SELECT TO anon
  USING (client_slug = COALESCE(current_setting('request.jwt.claim.client_slug', true), client_slug));
