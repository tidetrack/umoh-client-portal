-- Migration: 012_seller_facts.sql | Date: 2026-05-06 | Author: supabase-architect
--
-- Tabla `seller_facts` + stored procedure `compute_seller_facts`.
--
-- PROPÓSITO
-- ----------
-- El ranking de vendedores en BOFU se calculaba en runtime en bofu.php (líneas
-- 181-221), agrupando `leads` por `assignee` en cada request. Esta migración
-- materializa ese cálculo en una tabla facts dedicada con:
--   - Granularidad distinta a bofu_facts: una fila por (cliente × día × campaña × vendedor).
--   - Dos métricas que el endpoint PHP dejaba pendientes (capitas_closed, avg_cycle_days)
--     implementadas correctamente aquí.
--   - Sheet propia para auditoría del cliente (4ta pestaña).
--
-- DECISIÓN: NO columnas en bofu_facts
-- La granularidad es diferente: bofu_facts agrega por (client, día, campaña);
-- seller_facts agrega por (client, día, campaña, vendedor). Mezclarlos contaminaría
-- bofu_facts con datos de vendedores y haría imposible mantener la PK limpia.
--
-- FECHA DE CIERRE vs FECHA DE ASIGNACIÓN DEL LEAD
-- -------------------------------------------------
-- seller_facts tiene DOS dimensiones de fecha:
--   - `date` (columna PK): fecha en que el lead fue CREADO (lead_created_at::date).
--     Permite responder "¿qué leads recibió cada vendedor en el día X?".
--   - La fecha de cierre se usa SOLO para calcular avg_cycle_days y para filtrar
--     qué ventas se computan dentro del rango solicitado. No es una dimensión de la PK.
--
-- Por qué usar lead_created_at como fecha primaria:
--   La pregunta del negocio es "¿qué leads se asignaron a Fulano en el período?".
--   Si usáramos la fecha de cierre, los leads asignados en enero pero cerrados en
--   febrero no aparecerían en el reporte de enero — lo cual confundiría el tracking
--   de efectividad. La granularidad "leads asignados por día" como denominador es
--   la única interpretación coherente con el KPI de effectiveness del equipo.
--
-- SELLER_EMAIL: nullable
-- -----------------------
-- El email del vendedor no viene del CSV de MeisterTask — vive en el YAML del
-- cliente bajo la clave `assignee_emails`. Se deja NULL por defecto. Un script
-- separado puede sincronizarlo desde el YAML sin bloquear el pipeline principal.
--
-- EXCLUSIÓN DE ASSIGNEES INVÁLIDOS
-- ----------------------------------
-- El procedure excluye leads donde assignee IS NULL, assignee = '' (vacío),
-- o LOWER(assignee) = 'umoh crew'. Mismo criterio que bofu.php línea 195.
--
-- CAPITAS_CLOSED y AVG_CYCLE_DAYS
-- ---------------------------------
-- En bofu.php estas métricas quedaban en 0 (líneas 217-218) porque el endpoint
-- no calculaba capitas por vendedor y no tenía lógica de ciclo de ventas.
-- Este procedure los implementa correctamente:
--   - capitas_closed: SUM(lead_monetary.capitas) para ventas del seller en el rango.
--   - avg_cycle_days: AVG(close_date - lead_created_at) en días. La fecha de cierre
--     se obtiene de lead_section_history (sección is_closed_won=true), con fallback
--     a leads.lead_updated_at si el lead no tiene entrada en el historial.
--
-- IDEMPOTENCIA: CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION.
-- Re-ejecutar la migración no rompe datos existentes.

-- ============================================================
-- 1) Tabla `seller_facts`
-- ============================================================

