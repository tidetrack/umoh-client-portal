"""
loaders/supabase_tofu_writer.py
-------------------------------
Escribe el DataFrame canónico TOFU a la tabla tofu_ads_daily de Supabase.

Responsabilidades:
- Recibir un DataFrame con el schema TOFU canónico (output de normalizers/canonical.py).
- Mapear client_id → client_slug (mismo valor, distinto nombre de columna).
- Calcular CTR (clicks / impressions * 100) si impressions > 0.
- Deserializar los campos JSON string que vienen del normalizador (top_search_terms,
  channel_breakdown, device_breakdown) a dict/list para que Supabase los almacene
  como JSONB nativo.
- Hacer UPSERT con on_conflict sobre (client_slug, date, platform) — garantiza
  idempotencia en re-ejecuciones y cubre el lag de consolidación de plataformas.

Credenciales requeridas (via data/connections/supabase_client.py):
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

import pandas as pd

from connections.supabase_client import get_client

logger = logging.getLogger(__name__)

# Columnas del schema canónico que consume este loader.
# Las columnas adicionales del DF (sheets_output_id) se ignoran.
_CANONICAL_COLS = [
    "date",
    "platform",
    "impressions",
    "clicks",
    "spend",
    "cpc",
    "top_search_terms",
    "channel_breakdown",
    "device_breakdown",
    "client_id",
]


def _parse_json_field(value: Any) -> Any:
    """
    Deserializa un campo que puede llegar como JSON string o ya como dict/list.

    El normalizador canónico serializa top_search_terms, channel_breakdown y
    device_breakdown como JSON strings. Supabase espera dict/list para columnas
    JSONB — si se pasa un string, lo almacena como TEXT, no como JSONB indexable.

    Args:
        value: Valor que puede ser str (JSON), dict, list o None.

    Returns:
        dict, list o None.
    """
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            logger.warning("No se pudo parsear JSON field: %r — se pasa None.", value[:80])
            return None
    return None


def _build_row(row: pd.Series, run_id: str) -> dict[str, Any]:
    """
    Construye el dict listo para insertar en tofu_ads_daily a partir de una
    fila del DataFrame canónico.

    Mapeo de campos:
        client_slug      <- row['client_id']       (rename: convención Supabase)
        date             <- row['date']             (YYYY-MM-DD str → Supabase lo acepta)
        platform         <- row['platform']         ('google' | 'meta' | 'linkedin')
        impressions      <- row['impressions']
        clicks           <- row['clicks']
        spend            <- row['spend']            (ya en unidad monetaria real)
        cpc              <- row['cpc']              (calculado en el normalizador)
        ctr              <- clicks/impressions*100 si impressions > 0, else 0
        top_search_terms <- json.loads(row['top_search_terms'])
        channel_breakdown<- json.loads(row['channel_breakdown'])
        device_breakdown <- json.loads(row['device_breakdown'])
        import_run_id    <- run_id (UUID del run actual)
        last_imported_at <- NOW() (lo pone Supabase por DEFAULT, no lo enviamos)

    Args:
        row: Fila del DataFrame canónico.
        run_id: UUID string del run actual, para auditoría.

    Returns:
        Dict listo para upsert en Supabase.
    """
    impressions = int(row.get("impressions", 0) or 0)
    clicks = int(row.get("clicks", 0) or 0)
    ctr = round(clicks / impressions * 100, 4) if impressions > 0 else 0.0

    return {
        "client_slug": row["client_id"],
        "date": str(row["date"]),
        "platform": str(row["platform"]),
        "impressions": impressions,
        "clicks": clicks,
        "spend": float(row.get("spend", 0) or 0),
        "cpc": float(row.get("cpc", 0) or 0),
        "ctr": ctr,
        "top_search_terms": _parse_json_field(row.get("top_search_terms")),
        "channel_breakdown": _parse_json_field(row.get("channel_breakdown")),
        "device_breakdown": _parse_json_field(row.get("device_breakdown")),
        "import_run_id": run_id,
    }


def write_tofu_ads(
    df: pd.DataFrame,
    run_id: str | None = None,
) -> dict[str, Any]:
    """
    Upsert del DataFrame canónico TOFU a la tabla tofu_ads_daily de Supabase.

    Cada fila del DF se mapea así:
        client_slug       = row['client_id']
        date              = row['date']                       # ya viene YYYY-MM-DD
        platform          = row['platform']                   # 'google' | 'meta' | 'linkedin'
        impressions       = row['impressions']
        clicks            = row['clicks']
        spend             = row['spend']
        cpc               = row['cpc']
        ctr               = clicks/impressions*100 si impressions>0 else 0
        top_search_terms  = json.loads(row['top_search_terms'])   # JSON string → dict en JSONB
        channel_breakdown = json.loads(row['channel_breakdown'])
        device_breakdown  = json.loads(row['device_breakdown'])

    UPSERT con on_conflict='client_slug,date,platform'.
    Devuelve {'rows_written': N, 'clients': [...], 'platforms': [...]}.

    Args:
        df: DataFrame con el schema TOFU canónico (columna client_id requerida).
        run_id: UUID string para tracking del run. Si None, se genera uno nuevo.

    Returns:
        Dict con estadísticas del upsert: rows_written, clients, platforms.

    Raises:
        ValueError: Si el DataFrame está vacío o le falta la columna client_id.
        Exception: Si el upsert a Supabase falla (se re-lanza con logging del error).
    """
    if df.empty:
        logger.warning("DataFrame vacío recibido en write_tofu_ads. No hay nada que escribir.")
        return {"rows_written": 0, "clients": [], "platforms": []}

    if "client_id" not in df.columns:
        raise ValueError(
            "El DataFrame no tiene la columna 'client_id'. "
            "Verificar que el normalizador la esté incluyendo."
        )

    if run_id is None:
        run_id = str(uuid.uuid4())

    logger.info(
        "Iniciando upsert a tofu_ads_daily — run_id=%s, filas=%d",
        run_id,
        len(df),
    )

    rows = [_build_row(row, run_id) for _, row in df.iterrows()]

    sb = get_client()
    try:
        response = (
            sb.table("tofu_ads_daily")
            .upsert(rows, on_conflict="client_slug,date,platform")
            .execute()
        )
    except Exception:
        logger.exception(
            "Error al hacer upsert en tofu_ads_daily para run_id=%s.",
            run_id,
        )
        raise

    rows_written = len(response.data) if response.data else 0
    clients_written = sorted(df["client_id"].unique().tolist())
    platforms_written = sorted(df["platform"].unique().tolist())

    logger.info(
        "Upsert completado — run_id=%s, filas=%d, clientes=%s, plataformas=%s",
        run_id,
        rows_written,
        clients_written,
        platforms_written,
    )

    return {
        "rows_written": rows_written,
        "clients": clients_written,
        "platforms": platforms_written,
    }
