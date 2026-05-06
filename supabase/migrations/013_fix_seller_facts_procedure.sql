-- Migration: 013_fix_seller_facts_procedure.sql | Date: 2026-05-06 | Author: supabase-architect
--
-- FIX: column "ec.meistertask_id does not exist" en compute_seller_facts
--
-- CAUSA
-- ------
-- En 012_seller_facts.sql, CTE 4 (enriched_closed) no proyectaba meistertask_id.
-- CTE 5 (agg) referenciaba ec.meistertask_id para COUNT(DISTINCT ec.meistertask_id)
-- — pero ec es el alias de enriched_closed, que no tenía esa columna.
-- Postgres reportaba: column "ec.meistertask_id does not exist".
--
-- FIX
-- ----
-- Propagar cd.meistertask_id en el SELECT de enriched_closed (CTE 4).
-- Esto permite que CTE 5 haga COUNT(DISTINCT ec.meistertask_id) correctamente,
-- contando ventas únicas por meistertask_id en lugar de filas de join.
--
-- IDEMPOTENCIA: CREATE OR REPLACE FUNCTION — re-ejecutar no rompe datos.

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
      AND TRIM(COALESCE(lws.assignee, '')) <> ''
      AND LOWER(TRIM(lws.assignee)) <> 'umoh crew'
  ),

  -- CTE 2: fecha de cierre de cada lead cerrado de campaña.
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
  -- FIX (013): se agrega cd.meistertask_id al SELECT para que CTE 5
  -- pueda hacer COUNT(DISTINCT ec.meistertask_id) correctamente.
  enriched_closed AS (
    SELECT
      cd.client_slug,
      cd.meistertask_id,                               -- FIX: proyectado aquí
      cd.seller_name,
      cd.lead_created_at::DATE                 AS created_date,
      cd.close_date,
      COALESCE(rpl.precio_final, 0)            AS precio_final,
      COALESCE(rpl.capitas, 0)                 AS capitas,
      (cd.close_date - cd.lead_created_at::DATE) AS cycle_days
    FROM close_dates cd
    LEFT JOIN revenue_per_lead rpl
      ON  rpl.client_slug    = cd.client_slug
      AND rpl.meistertask_id = cd.meistertask_id
    WHERE cd.close_date BETWEEN p_date_start AND p_date_end
      AND cd.lead_created_at::DATE BETWEEN p_date_start AND p_date_end
  ),

  -- CTE 5: agregación por (assignee, created_date).
  agg AS (
    SELECT
      sl.client_slug,
      sl.created_date,
      sl.seller_name,
      COUNT(DISTINCT sl.meistertask_id)                           AS leads_assigned,
      COUNT(DISTINCT ec.meistertask_id)                           AS sales_count,
      COALESCE(SUM(ec.precio_final), 0)                           AS revenue,
      COALESCE(SUM(ec.capitas), 0)::INTEGER                       AS capitas_closed,
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

  SELECT
    client_slug,
    created_date,
    p_campaign_id,
    p_campaign_name,
    seller_name,
    leads_assigned,
    sales_count,
    revenue,
    CASE WHEN sales_count > 0
      THEN ROUND(revenue / sales_count, 2)
      ELSE 0
    END                                             AS avg_ticket,
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
  'FIX 013: enriched_closed ahora proyecta meistertask_id para que COUNT(DISTINCT ec.meistertask_id) en agg funcione. '
  'La dimensión date es lead_created_at::date — denominador coherente para effectiveness. '
  'Solo incluye leads con is_campaign_lead=true y assignee válido (no NULL, no vacío, no "umoh crew"). '
  'capitas_closed: SUM(lead_monetary.capitas) para ventas en el rango. '
  'avg_cycle_days: AVG(close_date - lead_created_at) en días; close_date desde '
  'lead_section_history con fallback a lead_updated_at. '
  'seller_email NO se actualiza en el upsert — se sincroniza desde el YAML por separado.';