CREATE TABLE IF NOT EXISTS seller_facts (
  -- Dimensiones (PK)
  client_slug    TEXT    NOT NULL,
  date           DATE    NOT NULL,  -- fecha de creación del lead (lead_created_at::date)
  campaign_id    TEXT    NOT NULL,
  seller_name    TEXT    NOT NULL,  -- viene de leads.assignee (trimmed)

  -- Identidad de la campaña (desnormalizado para legibilidad en Sheets)
  campaign_name  TEXT    NOT NULL DEFAULT '',

  -- Identidad del vendedor
  -- seller_email se sincroniza opcionalmente desde config/clients/{slug}.yaml
  -- bajo la clave `assignee_emails`. NULL hasta que se ejecute el sync.
  seller_email   TEXT,

  -- Métricas de volumen
  leads_assigned  INTEGER       NOT NULL DEFAULT 0,  -- leads de campaña asignados al seller ese día
  sales_count     INTEGER       NOT NULL DEFAULT 0,  -- ventas cerradas por el seller en el período

  -- Métricas de revenue
  revenue         NUMERIC(14,2) NOT NULL DEFAULT 0,  -- SUM(lead_monetary.precio_final) de ventas del seller
  avg_ticket      NUMERIC(14,2) NOT NULL DEFAULT 0,  -- revenue / sales_count (0 si sales_count = 0)

  -- Métricas derivadas
  -- effectiveness = sales_count / leads_assigned * 100 (0 si leads_assigned = 0)
  effectiveness   NUMERIC(6,2)  NOT NULL DEFAULT 0,

  -- Capitas: implementado aquí (pendiente en bofu.php)
  capitas_closed  INTEGER       NOT NULL DEFAULT 0,  -- SUM(lead_monetary.capitas) de ventas del seller

  -- Ciclo de ventas: implementado aquí (pendiente en bofu.php)
  -- avg_cycle_days = AVG(close_date - lead_created_at) en días decimales
  avg_cycle_days  NUMERIC(6,2)  NOT NULL DEFAULT 0,

  -- Auditoría del pipeline
  last_computed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  PRIMARY KEY (client_slug, date, campaign_id, seller_name)
);

COMMENT ON TABLE seller_facts IS
  'Facts de vendedores: métricas diarias por cliente, campaña y vendedor. '
  'Granularidad: una fila por (client_slug, date, campaign_id, seller_name). '
  'La dimensión date es lead_created_at::date (día de creación/asignación del lead). '
  'Fuentes: leads (vía leads_with_stage) + lead_section_history + lead_monetary. '
  'capitas_closed y avg_cycle_days estaban pendientes en bofu.php — implementados acá. '
  'Excluye assignees NULL, vacíos o igual a "umoh crew" (mismo criterio que bofu.php).';

COMMENT ON COLUMN seller_facts.date IS
  'Fecha de creación del lead (lead_created_at::date). '
  'Permite analizar "¿qué leads recibió cada vendedor en el día X?". '
  'No es la fecha de cierre — esa se usa solo para avg_cycle_days.';

COMMENT ON COLUMN seller_facts.seller_email IS
  'Email del vendedor, nullable. '
  'Se sincroniza opcionalmente desde config/clients/{slug}.yaml (clave assignee_emails). '
  'No lo calcula el stored procedure — queda NULL hasta un sync externo.';

COMMENT ON COLUMN seller_facts.leads_assigned IS
  'Leads de campaña (is_campaign_lead=true) asignados al vendedor creados en este día.';

COMMENT ON COLUMN seller_facts.sales_count IS
  'Leads del vendedor que llegaron a una sección con is_closed_won=true, '
  'cuya fecha de cierre cae dentro del rango p_date_start..p_date_end. '
  'IMPORTANTE: puede diferir de leads_assigned porque el cierre ocurre en días distintos.';

COMMENT ON COLUMN seller_facts.capitas_closed IS
  'Suma de lead_monetary.capitas para las ventas cerradas del vendedor. '
  'Pendiente en bofu.php línea 217 — implementado aquí.';

COMMENT ON COLUMN seller_facts.avg_cycle_days IS
  'Promedio de días entre lead_created_at y la fecha de cierre (sección is_closed_won). '
  'Fecha de cierre: último detected_at en lead_section_history con sección is_closed_won=true. '
  'Fallback: lead_updated_at si el lead no tiene entrada en el historial. '
  'Pendiente en bofu.php línea 218 — implementado aquí.';

-- Índices para queries típicas del dashboard
CREATE INDEX IF NOT EXISTS idx_seller_facts_client_date
  ON seller_facts (client_slug, date DESC);

CREATE INDEX IF NOT EXISTS idx_seller_facts_client_seller
  ON seller_facts (client_slug, seller_name, date DESC);

