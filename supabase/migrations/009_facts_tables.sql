-- Migration: 009_facts_tables.sql | Date: 2026-05-05 | Author: supabase-architect
--
-- Tres tablas "facts" del funnel: tofu_facts, mofu_facts, bofu_facts.
--
-- PROPÓSITO
-- ----------
-- Las tablas crudas existentes (tofu_ads_daily, leads, lead_monetary) almacenan
-- datos de fuentes distintas con shapes distintos. Estas tablas facts son la
-- capa de resumen: una fila por (cliente, día, campaña, [plataforma]) con todas
-- las métricas de esa fase ya agregadas y listas para consumo del dashboard y
-- replicación a Google Sheets.
--
-- DECISIONES CONFIRMADAS POR FRANCO (2026-05-05)
-- -------------------------------------------------
-- Segmentación BOFU: se usa `leads.tipification` (Voluntario / Monotributista /
-- Obligatorio). El campo `leads.operatoria` existe en la tabla pero NO se usa —
-- Franco confirmó que no es el indicador relevante para el dashboard. La fuente
-- correcta del segmento es `tipification`, parseado de los tags de MeisterTask.
--
-- Conversion rate: se almacenan 3 variantes en bofu_facts (acumulado, mes_actual,
-- 30d_móviles). La métrica primaria para el cliente es conversion_rate_mes porque
-- permite comparación retrospectiva mes a mes. Las 3 se calculan en post-
-- procesamiento por el pipeline (denominador requiere joinear mofu_facts).
--
-- RELACIÓN CON LAS TABLAS CRUDAS
-- ---------------------------------
--   tofu_facts   ← agrega desde tofu_ads_daily, agrupando por (client_slug, date, campaign_id, platform)
--   mofu_facts   ← agrega desde leads (vía leads_with_stage), agrupando por (client_slug, lead_created_at::date, campaign_id)
--   bofu_facts   ← agrega desde leads + lead_monetary, filtrando is_closed_won=true, agrupando por (client_slug, sale_date, campaign_id)
--
-- CAMPAIGN_ID — ESTRATEGIA DE BOOTSTRAPPING
-- ------------------------------------------
-- El extractor de Google Ads actual (data/extractors/google_ads.py) NO trae
-- campaign.id ni campaign.name — la query GAQL agrega métricas de todas las
-- campañas juntas por día/canal/dispositivo. Hay tres momentos en la vida de
-- este campo:
--
--   Fase actual (v1): campaign_id = 'PMAX_PREPAGAS' (placeholder fijo). Todos
--     los datos de Prevención Salud se asocian a esta campaña única dado que
--     operan solo con una campaña PMAX activa. El backfill de datos históricos
--     debe usar este valor.
--
--   Fase siguiente: el pipeline-engineer actualiza la query GAQL para incluir
--     campaign.id y campaign.name. El loader escribe el ID real de Google Ads.
--     Las filas antiguas quedan con 'PMAX_PREPAGAS' — se puede hacer un UPDATE
--     masivo cuando se conozca el campaign_id real, pero no es bloqueante.
--
--   Futuro multi-campaña: cuando Prevención Salud active Meta o una segunda
--     campaña de Google, cada una tendrá su propio campaign_id y las métricas
--     se desglosarán correctamente.
--
-- El valor 'PMAX_PREPAGAS' es legible en logs y en la UI del dashboard; no es
-- un UUID opaco. La convención de naming es '{tipo_campaña}_{client_slug}'.
--
-- DECISIÓN: WIDE (columnas) vs LONG (filas por segmento/sección)
-- ---------------------------------------------------------------
-- Se eligió el modelo wide (columnas separadas para cada segmento/sección)
-- por las siguientes razones:
--
--   1. Compatibilidad con Google Sheets: una fila en Supabase = una fila en
--      la Sheet. El modelo long requeriría pivotar en el cliente, lo cual
--      no es trivial en Sheets con fórmulas.
--
--   2. Los segmentos de Prevención Salud son fijos y conocidos (Voluntario,
--      Monotributista, Obligatorio) — sin planes de agregar segmentos nuevos
--      en el corto/mediano plazo.
--
--   3. Las queries del dashboard son siempre "dame todos los segmentos para
--      el período X" — un SELECT * con filtro de fecha es más eficiente en
--      wide que un GROUP BY en long.
--
--   Trade-off aceptado: si en el futuro aparece un cuarto segmento, se
--   necesitará una migración para agregar columnas. El costo es bajo porque
--   las migraciones son idempotentes y los datos históricos de las columnas
--   nuevas quedan en 0 (lo cual es correcto — existían antes de ese segmento).
--
-- DECISIÓN: MÉTRICAS PRE-COMPUTADAS vs RUNTIME
-- ----------------------------------------------
-- CTR, CPC, CPL y conversion_rate se pre-computan en las facts tables. Razón:
--   - Sheets: el cliente ve los valores directamente, sin fórmulas.
--   - Dashboard: la query PHP se simplifica (no necesita calcular en SQL).
--   - Riesgo de desync: existe cuando se corrige un valor crudo después del
--     fact. El pipeline resuelve esto recomputando la fila entera en cada run
--     (UPSERT reemplaza la fila completa, no solo los valores crudos).
--
-- PLAN DE POBLAMIENTO
-- --------------------
-- Método: stored procedure + llamada externa desde el pipeline Python.
-- Las facts NO se actualizan via triggers automáticos porque:
--   - Los triggers en tablas crudas muy activas (leads) generan overhead por
--     cada INSERT/UPDATE individual.
--   - El pipeline ya tiene un paso de "finalización del run" — agregar la
--     llamada al stored procedure ahí es natural y explícito.
--   - El pipeline-engineer puede testear la actualización de facts de manera
--     independiente sin necesidad de replicar la lógica de triggers.
--
-- Frecuencia de actualización de facts:
--   - tofu_facts: una vez por run de Google Ads (cada 6 horas via GitHub Actions).
--   - mofu_facts: al final de cada run del pipeline MeisterTask (al importar CSV).
--   - bofu_facts: al final de cada run del pipeline MeisterTask (mismo run que mofu).
--
-- Para el backfill inicial de Prevención Salud, el pipeline-engineer debe
-- ejecutar los stored procedures manualmente pasando campaign_id='PMAX_PREPAGAS'.
--
-- COMPATIBILIDAD CON GOOGLE SHEETS
-- ----------------------------------
-- Todas las columnas usan tipos simples: text, date, integer, numeric, boolean.
-- Sin JSONB, sin arrays, sin tipos Postgres exóticos.
-- Una fila en Supabase = una fila en la Sheet.
-- Los nombres de columna en snake_case son los headers de la Sheet sin transformación.
--
-- IDEMPOTENCIA: CREATE TABLE/INDEX IF NOT EXISTS — re-ejecutar no rompe datos.

