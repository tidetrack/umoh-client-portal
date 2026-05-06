"""
normalizers/canonical.py
------------------------
Transforma datos crudos de cualquier plataforma al schema canónico TOFU de UMOH.

El schema canónico es el contrato entre los extractores y el loader.
Ningun extractor escribe directamente en Sheets: todo pasa por aqui primero.

Schema TOFU canónico (una fila por dia por plataforma):
  date               str        YYYY-MM-DD
  platform           str        google | meta | linkedin
  impressions        int        Total de impresiones del dia
  clicks             int        Total de clicks del dia
  spend              float      Gasto total del dia (en la moneda del cliente)
  cpc                float      Costo por click = spend / clicks (0 si clicks == 0)
  top_search_terms   str        JSON array de los top terminos: [{term, clicks}]
  channel_breakdown  str        JSON dict: {canal: {clicks, impressions}}
  device_breakdown   str        JSON dict: {dispositivo: {clicks, impressions}}
  geo_breakdown      str        JSON dict: {ciudad: {clicks, impressions}}
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import Any

import pandas as pd

logger = logging.getLogger(__name__)

# Conversion de cost_micros (Google) a unidad real
_MICROS = 1_000_000

# Mapeo de nombres de red de Google Ads al nombre legible para el dashboard.
# Los enums cambiaron entre versiones de la API; mantener compat para v17 (legacy)
# y v21+ (actual). Si llega un nombre no mapeado, se usa el raw como label.
_NETWORK_TYPE_MAP = {
    "SEARCH":          "Search",
    "SEARCH_PARTNERS": "Search Partners",
    "CONTENT":         "Display",
    "YOUTUBE":         "YouTube",
    "YOUTUBE_WATCH":   "YouTube",
    "YOUTUBE_SEARCH":  "YouTube Search",
    "DISCOVER":        "Discover",
    "GOOGLE_TV":       "Google TV",
    "MIXED":           "Mixed",
    "UNKNOWN":         "Unknown",
    "UNSPECIFIED":     "Unspecified",
}

# Mapeo de nombres de dispositivo de Google Ads al nombre legible
_DEVICE_MAP = {
    "MOBILE": "Mobile",
    "DESKTOP": "Desktop",
    "TABLET": "Tablet",
    "CONNECTED_TV": "Connected TV",
    "UNKNOWN": "Unknown",
    "UNSPECIFIED": "Unspecified",
}


def normalize_google_ads(raw_data: dict[str, Any]) -> pd.DataFrame:
    """
    Normaliza la salida cruda de extractors/google_ads.py al schema TOFU canónico.

    Cada fila de raw_metrics tiene un nivel de granularidad (date, channel, device).
    Este normalizador las agrega por dia para producir una sola fila por fecha,
    con los desgloses de canal y dispositivo serializados como JSON en su columna.

    Args:
        raw_data: Dict retornado por extractors.google_ads.extract_client(), con claves:
                  client_id, customer_id, date_start, date_end, raw_metrics,
                  raw_search_terms, timezone, currency.

    Returns:
        DataFrame con el schema TOFU canónico, una fila por fecha.
        Incluye ademas las columnas client_id y platform para el loader.
    """
    raw_metrics: list[dict] = raw_data.get("raw_metrics", [])
    raw_terms: list[dict] = raw_data.get("raw_search_terms", [])
    raw_geo: list[dict] = raw_data.get("raw_geo", [])

    if not raw_metrics:
        logger.warning(
            "No hay raw_metrics para client_id=%s. Se retorna DataFrame vacio.",
            raw_data.get("client_id"),
        )
        return _empty_tofu_dataframe()

    # Paso 1: Agregar metricas base por dia
    # (cada fila cruda es date+channel+device; las sumamos por dia).
    # channel_counts/device_counts/geo_counts ahora guardan {clicks, impressions}
    # por label, no solo el total — el frontend usa clicks para ponderar charts.
    def _zero_metrics() -> dict[str, int]:
        return {"clicks": 0, "impressions": 0}

    daily: dict[str, dict] = defaultdict(lambda: {
        "impressions": 0,
        "clicks": 0,
        "spend_micros": 0,
        "channel_counts": defaultdict(_zero_metrics),
        "device_counts":  defaultdict(_zero_metrics),
        "geo_counts":     defaultdict(_zero_metrics),
    })

    for row in raw_metrics:
        date = row["date"]
        impressions = row.get("impressions", 0)
        clicks = row.get("clicks", 0)
        daily[date]["impressions"] += impressions
        daily[date]["clicks"] += clicks
        daily[date]["spend_micros"] += row.get("spend_micros", 0)

        channel_raw = row.get("channel", "UNKNOWN")
        channel_label = _NETWORK_TYPE_MAP.get(channel_raw, channel_raw)
        daily[date]["channel_counts"][channel_label]["clicks"] += clicks
        daily[date]["channel_counts"][channel_label]["impressions"] += impressions

        device_raw = row.get("device", "UNKNOWN")
        device_label = _DEVICE_MAP.get(device_raw, device_raw)
        daily[date]["device_counts"][device_label]["clicks"] += clicks
        daily[date]["device_counts"][device_label]["impressions"] += impressions

    # Geo viene en una lista separada — granularidad date+city, sin canal/dispositivo.
    for geo_row in raw_geo:
        date = geo_row.get("date", "")
        city = (geo_row.get("city_name") or "").strip()
        if not date or not city:
            continue
        daily[date]["geo_counts"][city]["clicks"] += geo_row.get("clicks", 0)
        daily[date]["geo_counts"][city]["impressions"] += geo_row.get("impressions", 0)

    # Paso 2: Agregar top search terms por dia
    # Acumulamos clicks por termino, luego nos quedamos con los top 10 por dia
    terms_by_date: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for term_row in raw_terms:
        date = term_row.get("date", "")
        term = term_row.get("search_term", "")
        clicks = term_row.get("clicks", 0)
        if date and term:
            terms_by_date[date][term] += clicks

    # Paso 3: Construir el DataFrame final
    records = []
    for date in sorted(daily.keys()):
        d = daily[date]
        spend = d["spend_micros"] / _MICROS
        clicks = d["clicks"]
        cpc = round(spend / clicks, 4) if clicks > 0 else 0.0

        # Top 10 terminos del dia ordenados por clicks desc
        top_terms = sorted(
            terms_by_date.get(date, {}).items(),
            key=lambda x: x[1],
            reverse=True,
        )[:10]
        top_terms_json = json.dumps(
            [{"term": t, "clicks": c} for t, c in top_terms],
            ensure_ascii=False,
        )

        # Convertir defaultdict anidado a dict normal antes de json.dumps
        channel_breakdown_json = json.dumps(
            {k: dict(v) for k, v in d["channel_counts"].items()},
            ensure_ascii=False,
        )
        device_breakdown_json = json.dumps(
            {k: dict(v) for k, v in d["device_counts"].items()},
            ensure_ascii=False,
        )
        geo_breakdown_json = json.dumps(
            {k: dict(v) for k, v in d["geo_counts"].items()},
            ensure_ascii=False,
        )

        records.append({
            "date": date,
            "platform": "google",
            "impressions": d["impressions"],
            "clicks": clicks,
            "spend": round(spend, 2),
            "cpc": cpc,
            "top_search_terms": top_terms_json,
            "channel_breakdown": channel_breakdown_json,
            "device_breakdown": device_breakdown_json,
            "geo_breakdown": geo_breakdown_json,
            # Metadatos para el loader (no van al schema canónico de Sheets
            # pero son necesarios para saber a qué Sheet y pestaña escribir)
            "client_id": raw_data.get("client_id"),
            "sheets_output_id": raw_data.get("sheets_output_id"),
        })

    df = pd.DataFrame(records)
    logger.info(
        "Normalizacion completada para client_id=%s: %d filas TOFU (%s a %s).",
        raw_data.get("client_id"),
        len(df),
        raw_data.get("date_start"),
        raw_data.get("date_end"),
    )
    return df


def normalize(raw_data: dict[str, Any]) -> pd.DataFrame:
    """
    Dispatcher: detecta la plataforma y llama al normalizador correspondiente.

    Actualmente soporta: google.
    Meta y LinkedIn se agregan en Fases 2 y 3.

    Args:
        raw_data: Dict retornado por cualquier extractor. Debe incluir
                  una clave 'platform' o 'raw_metrics[0].platform'.

    Returns:
        DataFrame con el schema TOFU canónico.

    Raises:
        ValueError: Si la plataforma no está soportada.
    """
    # Infiere la plataforma desde los datos crudos
    platform = raw_data.get("platform")
    if not platform and raw_data.get("raw_metrics"):
        platform = raw_data["raw_metrics"][0].get("platform", "")

    # Google Ads
    if platform == "google" or "customer_id" in raw_data:
        return normalize_google_ads(raw_data)

    # Meta (Fase 3 — placeholder para cuando se implemente el extractor)
    if platform == "meta":
        raise NotImplementedError(
            "Normalizador Meta no implementado aun. Disponible en Fase 3."
        )

    # LinkedIn (Fase 4 — placeholder)
    if platform == "linkedin":
        raise NotImplementedError(
            "Normalizador LinkedIn no implementado aun. Disponible en Fase 4."
        )

    raise ValueError(
        f"Plataforma no reconocida: '{platform}'. "
        f"Plataformas soportadas: google, meta (Fase 3), linkedin (Fase 4)."
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_tofu_dataframe() -> pd.DataFrame:
    """Retorna un DataFrame vacio con el schema TOFU canónico."""
    return pd.DataFrame(columns=[
        "date",
        "platform",
        "impressions",
        "clicks",
        "spend",
        "cpc",
        "top_search_terms",
        "channel_breakdown",
        "device_breakdown",
        "geo_breakdown",
        "client_id",
        "sheets_output_id",
    ])