CREATE INDEX IF NOT EXISTS idx_seller_facts_client_campaign
  ON seller_facts (client_slug, campaign_id, date DESC);


-- ============================================================
-- 2) Stored procedure: compute_seller_facts
-- ============================================================
--
-- Agrega leads en seller_facts por (fecha de creación × vendedor).
-- Solo considera leads con is_campaign_lead=true y assignee válido.
--
-- LÓGICA EN 5 CTEs:
--
--   seller_leads   → leads de campaña en el rango, agrupados por (assignee, created_date).
--                    Denominador para leads_assigned y effectiveness.
--
--   close_dates    → para cada lead cerrado (is_closed_won=true y is_campaign_lead=true),
--                    determina la fecha de cierre. Usa lead_section_history cuando existe,
--                    con fallback a lead_updated_at. No filtra por rango — el filtro de
--                    rango se aplica en el paso final sobre lead_created_at.
--
--   revenue_per_lead → mayor precio_final con is_closed=true por lead (heurística de
--                      compute_bofu_facts: si hay múltiples cotizaciones, se toma el máximo).
--                      También suma capitas.
--
--   enriched_closed → junta close_dates con revenue_per_lead. El JOIN clave es sobre
--                     lws.assignee para vincular el cierre al vendedor correcto.
--                     Filtra cierres dentro del rango p_date_start..p_date_end.
--
--   agg             → agrega por (assignee, lead_created_at::date) combinando:
--                     a) COUNT de leads asignados (seller_leads)
--                     b) SUM de ventas/revenue/capitas del vendedor (enriched_closed)
--                     El JOIN es LEFT para preservar vendedores con leads pero sin ventas.
--
-- NOTA SOBRE avg_cycle_days:
--   Se calcula como AVG(close_date - lead_created_at) solo para las ventas cerradas
--   del vendedor. Un vendedor con 0 ventas tendrá avg_cycle_days = 0.
--
-- Invocación desde Python:
--   supabase.rpc('compute_seller_facts', {
--     'p_client_slug':   'prepagas',
--     'p_date_start':    '2026-01-01',
--     'p_date_end':      '2026-05-06',
--     'p_campaign_id':   'PMAX_PREPAGAS',
--     'p_campaign_name': 'PMAX Prevención Salud',
--   }).execute()