-- ============================================================
-- 1) Tabla `tofu_facts`
-- ============================================================
--
-- Granularidad: un registro por (cliente, día, campaña, plataforma).
-- Agrega impresiones, clicks y gasto de tofu_ads_daily para esa combinación.
--
-- PK incluye `platform` porque el mismo cliente puede tener la misma campaña
-- activa en Google y Meta con métricas separadas.

CREATE TABLE IF NOT EXISTS tofu_facts (
  -- Dimensiones (PK)
  client_slug    TEXT    NOT NULL,
  date           DATE    NOT NULL,
  campaign_id    TEXT    NOT NULL,
  platform       TEXT    NOT NULL CHECK (platform IN ('google_ads','meta','linkedin')),

  -- Identidad de la campaña (desnormalizado para legibilidad en Sheets)
  campaign_name  TEXT    NOT NULL DEFAULT '',

  -- Métricas base
  impressions    INTEGER NOT NULL DEFAULT 0,
  clicks         INTEGER NOT NULL DEFAULT 0,
  spend          NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Métricas derivadas (pre-computadas — ver decisión arriba)
  -- CTR  = clicks / impressions * 100  (en porcentaje, ej: 3.45 = 3.45%)
  -- CPC  = spend / clicks              (en ARS por click)
  -- CPM  = spend / impressions * 1000  (costo por mil impresiones)
  ctr            NUMERIC(7,4)  NOT NULL DEFAULT 0,
  cpc            NUMERIC(10,4) NOT NULL DEFAULT 0,
  cpm            NUMERIC(10,4) NOT NULL DEFAULT 0,

  -- Auditoría del pipeline
  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (client_slug, date, campaign_id, platform)
);

COMMENT ON TABLE tofu_facts IS
  'Facts TOFU: métricas diarias de awareness/pauta por cliente, campaña y plataforma. '
  'Agrega tofu_ads_daily. Una fila = un día + una campaña + una plataforma. '
  'campaign_id = PMAX_PREPAGAS hasta que el extractor traiga IDs reales de Google Ads.';

COMMENT ON COLUMN tofu_facts.campaign_id IS
  'ID de campaña: puede ser un ID real de Google Ads/Meta o el placeholder PMAX_PREPAGAS '
  'para datos históricos donde el extractor no traía este campo.';

COMMENT ON COLUMN tofu_facts.ctr IS
  'Click-through rate en porcentaje (clicks / impressions * 100). Pre-computado. '
  'Se actualiza en cada run del pipeline — sin riesgo de desync.';

COMMENT ON COLUMN tofu_facts.cpc IS
  'Costo por click en ARS (spend / clicks). 0 si clicks = 0.';

COMMENT ON COLUMN tofu_facts.cpm IS
  'Costo por mil impresiones (spend / impressions * 1000). 0 si impressions = 0.';

COMMENT ON COLUMN tofu_facts.last_computed_at IS
  'Timestamp de la última vez que el pipeline computó esta fila. '
  'Permite detectar filas que no fueron actualizadas en un run esperado.';

-- Índices para queries típicas del dashboard
CREATE INDEX IF NOT EXISTS idx_tofu_facts_client_date
  ON tofu_facts (client_slug, date DESC);

CREATE INDEX IF NOT EXISTS idx_tofu_facts_client_campaign
  ON tofu_facts (client_slug, campaign_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_tofu_facts_platform
  ON tofu_facts (client_slug, platform, date DESC);


-- ============================================================
-- 2) Tabla `mofu_facts`
-- ============================================================
--
-- Granularidad: un registro por (cliente, día, campaña).
-- Cuenta leads según su estado en funnel_stages — usando los flags semánticos,
-- no los nombres de sección hardcodeados.
--
-- "Día" = lead_created_at::date del lead en la tabla leads.
-- Solo se cuentan leads con is_campaign_lead=true (columna generada en 008).
--
-- Distribución por sección: se incluyen las secciones operativas de Prevención
-- Salud que el dashboard mostraba históricamente. Si aparece una sección nueva
-- se agrega una columna en una migración posterior. El costo es bajo.

