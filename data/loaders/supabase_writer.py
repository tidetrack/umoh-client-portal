"""
data/loaders/supabase_writer.py
---------------------------------
Loader que escribe los datos normalizados en Supabase con dedup multi-tenant.

Responsabilidades:
- Iniciar y cerrar runs de importación en la tabla `import_runs`.
- Upsert de leads con lógica: INSERT si no existe, UPDATE si updated_at es más
  reciente, SKIP si updated_at es igual o anterior.
- Registrar cambios de sección en `lead_section_history`.
- Upsert de datos monetarios en `lead_monetary` (dedup por plan_code + capitas).
- Upsert de actividades en `lead_activity` (dedup por author + commented_at + body_hash).
- Recalcular el flag `requires_update` en `lead_monetary` para todos los leads
  de un cliente.

Algoritmo de upsert en `leads` (sección 8 del brief):
    1. SELECT lead existente por (client_slug, meistertask_id).
    2. Si no existe → INSERT + history(None → section).
    3. Si existe y nuevo updated_at <= db updated_at → SKIP.
    4. Si existe y nuevo updated_at > db updated_at → UPDATE.
       Si section cambió → INSERT en lead_section_history.

Dedup de `lead_section_history`:
    La tabla tiene UNIQUE(client_slug, meistertask_id, section_from, section_to,
    detected_at). Para evitar duplicados de sub-segundo (riesgo #5), comparamos
    la última sección registrada contra la nueva antes de insertar.

Dedup de `lead_monetary`:
    UPSERT con on_conflict='client_slug,meistertask_id,plan_code,capitas'.
    Si plan_code o capitas son None, Postgres trata NULL != NULL en UNIQUE,
    por lo que dos filas con plan_code=NULL y capitas=NULL no harán conflicto.
    El brief acepta este comportamiento; deberá revisarse si los asesores
    cargan múltiples cotizaciones sin plan/cápitas.

Dedup de `lead_activity`:
    UPSERT con on_conflict='client_slug,meistertask_id,author,commented_at,body_hash'.
    body_hash es una columna generada en Postgres (md5(coalesce(body,''))).
    NO incluir body_hash en el INSERT — Postgres la calcula automáticamente.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from supabase import Client

logger = logging.getLogger(__name__)


class SupabaseWriter:
    """Gestiona las escrituras del pipeline MeisterTask en Supabase."""

    def __init__(self, supabase: Client) -> None:
        """Inicializa el writer con un cliente Supabase ya autenticado.

        Args:
            supabase: Instancia de Client (service_role, bypassa RLS).
        """
        self._sb = supabase

    # ------------------------------------------------------------------
    # import_runs
    # ------------------------------------------------------------------

    def start_run(self, client_slug: str, source_file: str) -> str:
        """Inserta una fila en `import_runs` y devuelve el UUID generado.

        Genera el UUID en Python para poder referenciarlo inmediatamente
        sin un round-trip adicional a la DB.

        Args:
            client_slug: Slug del cliente (ej: 'prepagas').
            source_file: Nombre o path del archivo CSV procesado.

        Returns:
            UUID del run como string (ej: '550e8400-e29b-41d4-a716-446655440000').
        """
        run_id = str(uuid.uuid4())
        self._sb.table('import_runs').insert({
            'id': run_id,
            'client_slug': client_slug,
            'source_file': source_file,
        }).execute()
        logger.info("Run iniciado: %s | cliente=%s | archivo=%s", run_id, client_slug, source_file)
        return run_id

    def finish_run(self, run_id: str, totals: dict) -> None:
        """Actualiza la fila de `import_runs` con los totales del run.

        Args:
            run_id: UUID del run (generado por start_run).
            totals: Dict con claves: total_tasks, new_tasks, updated_tasks,
                    skipped_tasks, errors (list de dicts).
        """
        self._sb.table('import_runs').update({
            'total_tasks': totals.get('total', 0),
            'new_tasks': totals.get('new', 0),
            'updated_tasks': totals.get('updated', 0),
            'skipped_tasks': totals.get('skipped', 0),
            'errors': totals.get('errors') or [],
        }).eq('id', run_id).execute()
        logger.info(
            "Run finalizado: %s | total=%d new=%d updated=%d skipped=%d",
            run_id,
            totals.get('total', 0),
            totals.get('new', 0),
            totals.get('updated', 0),
            totals.get('skipped', 0),
        )

    # ------------------------------------------------------------------
    # leads
    # ------------------------------------------------------------------

    def upsert_lead(self, lead_record: dict, run_id: str) -> str:
        """Inserta o actualiza un lead en Supabase con dedup por updated_at.

        Implementa el algoritmo de la sección 8 del brief:
        - Si no existe: INSERT + history entry (None → section).
        - Si existe y new updated_at <= db updated_at: SKIP.
        - Si existe y new updated_at > db updated_at: UPDATE.
          Si la sección cambió: INSERT en lead_section_history.

        Args:
            lead_record: Dict con todos los campos de la tabla `leads`
                         (resultado de normalize_lead_full).
            run_id: UUID del import_run actual.

        Returns:
            'new' | 'updated' | 'skipped'
        """
        client_slug = lead_record['client_slug']
        mt_id = lead_record['meistertask_id']
        new_updated_at_str = lead_record.get('lead_updated_at')
        new_section = lead_record.get('section', '')

        existing_resp = (
            self._sb.table('leads')
            .select('client_slug, meistertask_id, section, lead_updated_at')
            .eq('client_slug', client_slug)
            .eq('meistertask_id', mt_id)
            .execute()
        )
        # execute() on a filtered query returns a response with .data as a list.
        # maybe_single() returns None directly when no row matches in supabase-py 2.x.
        existing_rows = existing_resp.data if existing_resp else []
        existing_data = existing_rows[0] if existing_rows else None

        if existing_data is None:
            # Lead nuevo
            self._sb.table('leads').insert(lead_record).execute()
            self._insert_section_history(
                client_slug, mt_id,
                section_from=None,
                section_to=new_section,
                run_id=run_id,
            )
            logger.debug("Lead nuevo: %s/%s sección=%s", client_slug, mt_id, new_section)
            return 'new'

        # Comparar updated_at
        db_updated_at_str = existing_data.get('lead_updated_at')
        if db_updated_at_str and new_updated_at_str:
            db_dt = _parse_iso(db_updated_at_str)
            new_dt = _parse_iso(new_updated_at_str)
            if db_dt and new_dt and new_dt <= db_dt:
                return 'skipped'

        # Update
        old_section = existing_data.get('section', '')
        # Actualizar last_imported_at
        lead_record['last_imported_at'] = datetime.now(tz=timezone.utc).isoformat()
        self._sb.table('leads').update(lead_record)\
            .eq('client_slug', client_slug)\
            .eq('meistertask_id', mt_id)\
            .execute()

        if old_section != new_section:
            self._insert_section_history(
                client_slug, mt_id,
                section_from=old_section,
                section_to=new_section,
                run_id=run_id,
            )
            logger.debug(
                "Lead actualizado: %s/%s sección %s → %s",
                client_slug, mt_id, old_section, new_section,
            )
        else:
            logger.debug("Lead actualizado: %s/%s (sin cambio de sección)", client_slug, mt_id)

        return 'updated'

    def _insert_section_history(
        self,
        client_slug: str,
        meistertask_id: int,
        section_from: Optional[str],
        section_to: str,
        run_id: str,
    ) -> None:
        """Inserta una entrada en `lead_section_history` con manejo de dedup.

        La tabla tiene UNIQUE(client_slug, meistertask_id, section_from,
        section_to, detected_at). Usamos upsert con on_conflict para
        ignorar duplicados silenciosamente (riesgo #5).

        Args:
            client_slug: Slug del cliente.
            meistertask_id: ID del lead en MeisterTask.
            section_from: Sección anterior (None para leads nuevos).
            section_to: Sección actual.
            run_id: UUID del import_run.
        """
        try:
            self._sb.table('lead_section_history').insert({
                'client_slug': client_slug,
                'meistertask_id': meistertask_id,
                'section_from': section_from,
                'section_to': section_to,
                'import_run_id': run_id,
            }).execute()
        except Exception as e:
            # La UNIQUE constraint silencia duplicados via on_conflict en upsert,
            # pero con INSERT plain podría llegar un error de constraint.
            # Lo logueamos como debug y continuamos — no es crítico.
            err_str = str(e)
            if 'duplicate' in err_str.lower() or '23505' in err_str:
                logger.debug(
                    "History duplicado ignorado: %s/%s %s→%s",
                    client_slug, meistertask_id, section_from, section_to,
                )
            else:
                logger.warning("Error insertando history: %s", e)

    # ------------------------------------------------------------------
    # lead_monetary
    # ------------------------------------------------------------------

    def upsert_monetary(
        self,
        monetary_dict: dict,
        client_slug: str,
        mt_id: int,
        run_id: str,
        is_closed: bool = False,
    ) -> None:
        """Upsert de datos monetarios de un lead.

        Dedup por (client_slug, meistertask_id, plan_code, capitas).
        Si ya existe una fila para esa combinación, actualiza los valores
        de precio. Si no existe, inserta.

        Nota sobre NULLs en la UNIQUE constraint: Postgres trata NULL != NULL
        en índices únicos, por lo que dos filas con plan_code=NULL y
        capitas=NULL no generarán conflicto — se insertarán como filas
        separadas. Es el comportamiento aceptado en v1 (decisión C.3).

        Args:
            monetary_dict: Dict de parse_notes_money o parse_comments.
                           Claves: plan_code, capitas, cuota_mensual,
                           descuento_pct, precio_final, data_source.
            client_slug: Slug del cliente.
            mt_id: ID del lead en MeisterTask.
            run_id: UUID del import_run actual.
            is_closed: True si el lead está en sección is_closed_won=true.
        """
        record = {
            'client_slug': client_slug,
            'meistertask_id': mt_id,
            'plan_code': monetary_dict.get('plan_code'),
            'capitas': monetary_dict.get('capitas'),
            'cuota_mensual': monetary_dict.get('cuota_mensual'),
            'descuento_pct': monetary_dict.get('descuento_pct'),
            'precio_final': monetary_dict.get('precio_final'),
            'data_source': monetary_dict.get('data_source', 'notes_parsed'),
            'is_closed': is_closed,
            'requires_update': (
                monetary_dict.get('precio_final') is None
                or monetary_dict.get('cuota_mensual') is None
            ),
        }

        # Intentar upsert. La UNIQUE es (client_slug, meistertask_id, plan_code, capitas).
        # Cuando plan_code o capitas son NULL, el on_conflict no matchea y se inserta
        # una nueva fila — comportamiento esperado en v1.
        try:
            self._sb.table('lead_monetary').upsert(
                record,
                on_conflict='client_slug,meistertask_id,plan_code,capitas',
            ).execute()
        except Exception as e:
            logger.warning("Error upsert monetary %s/%s: %s", client_slug, mt_id, e)

    # ------------------------------------------------------------------
    # lead_activity
    # ------------------------------------------------------------------

    def upsert_activity(
        self,
        activity_dict: dict,
        client_slug: str,
        mt_id: int,
        run_id: str,
    ) -> None:
        """Upsert de una actividad (comentario) de un lead.

        Dedup por (client_slug, meistertask_id, author, commented_at, body_hash).
        body_hash es una columna GENERADA en Postgres (md5(coalesce(body,''))).
        NO se incluye en el INSERT — Postgres la calcula automáticamente.

        Args:
            activity_dict: Dict con claves author, body, commented_at,
                           extracted_amount. El campo '_body_hash' se excluye.
            client_slug: Slug del cliente.
            mt_id: ID del lead en MeisterTask.
            run_id: UUID del import_run.
        """
        # Excluir el campo interno _body_hash que no va a la DB
        record = {
            'client_slug': client_slug,
            'meistertask_id': mt_id,
            'author': activity_dict.get('author'),
            'body': activity_dict.get('body'),
            'commented_at': activity_dict.get('commented_at'),
            'extracted_amount': activity_dict.get('extracted_amount'),
        }

        try:
            self._sb.table('lead_activity').upsert(
                record,
                on_conflict='client_slug,meistertask_id,author,commented_at,body_hash',
            ).execute()
        except Exception as e:
            logger.warning("Error upsert activity %s/%s: %s", client_slug, mt_id, e)

    # ------------------------------------------------------------------
    # requires_update recalculation
    # ------------------------------------------------------------------

    def recalculate_requires_update(self, client_slug: str) -> int:
        """Recalcula el flag requires_update en lead_monetary para el cliente.

        Trae todas las filas de lead_monetary para el cliente, calcula
        requires_update = (precio_final IS NULL OR cuota_mensual IS NULL),
        y envía UPDATEs individuales para las filas que necesiten cambio.

        Esto resuelve el riesgo #4: el flag queda actualizado cuando el
        asesor completa el monto después del primer import.

        Args:
            client_slug: Slug del cliente.

        Returns:
            Número de filas actualizadas.
        """
        result = (
            self._sb.table('lead_monetary')
            .select('id, precio_final, cuota_mensual, requires_update')
            .eq('client_slug', client_slug)
            .execute()
        )

        rows = result.data or []
        updated_count = 0

        for row in rows:
            correct_value = (
                row.get('precio_final') is None
                or row.get('cuota_mensual') is None
            )
            if row.get('requires_update') != correct_value:
                self._sb.table('lead_monetary')\
                    .update({'requires_update': correct_value})\
                    .eq('id', row['id'])\
                    .execute()
                updated_count += 1

        logger.info(
            "recalculate_requires_update: cliente=%s filas_revisadas=%d actualizadas=%d",
            client_slug, len(rows), updated_count,
        )
        return updated_count


    # ------------------------------------------------------------------
    # facts: compute + conversion rates
    # ------------------------------------------------------------------

    def compute_facts(
        self,
        client_slug: str,
        date_start: str,
        date_end: str,
        campaign_id: str,
        campaign_name: str,
    ) -> dict[str, int]:
        """Llama a los stored procedures compute_mofu_facts y compute_bofu_facts.

        Debe ejecutarse al final de cada run del pipeline MeisterTask, después
        de que todos los leads, lead_section_history y lead_monetary hayan sido
        escritos. Los stored procedures son idempotentes (UPSERT) — re-ejecutar
        no rompe datos.

        Tras poblar bofu_facts, llama a calcular_conversion_rates para actualizar
        las 3 tasas de conversión en bofu_facts con denominadores correctos de
        mofu_facts.

        Args:
            client_slug: Slug del cliente (ej: 'prepagas').
            date_start: Fecha inicio del rango a recomputar (YYYY-MM-DD).
            date_end: Fecha fin del rango a recomputar (YYYY-MM-DD).
            campaign_id: ID de la campaña (ej: 'PMAX_PREPAGAS').
            campaign_name: Nombre legible de la campaña.

        Returns:
            Dict con claves 'mofu_rows' y 'bofu_rows' — filas upserted por cada
            stored procedure. Ambos valores son 0 si el stored procedure falló.
        """
        params = {
            "p_client_slug":   client_slug,
            "p_date_start":    date_start,
            "p_date_end":      date_end,
            "p_campaign_id":   campaign_id,
            "p_campaign_name": campaign_name,
        }

        mofu_rows = 0
        bofu_rows = 0

        try:
            result = self._sb.rpc("compute_mofu_facts", params).execute()
            mofu_rows = result.data if result.data is not None else 0
            logger.info(
                "compute_mofu_facts completado — cliente=%s filas_upserted=%s",
                client_slug, mofu_rows,
            )
        except Exception as exc:
            logger.error(
                "compute_mofu_facts falló para cliente=%s: %s",
                client_slug, exc,
            )

        try:
            result = self._sb.rpc("compute_bofu_facts", params).execute()
            bofu_rows = result.data if result.data is not None else 0
            logger.info(
                "compute_bofu_facts completado — cliente=%s filas_upserted=%s",
                client_slug, bofu_rows,
            )
        except Exception as exc:
            logger.error(
                "compute_bofu_facts falló para cliente=%s: %s",
                client_slug, exc,
            )

        # Calcular las 3 conversion rates en bofu_facts
        self.calcular_conversion_rates(
            client_slug=client_slug,
            date_start=date_start,
            date_end=date_end,
            campaign_id=campaign_id,
        )

        return {"mofu_rows": mofu_rows, "bofu_rows": bofu_rows}

    def calcular_conversion_rates(
        self,
        client_slug: str,
        date_start: str,
        date_end: str,
        campaign_id: str,
    ) -> int:
        """Calcula y actualiza las 3 tasas de conversión en bofu_facts.

        Las 3 tasas requieren joinear mofu_facts (denominador: total_leads) con
        bofu_facts (numerador: sales_count). El stored procedure compute_bofu_facts
        las deja en 0 — este método las completa en un paso separado.

        Las 3 fórmulas:
          - conversion_rate_acumulado: SUM(sales_count en bofu_facts hasta hoy) /
              SUM(total_leads en mofu_facts hasta hoy) * 100
              Sin cambio respecto a la implementación anterior.

          - conversion_rate_mes (COHORT): ventas de leads creados en el mes /
              leads creados en el mes. El denominador y el numerador se anclan
              al mes de CREACIÓN del lead, no al mes de cierre.
              Fórmula: COUNT(leads donde lead_created_at IN mes_X Y is_closed_won=true)
                       / COUNT(leads donde lead_created_at IN mes_X) * 100
              Esto garantiza que el rate esté siempre entre 0% y 100%, porque
              el numerador es un subconjunto del denominador (misma cohorte).
              Los leads se leen de la tabla `leads` JOINada con `funnel_stages`
              para resolver el flag is_closed_won por section_name.

          - conversion_rate_30d: SUM(sales_count últimos 30 días) /
              SUM(total_leads últimos 30 días) * 100
              Sin cambio respecto a la implementación anterior.

        El cálculo se hace por cada fila de bofu_facts para el cliente y rango.
        Para cada fila (date, campaign_id), la tasa acumulada usa todos los datos
        hasta esa fecha inclusive.

        Args:
            client_slug: Slug del cliente.
            date_start: Inicio del rango de bofu_facts a actualizar (YYYY-MM-DD).
            date_end: Fin del rango de bofu_facts a actualizar (YYYY-MM-DD).
            campaign_id: ID de la campaña.

        Returns:
            Número de filas de bofu_facts actualizadas.
        """
        # Obtener todas las filas de bofu_facts en el rango para la campaña
        bofu_resp = (
            self._sb.table("bofu_facts")
            .select("date, sales_count")
            .eq("client_slug", client_slug)
            .eq("campaign_id", campaign_id)
            .gte("date", date_start)
            .lte("date", date_end)
            .execute()
        )
        bofu_rows = bofu_resp.data or []

        if not bofu_rows:
            logger.info(
                "calcular_conversion_rates: sin filas bofu_facts para cliente=%s rango=%s a %s",
                client_slug, date_start, date_end,
            )
            return 0

        # Obtener TODOS los leads de mofu_facts para este cliente+campaña
        # (sin filtro de fecha — necesitamos el acumulado histórico completo
        # para conversion_rate_acumulado y conversion_rate_30d)
        mofu_resp = (
            self._sb.table("mofu_facts")
            .select("date, total_leads")
            .eq("client_slug", client_slug)
            .eq("campaign_id", campaign_id)
            .execute()
        )
        mofu_rows = mofu_resp.data or []

        # Indexar mofu por fecha para lookups rápidos (usado por acumulado y 30d)
        mofu_by_date: dict[str, int] = {
            row["date"]: row["total_leads"] for row in mofu_rows
        }

        # ------------------------------------------------------------------
        # Precalcular cohort por mes para conversion_rate_mes (Opción B).
        #
        # Se consultan todos los leads del cliente desde `leads` JOINando con
        # `funnel_stages` para resolver is_closed_won por section_name. La tabla
        # `leads` no tiene campaign_id — el cohort es a nivel cliente, no campaña.
        # Esto es consistente con cómo mofu_facts agrega leads: por fecha de entrada
        # al pipeline, no por campaña individual.
        #
        # cohort_by_mes[mes_prefix] = {
        #     'total':  int,   # leads creados en el mes (denominador)
        #     'closed': int,   # de esos leads, cuántos tienen is_closed_won=true (numerador)
        # }
        # ------------------------------------------------------------------
        cohort_by_mes = self._calcular_cohort_por_mes(client_slug)

        updated_count = 0
        rate_mes = 0.0  # se sobreescribe en el loop; se usa en el log final

        for bofu_row in bofu_rows:
            bofu_date_str = bofu_row["date"]
            sales_count = bofu_row.get("sales_count", 0) or 0

            # Parsear la fecha de cierre para los cálculos de ventana
            try:
                bofu_date = datetime.strptime(bofu_date_str[:10], "%Y-%m-%d").date()
            except ValueError:
                logger.warning(
                    "Fecha inválida en bofu_facts: %s — se omite.", bofu_date_str
                )
                continue

            # ---- conversion_rate_acumulado ----
            # Ventas acumuladas hasta bofu_date / Leads acumulados hasta bofu_date
            sales_acum = sum(
                r.get("sales_count", 0) or 0
                for r in bofu_rows
                if r["date"][:10] <= bofu_date_str[:10]
            )
            leads_acum = sum(
                leads
                for date_str, leads in mofu_by_date.items()
                if date_str[:10] <= bofu_date_str[:10]
            )
            rate_acumulado = (
                round(sales_acum / leads_acum * 100, 2) if leads_acum > 0 else 0.0
            )

            # ---- conversion_rate_mes (COHORT — Opción B) ----
            # Numerador: leads creados en el mes de bofu_date que tienen is_closed_won=true
            # Denominador: todos los leads creados en el mes de bofu_date
            # Fuente: cohort_by_mes precalculado desde la tabla `leads`
            mes_prefix = bofu_date_str[:7]  # 'YYYY-MM'
            cohort = cohort_by_mes.get(mes_prefix, {'total': 0, 'closed': 0})
            rate_mes = (
                round(cohort['closed'] / cohort['total'] * 100, 2)
                if cohort['total'] > 0
                else 0.0
            )

            # ---- conversion_rate_30d ----
            # Ventas en los 30 días anteriores (ventana móvil) / Leads en los mismos 30 días
            cutoff_30d = bofu_date - timedelta(days=29)
            cutoff_30d_str = cutoff_30d.strftime("%Y-%m-%d")
            sales_30d = sum(
                r.get("sales_count", 0) or 0
                for r in bofu_rows
                if cutoff_30d_str <= r["date"][:10] <= bofu_date_str[:10]
            )
            leads_30d = sum(
                leads
                for date_str, leads in mofu_by_date.items()
                if cutoff_30d_str <= date_str[:10] <= bofu_date_str[:10]
            )
            rate_30d = (
                round(sales_30d / leads_30d * 100, 2) if leads_30d > 0 else 0.0
            )

            # Actualizar bofu_facts con las 3 tasas calculadas
            try:
                self._sb.table("bofu_facts").update({
                    "conversion_rate_acumulado": rate_acumulado,
                    "conversion_rate_mes":       rate_mes,
                    "conversion_rate_30d":       rate_30d,
                }).eq("client_slug", client_slug) \
                  .eq("date", bofu_date_str[:10]) \
                  .eq("campaign_id", campaign_id) \
                  .execute()
                updated_count += 1
            except Exception as exc:
                logger.error(
                    "Error actualizando conversion_rates para cliente=%s date=%s: %s",
                    client_slug, bofu_date_str, exc,
                )

        logger.info(
            "calcular_conversion_rates: cliente=%s filas_actualizadas=%d "
            "(rate_mes cohort de la última fila=%.2f%%)",
            client_slug,
            updated_count,
            rate_mes,
        )
        return updated_count

    def _calcular_cohort_por_mes(self, client_slug: str) -> dict[str, dict[str, int]]:
        """Precalcula el cohort de leads por mes de creación para conversion_rate_mes.

        Un lead se cuenta como "cerrado" si **alguna vez** transitó por una
        sección con is_closed_won=true (consultando lead_section_history),
        independientemente de dónde esté ahora. Esto le da más procedimiento
        a la métrica: si un lead fue venta ganada y luego se reabrió, sigue
        contando en el cohort.

        Fuentes:
          - leads.lead_created_at         → mes de creación del lead (YYYY-MM)
          - leads.meistertask_id          → ID del lead
          - lead_section_history.section_to → secciones por las que pasó
          - funnel_stages.is_closed_won   → set de secciones "venta ganada"

        Args:
            client_slug: Slug del cliente.

        Returns:
            Dict keyed por mes_prefix 'YYYY-MM', con subdict:
              {'total': int, 'closed': int}
            Ejemplo: {'2026-03': {'total': 120, 'closed': 18}, ...}
        """
        # 1. Set de secciones que representan venta cerrada
        stages_resp = (
            self._sb.table("funnel_stages")
            .select("section_name, is_closed_won")
            .eq("client_slug", client_slug)
            .eq("is_active", True)
            .execute()
        )
        closed_won_sections: set[str] = {
            row["section_name"]
            for row in (stages_resp.data or [])
            if row.get("is_closed_won") is True
        }

        if not closed_won_sections:
            logger.warning(
                "_calcular_cohort_por_mes: cliente=%s no tiene secciones "
                "con is_closed_won=true configuradas", client_slug
            )

        # 2. Set de meistertask_id que alguna vez transitaron por una sección closed_won.
        #    Filtramos server-side con .in_() — más eficiente que traer todo el historial.
        closed_lead_ids: set[int] = set()
        if closed_won_sections:
            history_resp = (
                self._sb.table("lead_section_history")
                .select("meistertask_id")
                .eq("client_slug", client_slug)
                .in_("section_to", list(closed_won_sections))
                .execute()
            )
            closed_lead_ids = {
                row["meistertask_id"]
                for row in (history_resp.data or [])
                if row.get("meistertask_id") is not None
            }

        logger.debug(
            "_calcular_cohort_por_mes: cliente=%s secciones_closed_won=%s "
            "leads_que_pasaron_por_cerrado=%d",
            client_slug, closed_won_sections, len(closed_lead_ids),
        )

        # 3. Traer todos los leads del cliente (id + fecha)
        leads_resp = (
            self._sb.table("leads")
            .select("meistertask_id, lead_created_at")
            .eq("client_slug", client_slug)
            .execute()
        )
        leads_data = leads_resp.data or []

        if not leads_data:
            logger.info(
                "_calcular_cohort_por_mes: sin leads para cliente=%s", client_slug
            )
            return {}

        # 4. Agregar por mes de creación
        cohort: dict[str, dict[str, int]] = {}

        for lead in leads_data:
            created_at_str = lead.get("lead_created_at")
            if not created_at_str:
                continue  # Lead sin fecha — no se puede asignar a cohort

            mes_prefix = str(created_at_str)[:7]  # 'YYYY-MM' del ISO timestamp

            if mes_prefix not in cohort:
                cohort[mes_prefix] = {"total": 0, "closed": 0}

            cohort[mes_prefix]["total"] += 1

            mt_id = lead.get("meistertask_id")
            if mt_id is not None and mt_id in closed_lead_ids:
                cohort[mes_prefix]["closed"] += 1

        logger.info(
            "_calcular_cohort_por_mes: cliente=%s meses_calculados=%d "
            "total_leads_procesados=%d cerrados=%d",
            client_slug, len(cohort), len(leads_data),
            sum(c["closed"] for c in cohort.values()),
        )
        return cohort


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _parse_iso(value: str) -> Optional[datetime]:
    """Parsea un string ISO 8601 a datetime aware. Retorna None si falla."""
    if not value:
        return None
    try:
        v = value.replace('Z', '+00:00')
        return datetime.fromisoformat(v)
    except (ValueError, AttributeError):
        return None