CREATE OR REPLACE FUNCTION compute_seller_facts(
  p_client_slug   TEXT,
  p_date_start    DATE,
  p_date_end      DATE,
  p_campaign_id   TEXT,
  p_campaign_name TEXT DEFAULT ''
)
RETURNS INTEGER          -- devuelve el número de filas upserted
LANGUAGE plpgsql
SECURITY DEFINER         -- corre con permisos del owner (service_role), no del caller
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN

  INSERT INTO seller_facts (
    client_slug,
    date,
    campaign_id,
    campaign_name,
    seller_name,
    leads_assigned,
    sales_count,
    revenue,
    avg_ticket,
    effectiveness,
    capitas_closed,
    avg_cycle_days,
    last_computed_at
  )
  WITH
  -- CTE 1: leads de campaña en el rango, con assignee válido.
  -- Un lead por fila. Luego se agrupan por (assignee, created_date).
  seller_leads AS (
    SELECT
      lws.client_slug,
      TRIM(lws.assignee)         AS seller_name,
      lws.meistertask_id,
      lws.lead_created_at::DATE  AS created_date,
      lws.lead_updated_at        -- fallback para close_date
    FROM leads_with_stage lws
    WHERE lws.client_slug      = p_client_slug
      AND lws.is_campaign_lead = true
      AND lws.lead_created_at::DATE BETWEEN p_date_start AND p_date_end
      -- Excluir assignees inválidos (mismo criterio que bofu.php línea 195)
      AND TRIM(COALESCE(lws.assignee, '')) <> ''
      AND LOWER(TRIM(lws.assignee)) <> 'umoh crew'
  ),

  -- CTE 2: fecha de cierre de cada lead cerrado de campaña.
  -- Usamos lead_section_history cuando existe, con fallback a lead_updated_at.
  -- NO filtramos por rango aquí — el filtro se aplica en enriched_closed
  -- sobre lead_created_at (la dimensión de fecha de la PK).
  close_dates AS (
    SELECT
      lws.client_slug,
      lws.meistertask_id,
      TRIM(lws.assignee)  AS seller_name,
      lws.lead_created_at,
      COALESCE(
        MAX(lsh.detected_at)::DATE,
        lws.lead_updated_at::DATE
      )                   AS close_date
    FROM leads_with_stage lws
    LEFT JOIN lead_section_history lsh
      ON  lsh.client_slug    = lws.client_slug
      AND lsh.meistertask_id = lws.meistertask_id
      AND lsh.section_to IN (
        -- Secciones is_closed_won para este cliente (dinámico, igual que compute_bofu_facts)
        SELECT section_name
        FROM funnel_stages
        WHERE client_slug  = p_client_slug
          AND is_closed_won = true
          AND is_active     = true
      )
    WHERE lws.client_slug      = p_client_slug
      AND lws.is_closed_won    = true
      AND lws.is_campaign_lead = true
      AND TRIM(COALESCE(lws.assignee, '')) <> ''
      AND LOWER(TRIM(lws.assignee)) <> 'umoh crew'
    GROUP BY
      lws.client_slug,
      lws.meistertask_id,
      lws.assignee,
      lws.lead_created_at,
      lws.lead_updated_at
  ),

  -- CTE 3: revenue y capitas por lead cerrado.
  -- Heurística de compute_bofu_facts: si hay múltiples registros en lead_monetary,
  -- se toma el mayor precio_final (cotización elegida) y la suma de capitas.
  revenue_per_lead AS (
    SELECT
      client_slug,
      meistertask_id,
      MAX(precio_final) AS precio_final,
      SUM(capitas)      AS capitas
    FROM lead_monetary
    WHERE client_slug = p_client_slug
      AND is_closed   = true
    GROUP BY client_slug, meistertask_id
  ),

  -- CTE 4: cierres enriquecidos con revenue, capitas y ciclo.
  -- Filtramos por lead_created_at::DATE dentro del rango (la dimensión de la PK).
  -- Esto asegura que un lead creado en enero pero cerrado en febrero aparece
  -- en la fila del día de enero con su venta computada.
  enriched_closed AS (
    SELECT
      cd.client_slug,
      cd.seller_name,
      cd.lead_created_at::DATE                 AS created_date,
      cd.close_date,
      COALESCE(rpl.precio_final, 0)            AS precio_final,
      COALESCE(rpl.capitas, 0)                 AS capitas,
      -- Días de ciclo: diferencia entre cierre y creación del lead
      (cd.close_date - cd.lead_created_at::DATE) AS cycle_days
    FROM close_dates cd
    LEFT JOIN revenue_per_lead rpl
      ON  rpl.client_slug    = cd.client_slug
      AND rpl.meistertask_id = cd.meistertask_id
    -- El cierre debe caer dentro del rango solicitado
    WHERE cd.close_date BETWEEN p_date_start AND p_date_end
      -- El lead debe haber sido creado dentro del rango (consistencia con la PK)
      AND cd.lead_created_at::DATE BETWEEN p_date_start AND p_date_end
  ),

  -- CTE 5: agregación por (assignee, created_date).
  -- LEFT JOIN seller_leads con enriched_closed para preservar vendedores
  -- con leads asignados pero sin ventas en el rango.
  agg AS (
    SELECT
      sl.client_slug,
      sl.created_date,
      sl.seller_name,
      COUNT(DISTINCT sl.meistertask_id)                           AS leads_assigned,
      COUNT(DISTINCT ec.meistertask_id)                           AS sales_count,  -- ver nota abajo
      COALESCE(SUM(ec.precio_final), 0)                           AS revenue,
      COALESCE(SUM(ec.capitas), 0)::INTEGER                       AS capitas_closed,
      -- avg_cycle_days: solo sobre ventas cerradas (NULL cuando sales_count = 0)
      COALESCE(
        AVG(ec.cycle_days) FILTER (WHERE ec.cycle_days IS NOT NULL),
        0
      )                                                           AS avg_cycle_days
    FROM seller_leads sl
    LEFT JOIN enriched_closed ec
      ON  ec.client_slug  = sl.client_slug
      AND ec.seller_name  = sl.seller_name
      AND ec.created_date = sl.created_date
    GROUP BY sl.client_slug, sl.created_date, sl.seller_name
  )

  -- SELECT final: calcula métricas derivadas y proyecta columnas.
  -- sales_count en 'agg' usa COUNT(DISTINCT ec.meistertask_id) sobre el LEFT JOIN —
  -- los NULLs del LEFT JOIN no son contados, lo que da 0 para vendedores sin ventas.
  SELECT
    client_slug,
    created_date,
    p_campaign_id,
    p_campaign_name,
    seller_name,
    leads_assigned,
    sales_count,
    revenue,
    -- avg_ticket
    CASE WHEN sales_count > 0
      THEN ROUND(revenue / sales_count, 2)
      ELSE 0
    END                                             AS avg_ticket,
    -- effectiveness
    CASE WHEN leads_assigned > 0
      THEN ROUND(sales_count::NUMERIC / leads_assigned * 100, 2)
      ELSE 0
    END                                             AS effectiveness,
    capitas_closed,
    ROUND(avg_cycle_days::NUMERIC, 2)               AS avg_cycle_days,
    NOW()
  FROM agg

  ON CONFLICT (client_slug, date, campaign_id, seller_name)
  DO UPDATE SET
    campaign_name    = EXCLUDED.campaign_name,
    leads_assigned   = EXCLUDED.leads_assigned,
    sales_count      = EXCLUDED.sales_count,
    revenue          = EXCLUDED.revenue,
    avg_ticket       = EXCLUDED.avg_ticket,
    effectiveness    = EXCLUDED.effectiveness,
    capitas_closed   = EXCLUDED.capitas_closed,
    avg_cycle_days   = EXCLUDED.avg_cycle_days,
    last_computed_at = NOW();
  -- seller_email NO se pisa en el upsert — lo gestiona un sync externo desde el YAML.

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compute_seller_facts IS
  'Agrega leads en seller_facts por (fecha de creación × vendedor). '
  'La dimensión date es lead_created_at::date — denominador coherente para effectiveness. '
  'Solo incluye leads con is_campaign_lead=true y assignee válido (no NULL, no vacío, no "umoh crew"). '
  'capitas_closed: SUM(lead_monetary.capitas) para ventas en el rango. '
  'avg_cycle_days: AVG(close_date - lead_created_at) en días; close_date desde '
  'lead_section_history con fallback a lead_updated_at. '
  'seller_email NO se actualiza en el upsert — se sincroniza desde el YAML por separado.';