CREATE TABLE IF NOT EXISTS mofu_facts (
  -- Dimensiones (PK)
  client_slug        TEXT    NOT NULL,
  date               DATE    NOT NULL,
  campaign_id        TEXT    NOT NULL,

  -- Identidad de la campaña
  campaign_name      TEXT    NOT NULL DEFAULT '',

  -- Volumen total de leads del día para esta campaña
  total_leads        INTEGER NOT NULL DEFAULT 0,

  -- Desglose por flags semánticos (de funnel_stages)
  high_intent_leads  INTEGER NOT NULL DEFAULT 0,  -- is_high_intent = true
  typified_leads     INTEGER NOT NULL DEFAULT 0,  -- is_typified = true
  closed_won_leads   INTEGER NOT NULL DEFAULT 0,  -- is_closed_won = true
  lost_leads         INTEGER NOT NULL DEFAULT 0,  -- is_lost = true
  incubating_leads   INTEGER NOT NULL DEFAULT 0,  -- is_incubating = true

  -- Tasa de tipificación pre-computada (typified_leads / total_leads * 100)
  -- Es una métrica operativa clave para el equipo de ventas.
  typification_rate  NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Desglose por sección (wide) — específico del CRM de Prevención Salud.
  -- Permite ver en qué etapa del pipeline están los leads del día.
  -- Fuente: leads.section via JOIN con funnel_stages.
  section_inbox      INTEGER NOT NULL DEFAULT 0,
  section_nuevo      INTEGER NOT NULL DEFAULT 0,
  section_prioritarios INTEGER NOT NULL DEFAULT 0,
  section_para_hoy   INTEGER NOT NULL DEFAULT 0,
  section_procesando INTEGER NOT NULL DEFAULT 0,
  section_contactados INTEGER NOT NULL DEFAULT 0,
  section_cotizados  INTEGER NOT NULL DEFAULT 0,
  section_en_auditoria INTEGER NOT NULL DEFAULT 0,
  section_mes_que_viene INTEGER NOT NULL DEFAULT 0,
  section_a_futuro   INTEGER NOT NULL DEFAULT 0,
  section_ventas_ganadas INTEGER NOT NULL DEFAULT 0,
  section_no_prospera INTEGER NOT NULL DEFAULT 0,

  -- Auditoría del pipeline
  last_computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (client_slug, date, campaign_id)
);

COMMENT ON TABLE mofu_facts IS
  'Facts MOFU: recuento diario de leads por cliente y campaña. '
  'Agrega tabla leads (vía leads_with_stage) por lead_created_at::date. '
  'Solo incluye leads con is_campaign_lead=true. '
  'Los conteos por sección son un snapshot del CRM — un lead creado el día D '
  'puede moverse de sección después; el conteo refleja el estado al momento del run.';

COMMENT ON COLUMN mofu_facts.total_leads IS
  'Leads de campaña creados en este día (is_campaign_lead=true).';

COMMENT ON COLUMN mofu_facts.high_intent_leads IS
  'Leads en secciones marcadas como is_high_intent=true en funnel_stages. '
  'Para Prevención Salud: Prioritarios, Cotizados, En Auditoria.';

COMMENT ON COLUMN mofu_facts.typification_rate IS
  'typified_leads / total_leads * 100. 0 si total_leads = 0.';

COMMENT ON COLUMN mofu_facts.section_inbox IS
  'Leads actualmente en la sección Inbox del CRM MeisterTask.';

COMMENT ON COLUMN mofu_facts.section_ventas_ganadas IS
  'Leads en Ventas Ganadas — se cuentan en MOFU facts porque la creación del lead '
  'fue en MOFU. El cierre se captura en bofu_facts por separado.';

-- Índices para queries típicas del dashboard
CREATE INDEX IF NOT EXISTS idx_mofu_facts_client_date
  ON mofu_facts (client_slug, date DESC);

CREATE INDEX IF NOT EXISTS idx_mofu_facts_client_campaign
  ON mofu_facts (client_slug, campaign_id, date DESC);


-- ============================================================
-- 3) Tabla `bofu_facts`
-- ============================================================
--
-- Granularidad: un registro por (cliente, día de cierre, campaña).
-- "Día de cierre" = la fecha en que el lead fue movido a la sección
-- con is_closed_won=true (capturada en lead_section_history).
--
-- FUENTE DE DATOS:
--   - Para contar ventas: leads WHERE is_closed_won = true (vía leads_with_stage).
--   - Para fechas de cierre: lead_section_history WHERE section_to = 'Ventas Ganadas'.
--   - Para montos: lead_monetary WHERE is_closed = true.
--
-- Si un lead no tiene registro en lead_monetary, se cuenta la venta pero
-- el revenue es 0 — el campo requires_update=true en lead_monetary señala esto.
--
-- DISTRIBUCIÓN POR SEGMENTO (Voluntario / Monotributista / Obligatorio):
-- Se almacena como columnas wide. La fuente es el campo `tipification` de la tabla
-- leads (parseado del tag de MeisterTask por el normalizer). Si tipification es NULL,
-- el lead va a sales_sin_segmento para no perder el conteo.
-- NOTA: el campo `operatoria` existe en leads pero NO se usa aquí —
-- Franco confirmó (2026-05-05) que `tipification` es el indicador correcto.

