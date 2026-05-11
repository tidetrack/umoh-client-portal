-- Migration: 010_tofu_ads_daily_campaign_id.sql | Date: 2026-05-05 | Author: pipeline-engineer
--
-- Agrega campaign_id y campaign_name a la tabla tofu_ads_daily.
--
-- MOTIVACIÓN
-- -----------
-- El extractor de Google Ads (google_ads.py) ahora trae campaign.id y
-- campaign.name desde la API. Para mantener consistencia entre la tabla
-- cruda (tofu_ads_daily) y la fact (tofu_facts), se agregan las columnas
-- correspondientes a la tabla cruda.
--
-- Registros históricos que existían antes de esta migración quedan con los
-- defaults: campaign_id='PMAX_PREPAGAS', campaign_name='PMAX Prevención Salud'.
-- Esto es correcto porque Prevención Salud solo tenía UNA campaña PMAX activa
-- en ese período.
--
-- IMPACTO EN EL STORED PROCEDURE compute_tofu_facts
-- ---------------------------------------------------
-- La función compute_tofu_facts (009_facts_tables.sql) recibe campaign_id y
-- campaign_name como parámetros del caller. Cuando el extractor traiga IDs
-- reales, el pipeline pasará el ID real extraído. En v1 (una sola campaña)
-- el pipeline sigue pasando 'PMAX_PREPAGAS'.
-- Cuando haya múltiples campañas, la función deberá actualizarse para leer
-- campaign_id de tofu_ads_daily en lugar de recibirlo como parámetro.
--
-- IDEMPOTENCIA
-- -------------
-- Se usa ADD COLUMN IF NOT EXISTS — re-ejecutar no rompe nada.
-- El UPDATE del DEFAULT es idempotente: si ya tiene el valor, no cambia nada.

-- ============================================================
-- 1) Agregar columnas con DEFAULT para histórico
-- ============================================================

ALTER TABLE tofu_ads_daily
  ADD COLUMN IF NOT EXISTS campaign_id   TEXT NOT NULL DEFAULT 'PMAX_PREPAGAS',
  ADD COLUMN IF NOT EXISTS campaign_name TEXT NOT NULL DEFAULT 'PMAX Prevención Salud';

COMMENT ON COLUMN tofu_ads_daily.campaign_id IS
  'ID de campaña de la plataforma (ej: "123456789" para Google Ads). '
  'Valor por defecto PMAX_PREPAGAS para registros históricos importados '
  'antes de que el extractor traiga el ID real.';

COMMENT ON COLUMN tofu_ads_daily.campaign_name IS
  'Nombre legible de la campaña (ej: "PMAX Prevención Salud"). '
  'Desnormalizado para legibilidad en logs y Sheets.';

-- ============================================================
-- 2) Actualizar el conflicto del upsert
-- ============================================================
-- La PK de tofu_ads_daily es (client_slug, date, platform).
-- No incluimos campaign_id en la PK porque en v1 hay una sola campaña por
-- plataforma. Si en el futuro hay múltiples campañas simultáneas, se
-- necesitará una migración adicional para incluir campaign_id en la PK.
--
-- Por ahora, el upsert en el loader sigue usando on_conflict='client_slug,date,platform'.
-- Cuando el pipeline escriba el campaign_id real, la fila existente se actualiza
-- con los nuevos valores (incluyendo campaign_id), lo cual es el comportamiento correcto.

-- ============================================================
-- 3) Actualizar registros históricos de Prevención Salud
-- ============================================================
-- Los registros con client_slug='prepagas' que tengan campaign_id vacío
-- (edge case por la secuencia de migraciones) se completan aquí.
-- Los que ya tienen el DEFAULT 'PMAX_PREPAGAS' no se tocan (condición AND).

UPDATE tofu_ads_daily
SET
  campaign_id   = 'PMAX_PREPAGAS',
  campaign_name = 'PMAX Prevención Salud'
WHERE client_slug = 'prepagas'
  AND (campaign_id = '' OR campaign_id IS NULL);

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
--
-- ALTER TABLE tofu_ads_daily
--   DROP COLUMN IF EXISTS campaign_name,
--   DROP COLUMN IF EXISTS campaign_id;