-- ============================================================
-- 3) RLS + Policies (mismo patrón que migración 009)
-- ============================================================

ALTER TABLE seller_facts ENABLE ROW LEVEL SECURITY;

-- service_role: acceso completo (para el pipeline Python)
DROP POLICY IF EXISTS "service_role_full_seller_facts" ON seller_facts;
CREATE POLICY "service_role_full_seller_facts" ON seller_facts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- anon: solo lectura filtrada por client_slug (preparado para v2 realtime)
DROP POLICY IF EXISTS "anon_read_by_slug_seller_facts" ON seller_facts;
CREATE POLICY "anon_read_by_slug_seller_facts" ON seller_facts
  FOR SELECT
  TO anon
  USING (client_slug = current_setting('request.jwt.claims', true)::json->>'client_slug');


-- ============================================================
-- ROLLBACK (commented — aplicar manualmente si hace falta)
-- ============================================================
--
-- DROP POLICY IF EXISTS "anon_read_by_slug_seller_facts"  ON seller_facts;
-- DROP POLICY IF EXISTS "service_role_full_seller_facts"  ON seller_facts;
-- ALTER TABLE seller_facts DISABLE ROW LEVEL SECURITY;
-- DROP FUNCTION IF EXISTS compute_seller_facts(text, date, date, text, text);
-- DROP INDEX IF EXISTS idx_seller_facts_client_campaign;
-- DROP INDEX IF EXISTS idx_seller_facts_client_seller;
-- DROP INDEX IF EXISTS idx_seller_facts_client_date;
-- DROP TABLE IF EXISTS seller_facts;