CREATE TABLE IF NOT EXISTS bofu_facts (
  -- Dimensiones (PK)
  client_slug            TEXT    NOT NULL,
  date                   DATE    NOT NULL,  -- fecha de cierre (movimiento a Ventas Ganadas)
  campaign_id            TEXT    NOT NULL,

  -- Identidad de la campaña
  campaign_name          TEXT    NOT NULL DEFAULT '',

  -- Volumen de cierres
  sales_count            INTEGER     NOT NULL DEFAULT 0,

  -- Revenue total (suma de lead_monetary.precio_final de ventas cerradas ese día)
  revenue                NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Métricas derivadas pre-computadas
  -- avg_ticket = revenue / sales_count (0 si sales_count = 0)
  avg_ticket             NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Capitas: suma de lead_monetary.capitas para ventas cerradas del día
  capitas_closed         INTEGER     NOT NULL DEFAULT 0,

  -- avg_ticket_capita = revenue / capitas_closed (0 si capitas_closed = 0)
  avg_ticket_capita      NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Las 3 tasas de conversión se calculan en post-procesamiento por el pipeline.
  -- El denominador requiere joinear mofu_facts — no se puede calcular dentro del
  -- stored procedure compute_bofu_facts. El pipeline-engineer las actualiza en un
  -- paso dedicado después de correr compute_bofu_facts y compute_mofu_facts.
  --
  -- conversion_rate_mes es la MÉTRICA PRIMARIA del cliente: permite comparar
  -- la eficiencia de conversión mes a mes sobre una base homogénea.
  --
  -- conversion_rate_acumulado = ventas_acum / leads_acum_campaña * 100
  conversion_rate_acumulado  NUMERIC(6,2) NOT NULL DEFAULT 0,
  -- conversion_rate_mes = ventas_mes_actual / leads_mes_actual * 100  [MÉTRICA PRIMARIA]
  conversion_rate_mes        NUMERIC(6,2) NOT NULL DEFAULT 0,
  -- conversion_rate_30d = ventas_30d / leads_30d * 100  (ventana móvil)
  conversion_rate_30d        NUMERIC(6,2) NOT NULL DEFAULT 0,

  -- Desglose por segmento (wide) — Voluntario / Monotributista / Obligatorio
  -- Fuente: campo `tipification` en la tabla leads.
  sales_voluntario       INTEGER     NOT NULL DEFAULT 0,
  revenue_voluntario     NUMERIC(14,2) NOT NULL DEFAULT 0,

  sales_monotributista   INTEGER     NOT NULL DEFAULT 0,
  revenue_monotributista NUMERIC(14,2) NOT NULL DEFAULT 0,

  sales_obligatorio      INTEGER     NOT NULL DEFAULT 0,
  revenue_obligatorio    NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Captura de cierres sin segmento asignado (tipification IS NULL o valor no reconocido)
  sales_sin_segmento     INTEGER     NOT NULL DEFAULT 0,
  revenue_sin_segmento   NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Auditoría del pipeline
  last_computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (client_slug, date, campaign_id)
);

COMMENT ON TABLE bofu_facts IS
  'Facts BOFU: métricas diarias de ventas cerradas por cliente y campaña. '
  'La dimensión de fecha es el día de cierre (movimiento a Ventas Ganadas en MeisterTask), '
  'no el día de creación del lead. Fuente: leads + lead_section_history + lead_monetary. '
  'Si un lead no tiene registro en lead_monetary, sales_count se incrementa pero '
  'revenue = 0; el campo requires_update en lead_monetary señala esto. '
  'Las 3 conversion_rate se calculan en post-procesamiento por el pipeline. '
  'conversion_rate_mes es la métrica primaria del cliente.';

COMMENT ON COLUMN bofu_facts.date IS
  'Fecha de cierre de la venta: día en que el lead fue movido a la sección '
  'con is_closed_won=true. No es la fecha de creación del lead.';

COMMENT ON COLUMN bofu_facts.revenue IS
  'Suma de lead_monetary.precio_final para ventas cerradas ese día. '
  'Si algún lead cerrado no tiene precio_final, su aporte al revenue es 0.';

COMMENT ON COLUMN bofu_facts.conversion_rate_acumulado IS
  'Ventas acumuladas / leads acumulados de la campaña * 100. '
  'Calculado por el pipeline en post-procesamiento (denominador viene de mofu_facts). '
  'Valor 0 hasta que el pipeline lo actualice.';

COMMENT ON COLUMN bofu_facts.conversion_rate_mes IS
  'Ventas del mes actual / leads del mismo mes * 100. '
  'MÉTRICA PRIMARIA — permite comparación retrospectiva mes a mes. '
  'Calculado por el pipeline en post-procesamiento.';

COMMENT ON COLUMN bofu_facts.conversion_rate_30d IS
  'Ventas últimos 30 días / leads últimos 30 días * 100. Ventana móvil. '
  'Calculado por el pipeline en post-procesamiento.';

COMMENT ON COLUMN bofu_facts.sales_sin_segmento IS
  'Ventas sin tipification reconocida (tipification IS NULL o valor no mapeado). '
  'Si este número es alto, indica que el equipo no está tageando correctamente '
  'los leads en MeisterTask. Fuente: leads.tipification.';

-- Índices para queries típicas del dashboard
CREATE INDEX IF NOT EXISTS idx_bofu_facts_client_date
  ON bofu_facts (client_slug, date DESC);

CREATE INDEX IF NOT EXISTS idx_bofu_facts_client_campaign
  ON bofu_facts (client_slug, campaign_id, date DESC);


