-- ============================================================
-- 008_is_campaign_lead.sql
-- Agrega columna generada is_campaign_lead a leads.
--
-- Lógica: un lead es "de campaña" si vino de un canal medible (Form/Wsp
-- o sus sinónimos). Los leads de canal "Propio", "Referido", o vacío son
-- leads del vendedor — se mantienen en la base pero se diferencian para
-- no inflar las métricas de rendimiento de campaña.
--
-- La columna es GENERATED ALWAYS AS STORED → Postgres la calcula
-- automáticamente cada vez que se inserta/actualiza un lead. Sin cambios
-- en Python ni en el extractor.
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS is_campaign_lead boolean
  GENERATED ALWAYS AS (
    lower(trim(coalesce(canal, ''))) IN (
      'form',
      'formulario',
      'wsp',
      'whatsapp',
      'formulario y whatsapp',
      'campaña',
      'campana'
    )
  ) STORED;

-- Index para acelerar las queries del dashboard que filtran por este campo.
CREATE INDEX IF NOT EXISTS idx_leads_campaign_lead
  ON leads (client_slug, is_campaign_lead);

COMMENT ON COLUMN leads.is_campaign_lead IS
  'Generado automáticamente: true si el canal del lead corresponde a un canal de campaña medible (Form/Wsp/Formulario/WhatsApp). Los leads que el vendedor carga manualmente (Referido, Propio, etc.) son false.';

-- ============================================================
-- ROLLBACK (commented)
-- ============================================================
-- DROP INDEX IF EXISTS idx_leads_campaign_lead;
-- ALTER TABLE leads DROP COLUMN IF EXISTS is_campaign_lead;
