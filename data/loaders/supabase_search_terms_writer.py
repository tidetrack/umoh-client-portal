"""
loaders/supabase_search_terms_writer.py
----------------------------------------
Escribe los términos de búsqueda extraídos de Google Ads en la tabla
`tofu_search_terms` de Supabase.

Responsabilidades:
- Recibir la lista cruda de términos que devuelve extract_client() del extractor
  (puede mezclar términos de search_term_view y/o campaign_search_term_insight).
- Construir el registro con la PK compuesta (client_slug, date, campaign_id, term).
- Hacer UPSERT idempotente: si ya existe una fila para esa PK, actualiza
  clicks, impressions y last_seen_at. Si no existe, la inserta.
- Actualizar last_seen_at en cada upsert para que se pueda detectar
  términos que desaparecieron en runs posteriores.

Schema de la tabla destino (migración 014_tofu_search_terms.sql):
    client_slug   TEXT
    date          DATE
    campaign_id   TEXT ('' para search_term_view sin campaign_id)
    campaign_name TEXT
    term          TEXT
    source        TEXT  ('search_term_view' | 'campaign_search_term_insight')
    clicks        INTEGER
    impressions   INTEGER
    import_run_id UUID
    last_seen_at  TIMESTAMPTZ

Credenciales requeridas (via connections/supabase_client.py):
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from connections.supabase_client import get_client

logger = logging.getLogger(__name__)


def _build_search_term_row(
    term_dict: dict[str, Any],
    client_slug: str,
    run_id: str,
) -> dict[str, Any]:
    """
    Construye el dict listo para upsert en tofu_search_terms.

    Mapeo de campos:
        client_slug   ← parámetro (slug del cliente, ej: 'prepagas')
        date          ← term_dict['date']          (YYYY-MM-DD)
        campaign_id   ← term_dict['campaign_id']   (str; '' para search_term_view)
        campaign_name ← term_dict['campaign_name'] (str; '' para search_term_view)
        term          ← term_dict['search_term']   (término exacto o category_label PMAX)
        source        ← term_dict['source']        ('search_term_view' o
                                                    'campaign_search_term_insight')
        clicks        ← term_dict['clicks']
        impressions   ← term_dict['impressions']
        import_run_id ← run_id
        last_seen_at  ← NOW() en UTC (se setea en cada upsert para trazabilidad)

    Args:
        term_dict: Dict de una entrada de raw_search_terms del extractor.
        client_slug: Slug del cliente (ej: 'prepagas').
        run_id: UUID string del run actual para auditoría.

    Returns:
        Dict listo para upsert en Supabase.
    """
    return {
        "client_slug":   client_slug,
        "date":          str(term_dict["date"]),
        "campaign_id":   str(term_dict.get("campaign_id") or ""),
        "campaign_name": str(term_dict.get("campaign_name") or ""),
        "term":          str(term_dict["search_term"]),
        "source":        str(term_dict.get("source") or "search_term_view"),
        "clicks":        int(term_dict.get("clicks") or 0),
        "impressions":   int(term_dict.get("impressions") or 0),
        "import_run_id": run_id,
        "last_seen_at":  datetime.now(tz=timezone.utc).isoformat(),
    }


def write_search_terms(
    raw_terms: list[dict[str, Any]],
    client_slug: str,
    run_id: str | None = None,
) -> dict[str, Any]:
    """
    Upsert de términos de búsqueda en la tabla tofu_search_terms de Supabase.

    Idempotente: si una fila con la misma PK (client_slug, date, campaign_id, term)
    ya existe, Supabase actualiza clicks, impressions, import_run_id y last_seen_at.
    Si no existe, la inserta. Esto permite re-ejecutar el pipeline sin duplicar datos.

    El upsert se hace en un único request por batch (todos los términos del cliente
    en el rango del run). Supabase PostgREST soporta arrays de dicts en upsert.

    Args:
        raw_terms: Lista de dicts de términos, salida de extract_client()['raw_search_terms'].
                   Cada dict debe tener: date, search_term, clicks, impressions, source.
                   Opcionalmente: campaign_id, campaign_name.
        client_slug: Slug del cliente (ej: 'prepagas').
        run_id: UUID string del run para auditoría. Si None, se genera uno nuevo.

    Returns:
        Dict con estadísticas: {'rows_written': int, 'client_slug': str,
        'source_counts': {'search_term_view': int, 'campaign_search_term_insight': int}}.

    Raises:
        Exception: Si el upsert a Supabase falla (se loguea y re-lanza).
    """
    if not raw_terms:
        logger.info(
            "write_search_terms: lista vacía para client_slug=%s — no hay nada que escribir.",
            client_slug,
        )
        return {
            "rows_written": 0,
            "client_slug": client_slug,
            "source_counts": {"search_term_view": 0, "campaign_search_term_insight": 0},
        }

    if run_id is None:
        run_id = str(uuid.uuid4())

    # Filtrar términos sin search_term (defensivo — no deberían llegar)
    valid_terms = [t for t in raw_terms if t.get("search_term")]
    skipped = len(raw_terms) - len(valid_terms)
    if skipped:
        logger.warning(
            "write_search_terms: %d términos sin 'search_term' descartados para client_slug=%s.",
            skipped, client_slug,
        )

    rows = [_build_search_term_row(t, client_slug, run_id) for t in valid_terms]

    # Contar por fuente para el resumen del run
    source_counts: dict[str, int] = {"search_term_view": 0, "campaign_search_term_insight": 0}
    for r in rows:
        src = r.get("source", "search_term_view")
        source_counts[src] = source_counts.get(src, 0) + 1

    logger.info(
        "Iniciando upsert en tofu_search_terms — run_id=%s client_slug=%s filas=%d "
        "(search_term_view=%d, campaign_search_term_insight=%d)",
        run_id, client_slug, len(rows),
        source_counts["search_term_view"],
        source_counts["campaign_search_term_insight"],
    )

    sb = get_client()
    try:
        response = (
            sb.table("tofu_search_terms")
            .upsert(rows, on_conflict="client_slug,date,campaign_id,term")
            .execute()
        )
    except Exception:
        logger.exception(
            "Error en upsert de tofu_search_terms — run_id=%s client_slug=%s.",
            run_id, client_slug,
        )
        raise

    rows_written = len(response.data) if response.data else 0
    logger.info(
        "Upsert completado — run_id=%s client_slug=%s filas_escritas=%d",
        run_id, client_slug, rows_written,
    )

    return {
        "rows_written": rows_written,
        "client_slug": client_slug,
        "source_counts": source_counts,
    }