-- ============================================================
-- 4) Stored procedure: compute_tofu_facts
-- ============================================================
--
-- Agrega tofu_ads_daily en tofu_facts para un cliente y rango de fechas.
-- Usa el campaign_id que el caller pasa — en v1 siempre 'PMAX_PREPAGAS'.
-- Cuando el extractor traiga IDs reales, el caller pasa el ID real.
--
-- IMPORTANTE: esta función NO lee campaign_id de tofu_ads_daily porque esa
-- tabla todavía no tiene esa columna. Cuando la tenga, el pipeline-engineer
-- debe actualizar esta función para extraer el campaign_id de la fila cruda.
--
-- Invocación desde Python:
--   supabase.rpc('compute_tofu_facts', {
--     'p_client_slug': 'prepagas',
--     'p_date_start':  '2026-01-01',
--     'p_date_end':    '2026-05-05',
--     'p_campaign_id': 'PMAX_PREPAGAS',
--     'p_campaign_name': 'PMAX Prevención Salud',
--   }).execute()

CREATE OR REPLACE FUNCTION compute_tofu_facts(
  p_client_slug  TEXT,
  p_date_start   DATE,
  p_date_end     DATE,
  p_campaign_id  TEXT,
  p_campaign_name TEXT DEFAULT ''
)
RETURNS INTEGER          -- devuelve el número de filas upserted
LANGUAGE plpgsql
SECURITY DEFINER         -- corre con permisos del owner (service_role), no del caller
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO tofu_facts (
    client_slug,
    date,
    campaign_id,
    campaign_name,
    platform,
    impressions,
    clicks,
    spend,
    ctr,
    cpc,
    cpm,
    last_computed_at
  )
  SELECT
    client_slug,
    date,
    p_campaign_id,
    p_campaign_name,
    -- Normalizar plataforma: tofu_ads_daily usa 'google'/'meta'/'linkedin',
    -- tofu_facts usa 'google_ads'/'meta'/'linkedin'
    CASE platform
      WHEN 'google' THEN 'google_ads'
      ELSE platform
    END,
    SUM(impressions)                                    AS impressions,
    SUM(clicks)                                         AS clicks,
    SUM(spend)                                          AS spend,
    -- CTR = clicks / impressions * 100
    CASE WHEN SUM(impressions) > 0
      THEN ROUND((SUM(clicks)::NUMERIC / SUM(impressions) * 100), 4)
      ELSE 0
    END                                                 AS ctr,
    -- CPC = spend / clicks
    CASE WHEN SUM(clicks) > 0
      THEN ROUND((SUM(spend) / SUM(clicks)), 4)
      ELSE 0
    END                                                 AS cpc,
    -- CPM = spend / impressions * 1000
    CASE WHEN SUM(impressions) > 0
      THEN ROUND((SUM(spend) / SUM(impressions) * 1000), 4)
      ELSE 0
    END                                                 AS cpm,
    NOW()
  FROM tofu_ads_daily
  WHERE client_slug = p_client_slug
    AND date BETWEEN p_date_start AND p_date_end
  GROUP BY client_slug, date, platform

  ON CONFLICT (client_slug, date, campaign_id, platform)
  DO UPDATE SET
    campaign_name    = EXCLUDED.campaign_name,
    impressions      = EXCLUDED.impressions,
    clicks           = EXCLUDED.clicks,
    spend            = EXCLUDED.spend,
    ctr              = EXCLUDED.ctr,
    cpc              = EXCLUDED.cpc,
    cpm              = EXCLUDED.cpm,
    last_computed_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compute_tofu_facts IS
  'Agrega tofu_ads_daily en tofu_facts para el rango de fechas dado. '
  'campaign_id lo pasa el caller (en v1 siempre PMAX_PREPAGAS). '
  'Cuando el extractor traiga campaign_id reales, actualizar esta función.';


-- ============================================================
-- 5) Stored procedure: compute_mofu_facts
-- ============================================================
--
-- Agrega leads en mofu_facts por fecha de creación del lead.
-- Solo considera leads con is_campaign_lead=true.
-- Los conteos por sección usan los nombres exactos del CRM de Prevención Salud.
--
-- NOTA: los conteos de sección reflejan la sección ACTUAL del lead (leads.section),
-- no la sección en la fecha de la fila. Es un snapshot del estado vigente.
-- Para una serie histórica exacta de movimientos, usar lead_section_history.
--
-- Invocación desde Python:
--   supabase.rpc('compute_mofu_facts', {
--     'p_client_slug': 'prepagas',
--     'p_date_start':  '2026-01-01',
--     'p_date_end':    '2026-05-05',
--     'p_campaign_id': 'PMAX_PREPAGAS',
--     'p_campaign_name': 'PMAX Prevención Salud',
--   }).execute()

