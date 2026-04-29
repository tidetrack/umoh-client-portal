-- ============================================================
-- 007_tofu_geo.sql
-- Agrega columna geo_breakdown a tofu_ads_daily para almacenar
-- el desglose de impresiones/clicks por ciudad extraído de
-- Google Ads geographic_view + geo_target_constant.
--
-- Formato JSONB esperado (consistente con channel_breakdown / device_breakdown):
--   {
--     "Mendoza":    {"clicks": 45, "impressions": 1200},
--     "Guaymallén": {"clicks": 12, "impressions": 320},
--     ...
--   }
-- ============================================================

ALTER TABLE tofu_ads_daily
  ADD COLUMN IF NOT EXISTS geo_breakdown jsonb;

COMMENT ON COLUMN tofu_ads_daily.geo_breakdown IS
  'Desglose por ciudad: {nombre_ciudad: {clicks, impressions}}. Fuente: Google Ads geographic_view + geo_target_constant.';

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
-- ALTER TABLE tofu_ads_daily DROP COLUMN IF EXISTS geo_breakdown;