CREATE OR REPLACE FUNCTION compute_mofu_facts(
  p_client_slug   TEXT,
  p_date_start    DATE,
  p_date_end      DATE,
  p_campaign_id   TEXT,
  p_campaign_name TEXT DEFAULT ''
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO mofu_facts (
    client_slug,
    date,
    campaign_id,
    campaign_name,
    total_leads,
    high_intent_leads,
    typified_leads,
    closed_won_leads,
    lost_leads,
    incubating_leads,
    typification_rate,
    section_inbox,
    section_nuevo,
    section_prioritarios,
    section_para_hoy,
    section_procesando,
    section_contactados,
    section_cotizados,
    section_en_auditoria,
    section_mes_que_viene,
    section_a_futuro,
    section_ventas_ganadas,
    section_no_prospera,
    last_computed_at
  )
  SELECT
    lws.client_slug,
    lws.lead_created_at::DATE                                          AS date,
    p_campaign_id,
    p_campaign_name,
    COUNT(*)                                                            AS total_leads,
    COUNT(*) FILTER (WHERE lws.is_high_intent)                         AS high_intent_leads,
    COUNT(*) FILTER (WHERE lws.is_typified)                            AS typified_leads,
    COUNT(*) FILTER (WHERE lws.is_closed_won)                          AS closed_won_leads,
    COUNT(*) FILTER (WHERE lws.is_lost)                                AS lost_leads,
    COUNT(*) FILTER (WHERE lws.is_incubating)                          AS incubating_leads,
    -- Tasa de tipificación
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE lws.is_typified)::NUMERIC / COUNT(*) * 100, 2)
      ELSE 0
    END                                                                 AS typification_rate,
    -- Desglose por sección (sección actual del lead)
    COUNT(*) FILTER (WHERE lws.section = 'Inbox')                      AS section_inbox,
    COUNT(*) FILTER (WHERE lws.section = 'Nuevo')                      AS section_nuevo,
    COUNT(*) FILTER (WHERE lws.section = 'Prioritarios')               AS section_prioritarios,
    COUNT(*) FILTER (WHERE lws.section = 'Para Hoy')                   AS section_para_hoy,
    COUNT(*) FILTER (WHERE lws.section = 'Procesando')                 AS section_procesando,
    COUNT(*) FILTER (WHERE lws.section = 'Contactados')                AS section_contactados,
    COUNT(*) FILTER (WHERE lws.section = 'Cotizados')                  AS section_cotizados,
    COUNT(*) FILTER (WHERE lws.section = 'En Auditoria')               AS section_en_auditoria,
    COUNT(*) FILTER (WHERE lws.section = 'Mes que viene')              AS section_mes_que_viene,
    COUNT(*) FILTER (WHERE lws.section = 'A futuro')                   AS section_a_futuro,
    COUNT(*) FILTER (WHERE lws.section = 'Ventas Ganadas')             AS section_ventas_ganadas,
    COUNT(*) FILTER (WHERE lws.section = 'No prospera')                AS section_no_prospera,
    NOW()
  FROM leads_with_stage lws
  WHERE lws.client_slug   = p_client_slug
    AND lws.is_campaign_lead = true
    AND lws.lead_created_at::DATE BETWEEN p_date_start AND p_date_end

  GROUP BY lws.client_slug, lws.lead_created_at::DATE

  ON CONFLICT (client_slug, date, campaign_id)
  DO UPDATE SET
    campaign_name         = EXCLUDED.campaign_name,
    total_leads           = EXCLUDED.total_leads,
    high_intent_leads     = EXCLUDED.high_intent_leads,
    typified_leads        = EXCLUDED.typified_leads,
    closed_won_leads      = EXCLUDED.closed_won_leads,
    lost_leads            = EXCLUDED.lost_leads,
    incubating_leads      = EXCLUDED.incubating_leads,
    typification_rate     = EXCLUDED.typification_rate,
    section_inbox         = EXCLUDED.section_inbox,
    section_nuevo         = EXCLUDED.section_nuevo,
    section_prioritarios  = EXCLUDED.section_prioritarios,
    section_para_hoy      = EXCLUDED.section_para_hoy,
    section_procesando    = EXCLUDED.section_procesando,
    section_contactados   = EXCLUDED.section_contactados,
    section_cotizados     = EXCLUDED.section_cotizados,
    section_en_auditoria  = EXCLUDED.section_en_auditoria,
    section_mes_que_viene = EXCLUDED.section_mes_que_viene,
    section_a_futuro      = EXCLUDED.section_a_futuro,
    section_ventas_ganadas = EXCLUDED.section_ventas_ganadas,
    section_no_prospera   = EXCLUDED.section_no_prospera,
    last_computed_at      = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compute_mofu_facts IS
  'Agrega leads (vía leads_with_stage) en mofu_facts por fecha de creación del lead. '
  'Solo incluye leads con is_campaign_lead=true. '
  'Los conteos de sección reflejan el estado ACTUAL del lead, no el histórico.';


-- ============================================================
-- 6) Stored procedure: compute_bofu_facts
-- ============================================================
--
-- Agrega ventas cerradas en bofu_facts por fecha de cierre.
-- "Fecha de cierre" = la fecha de la entrada más reciente en lead_section_history
-- donde section_to es una sección con is_closed_won=true en funnel_stages.
--
-- Si un lead no tiene entrada en lead_section_history con is_closed_won
-- (lead ya estaba en Ventas Ganadas antes de que arrancara el pipeline),
-- se usa leads.lead_updated_at como proxy de la fecha de cierre.
--
-- El revenue viene de lead_monetary.precio_final (primer registro con is_closed=true).
-- Si hay múltiples registros en lead_monetary (varias cotizaciones), se toma el de
-- precio_final más alto — heurística conservadora para no inflar el número.
--
-- Invocación desde Python:
--   supabase.rpc('compute_bofu_facts', {
--     'p_client_slug': 'prepagas',
--     'p_date_start':  '2026-01-01',
--     'p_date_end':    '2026-05-05',
--     'p_campaign_id': 'PMAX_PREPAGAS',
--     'p_campaign_name': 'PMAX Prevención Salud',
--   }).execute()

CREATE OR REPLACE FUNCTION compute_bofu_facts(
  p_client_slug   TEXT,
  p_date_start    DATE,
  p_date_end      DATE,
  p_campaign_id   TEXT,
  p_campaign_name TEXT DEFAULT ''
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- CTE: determinar la fecha de cierre de cada lead cerrado.
  -- Se busca en lead_section_history el movimiento hacia una sección closed_won.
  -- Si no hay entry en history, se usa lead_updated_at como fallback.
  INSERT INTO bofu_facts (
    client_slug,
    date,
    campaign_id,
    campaign_name,
    sales_count,
    revenue,
    avg_ticket,
    capitas_closed,
    avg_ticket_capita,
    conversion_rate_acumulado,
    conversion_rate_mes,
    conversion_rate_30d,
    sales_voluntario,
    revenue_voluntario,
    sales_monotributista,
    revenue_monotributista,
    sales_obligatorio,
    revenue_obligatorio,
    sales_sin_segmento,
    revenue_sin_segmento,
    last_computed_at
  )
  WITH closed_leads AS (
    -- Leads cerrados con is_campaign_lead=true
    SELECT
      lws.client_slug,
      lws.meistertask_id,
      lws.tipification,
      lws.lead_updated_at
    FROM leads_with_stage lws
    WHERE lws.client_slug    = p_client_slug
      AND lws.is_closed_won  = true
      AND lws.is_campaign_lead = true
  ),
  close_dates AS (
    -- Fecha de cierre: última entrada en history con sección closed_won
    SELECT
      cl.client_slug,
      cl.meistertask_id,
      cl.tipification,
      COALESCE(
        MAX(lsh.detected_at)::DATE,
        cl.lead_updated_at::DATE
      ) AS close_date
    FROM closed_leads cl
    LEFT JOIN lead_section_history lsh
      ON  lsh.client_slug    = cl.client_slug
      AND lsh.meistertask_id = cl.meistertask_id
      AND lsh.section_to IN (
        -- Subselecta las secciones cerradas para este cliente
        SELECT section_name
        FROM funnel_stages
        WHERE client_slug  = p_client_slug
          AND is_closed_won = true
          AND is_active     = true
      )
    GROUP BY cl.client_slug, cl.meistertask_id, cl.tipification, cl.lead_updated_at
  ),
  revenue_per_lead AS (
    -- Precio final por lead: el mayor precio_final registrado con is_closed=true.
    -- Si no hay precio, queda NULL (revenue contribuye 0).
    SELECT
      client_slug,
      meistertask_id,
      MAX(precio_final) AS precio_final,
      MAX(capitas)      AS capitas
    FROM lead_monetary
    WHERE client_slug = p_client_slug
      AND is_closed   = true
    GROUP BY client_slug, meistertask_id
  ),
  enriched AS (
    SELECT
      cd.client_slug,
      cd.close_date,
      cd.tipification,
      COALESCE(rpl.precio_final, 0) AS precio_final,
      COALESCE(rpl.capitas, 0)      AS capitas
    FROM close_dates cd
    LEFT JOIN revenue_per_lead rpl
      ON  rpl.client_slug    = cd.client_slug
      AND rpl.meistertask_id = cd.meistertask_id
    WHERE cd.close_date BETWEEN p_date_start AND p_date_end
  )
  SELECT
    client_slug,
    close_date,
    p_campaign_id,
    p_campaign_name,
    -- Volumen
    COUNT(*)                                                                    AS sales_count,
    COALESCE(SUM(precio_final), 0)                                              AS revenue,
    -- avg_ticket
    CASE WHEN COUNT(*) > 0
      THEN ROUND(COALESCE(SUM(precio_final), 0) / COUNT(*), 2)
      ELSE 0
    END                                                                         AS avg_ticket,
    -- Capitas
    COALESCE(SUM(capitas), 0)::INTEGER                                          AS capitas_closed,
    -- avg_ticket_capita
    CASE WHEN COALESCE(SUM(capitas), 0) > 0
      THEN ROUND(COALESCE(SUM(precio_final), 0) / SUM(capitas), 2)
      ELSE 0
    END                                                                         AS avg_ticket_capita,
    -- Las 3 conversion_rate se dejan en 0 acá — el pipeline las calcula y
    -- actualiza por separado con el denominador correcto (total leads de
    -- la campaña desde mofu_facts). conversion_rate_mes es la primaria.
    0::NUMERIC(6,2)                                                             AS conversion_rate_acumulado,
    0::NUMERIC(6,2)                                                             AS conversion_rate_mes,
    0::NUMERIC(6,2)                                                             AS conversion_rate_30d,
    -- Desglose por segmento — fuente: tipification (no operatoria)
    COUNT(*) FILTER (WHERE tipification = 'Voluntario')                           AS sales_voluntario,
    COALESCE(SUM(precio_final) FILTER (WHERE tipification = 'Voluntario'), 0)     AS revenue_voluntario,
    COUNT(*) FILTER (WHERE tipification = 'Monotributista')                       AS sales_monotributista,
    COALESCE(SUM(precio_final) FILTER (WHERE tipification = 'Monotributista'), 0) AS revenue_monotributista,
    COUNT(*) FILTER (WHERE tipification = 'Obligatorio')                          AS sales_obligatorio,
    COALESCE(SUM(precio_final) FILTER (WHERE tipification = 'Obligatorio'), 0)    AS revenue_obligatorio,
    COUNT(*) FILTER (WHERE tipification IS NULL OR tipification NOT IN ('Voluntario','Monotributista','Obligatorio'))   AS sales_sin_segmento,
    COALESCE(SUM(precio_final) FILTER (WHERE tipification IS NULL OR tipification NOT IN ('Voluntario','Monotributista','Obligatorio')), 0) AS revenue_sin_segmento,
    NOW()
  FROM enriched
  GROUP BY client_slug, close_date

  ON CONFLICT (client_slug, date, campaign_id)
  DO UPDATE SET
    campaign_name          = EXCLUDED.campaign_name,
    sales_count            = EXCLUDED.sales_count,
    revenue                = EXCLUDED.revenue,
    avg_ticket             = EXCLUDED.avg_ticket,
    capitas_closed         = EXCLUDED.capitas_closed,
    avg_ticket_capita      = EXCLUDED.avg_ticket_capita,
    -- Las 3 conversion_rate NO se pisan en el upsert — el pipeline las actualiza
    -- por separado para no borrar valores ya computados en el paso de post-proceso.
    sales_voluntario       = EXCLUDED.sales_voluntario,
    revenue_voluntario     = EXCLUDED.revenue_voluntario,
    sales_monotributista   = EXCLUDED.sales_monotributista,
    revenue_monotributista = EXCLUDED.revenue_monotributista,
    sales_obligatorio      = EXCLUDED.sales_obligatorio,
    revenue_obligatorio    = EXCLUDED.revenue_obligatorio,
    sales_sin_segmento     = EXCLUDED.sales_sin_segmento,
    revenue_sin_segmento   = EXCLUDED.revenue_sin_segmento,
    last_computed_at       = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compute_bofu_facts IS
  'Agrega ventas cerradas en bofu_facts por fecha de cierre. '
  'Fecha de cierre = última entrada en lead_section_history con sección is_closed_won=true. '
  'Revenue = precio_final más alto en lead_monetary con is_closed=true. '
  'Segmentación por leads.tipification (no operatoria). '
  'Las 3 conversion_rate se dejan en 0 — el pipeline las actualiza por separado '
  'con denominador de mofu_facts. conversion_rate_mes es la métrica primaria.';


-- ============================================================
-- 7) RLS + Policies (mismo patrón que migraciones anteriores)
-- ============================================================

ALTER TABLE tofu_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mofu_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bofu_facts ENABLE ROW LEVEL SECURITY;

-- tofu_facts

DROP POLICY IF EXISTS "service_role_full_tofu_facts" ON tofu_facts;
CREATE POLICY "service_role_full_tofu_facts" ON tofu_facts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_tofu_facts" ON tofu_facts;
CREATE POLICY "anon_read_by_slug_tofu_facts" ON tofu_facts
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');

-- mofu_facts

DROP POLICY IF EXISTS "service_role_full_mofu_facts" ON mofu_facts;
CREATE POLICY "service_role_full_mofu_facts" ON mofu_facts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_mofu_facts" ON mofu_facts;
CREATE POLICY "anon_read_by_slug_mofu_facts" ON mofu_facts
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');

-- bofu_facts

DROP POLICY IF EXISTS "service_role_full_bofu_facts" ON bofu_facts;
CREATE POLICY "service_role_full_bofu_facts" ON bofu_facts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_by_slug_bofu_facts" ON bofu_facts;
CREATE POLICY "anon_read_by_slug_bofu_facts" ON bofu_facts
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');


-- ============================================================
-- ROLLBACK (commented — aplicar manualmente si hace falta)
-- ============================================================
--
-- DROP POLICY IF EXISTS "anon_read_by_slug_bofu_facts"  ON bofu_facts;
-- DROP POLICY IF EXISTS "service_role_full_bofu_facts"  ON bofu_facts;
-- DROP POLICY IF EXISTS "anon_read_by_slug_mofu_facts"  ON mofu_facts;
-- DROP POLICY IF EXISTS "service_role_full_mofu_facts"  ON mofu_facts;
-- DROP POLICY IF EXISTS "anon_read_by_slug_tofu_facts"  ON tofu_facts;
-- DROP POLICY IF EXISTS "service_role_full_tofu_facts"  ON tofu_facts;
-- ALTER TABLE bofu_facts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE mofu_facts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tofu_facts DISABLE ROW LEVEL SECURITY;
-- DROP FUNCTION IF EXISTS compute_bofu_facts(text, date, date, text, text);
-- DROP FUNCTION IF EXISTS compute_mofu_facts(text, date, date, text, text);
-- DROP FUNCTION IF EXISTS compute_tofu_facts(text, date, date, text, text);
-- DROP INDEX IF EXISTS idx_bofu_facts_client_campaign;
-- DROP INDEX IF EXISTS idx_bofu_facts_client_date;
-- DROP INDEX IF EXISTS idx_mofu_facts_client_campaign;
-- DROP INDEX IF EXISTS idx_mofu_facts_client_date;
-- DROP INDEX IF EXISTS idx_tofu_facts_platform;
-- DROP INDEX IF EXISTS idx_tofu_facts_client_campaign;
-- DROP INDEX IF EXISTS idx_tofu_facts_client_date;
-- DROP TABLE IF EXISTS bofu_facts;
-- DROP TABLE IF EXISTS mofu_facts;
-- DROP TABLE IF EXISTS tofu_facts;
