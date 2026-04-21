"""
extractors/google_ads.py
------------------------
Extractor de datos TOFU desde Google Ads API para el pipeline UMOH.

Responsabilidades:
- Autenticarse con las credenciales del MCC de UMOH via OAuth2.
- Leer los archivos config/clients/*.yaml para iterar clientes activos.
- Por cada cliente con google_ads.enabled=true, ejecutar queries GAQL
  para extraer métricas de los últimos N dias.
- Devolver los datos crudos estructurados listos para el normalizador.

Credenciales esperadas como variables de entorno:
  GOOGLE_ADS_DEVELOPER_TOKEN
  GOOGLE_ADS_CLIENT_ID
  GOOGLE_ADS_CLIENT_SECRET
  GOOGLE_ADS_REFRESH_TOKEN
  GOOGLE_ADS_LOGIN_CUSTOMER_ID   (ID del MCC, sin guiones: 865936870)
"""

from __future__ import annotations

import os
import glob
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import yaml
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuracion de la conexion con Google Ads API
# ---------------------------------------------------------------------------

def build_google_ads_client() -> GoogleAdsClient:
    """
    Construye el cliente de Google Ads API usando credenciales de entorno.

    El login_customer_id apunta al MCC de UMOH, lo que permite operar
    como agencia administradora sobre todas las cuentas de clientes.
    """
    login_customer_id = os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"].replace("-", "")

    config = {
        "developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],
        "client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],
        "login_customer_id": login_customer_id,
        "use_proto_plus": True,
    }

    return GoogleAdsClient.load_from_dict(config)


# ---------------------------------------------------------------------------
# Lectura de configuracion de clientes
# ---------------------------------------------------------------------------

def load_active_clients(config_dir: str = "config/clients") -> list[dict[str, Any]]:
    """
    Lee todos los archivos YAML en config_dir y devuelve los clientes
    que tienen active=true y google_ads.enabled=true.

    Args:
        config_dir: Ruta relativa a la carpeta de configs de clientes.

    Returns:
        Lista de dicts con la configuracion de cada cliente elegible.
    """
    clients = []
    pattern = Path(config_dir) / "*.yaml"

    for path in sorted(glob.glob(str(pattern))):
        with open(path, "r", encoding="utf-8") as f:
            client_config = yaml.safe_load(f)

        if not client_config.get("active", False):
            logger.info("Cliente %s inactivo, se omite.", path)
            continue

        google_ads_cfg = client_config.get("platforms", {}).get("google_ads", {})
        if not google_ads_cfg.get("enabled", False):
            logger.info(
                "Cliente %s no tiene Google Ads habilitado, se omite.",
                client_config.get("client_id"),
            )
            continue

        customer_id = google_ads_cfg.get("customer_id", "").replace("-", "")
        if not customer_id or customer_id.startswith("REEMPLAZAR"):
            logger.warning(
                "Cliente %s tiene customer_id sin configurar, se omite.",
                client_config.get("client_id"),
            )
            continue

        clients.append({
            "client_id": client_config["client_id"],
            "client_name": client_config.get("client_name", ""),
            "customer_id": customer_id,
            "timezone": client_config.get("reporting", {}).get(
                "timezone", "America/Argentina/Mendoza"
            ),
            "currency": client_config.get("reporting", {}).get("currency", "ARS"),
            "sheets_output_id": client_config.get("sheets", {}).get("output_id", ""),
        })

    return clients


# ---------------------------------------------------------------------------
# Queries GAQL
# ---------------------------------------------------------------------------

_TOFU_METRICS_QUERY = """
SELECT
  segments.date,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  segments.ad_network_type,
  segments.device
FROM campaign
WHERE
  segments.date BETWEEN '{date_start}' AND '{date_end}'
  AND campaign.status = 'ENABLED'
ORDER BY segments.date ASC
"""

_SEARCH_TERMS_QUERY = """
SELECT
  segments.date,
  search_term_view.search_term,
  metrics.clicks,
  metrics.impressions
FROM search_term_view
WHERE
  segments.date BETWEEN '{date_start}' AND '{date_end}'
ORDER BY metrics.clicks DESC
LIMIT 20
"""


def _date_range(days_back: int = 7) -> tuple[str, str]:
    """Devuelve (date_start, date_end) en formato YYYY-MM-DD para los ultimos N dias."""
    today = datetime.utcnow().date()
    end = today - timedelta(days=1)       # ayer (Google Ads consolida con 1 dia de lag)
    start = end - timedelta(days=days_back - 1)
    return str(start), str(end)


# ---------------------------------------------------------------------------
# Extraccion por cliente
# ---------------------------------------------------------------------------

def extract_tofu_metrics(
    client: GoogleAdsClient,
    customer_id: str,
    date_start: str,
    date_end: str,
) -> list[dict[str, Any]]:
    """
    Extrae metricas diarias de TOFU (impresiones, clicks, gasto, canal, dispositivo)
    para el customer_id dado en el rango de fechas indicado.

    Los cost_micros de Google se convierten a la unidad monetaria real dividiendo por 1e6.
    El desglose por canal (ad_network_type) y dispositivo (device) se construye
    sumando sobre todas las campanas del dia.

    Args:
        client: GoogleAdsClient autenticado contra el MCC.
        customer_id: ID de la cuenta del cliente (sin guiones ni espacios).
        date_start: Fecha inicio en formato YYYY-MM-DD.
        date_end: Fecha fin en formato YYYY-MM-DD.

    Returns:
        Lista de dicts con una entrada por (date, platform, network_type, device).
    """
    ga_service = client.get_service("GoogleAdsService")
    query = _TOFU_METRICS_QUERY.format(date_start=date_start, date_end=date_end)

    rows = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                rows.append({
                    "date": row.segments.date,
                    "platform": "google",
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    # cost_micros: Google almacena el costo multiplicado por 1_000_000
                    "spend_micros": row.metrics.cost_micros,
                    "channel": row.segments.ad_network_type.name,
                    "device": row.segments.device.name,
                })
    except GoogleAdsException as ex:
        _log_google_ads_exception(ex, customer_id, "metricas TOFU")
        raise

    return rows


def extract_search_terms(
    client: GoogleAdsClient,
    customer_id: str,
    date_start: str,
    date_end: str,
) -> list[dict[str, Any]]:
    """
    Extrae los terminos de busqueda con mas clicks en el periodo indicado.
    Se usa para poblar el campo top_search_terms del schema TOFU.

    Args:
        client: GoogleAdsClient autenticado.
        customer_id: ID de la cuenta del cliente.
        date_start: Fecha inicio YYYY-MM-DD.
        date_end: Fecha fin YYYY-MM-DD.

    Returns:
        Lista de dicts {date, search_term, clicks, impressions} ordenada por clicks desc.
    """
    ga_service = client.get_service("GoogleAdsService")
    query = _SEARCH_TERMS_QUERY.format(date_start=date_start, date_end=date_end)

    terms = []
    try:
        response = ga_service.search_stream(customer_id=customer_id, query=query)
        for batch in response:
            for row in batch.results:
                terms.append({
                    "date": row.segments.date,
                    "search_term": row.search_term_view.search_term,
                    "clicks": row.metrics.clicks,
                    "impressions": row.metrics.impressions,
                })
    except GoogleAdsException as ex:
        # Los terminos de busqueda son opcionales: si la cuenta no tiene
        # campanas de Search activas la query puede fallar sin romper el pipeline.
        _log_google_ads_exception(ex, customer_id, "terminos de busqueda")
        logger.warning(
            "No se pudieron extraer terminos de busqueda para customer_id=%s. "
            "Se continua sin este campo.",
            customer_id,
        )

    return terms


# ---------------------------------------------------------------------------
# Funcion principal del extractor
# ---------------------------------------------------------------------------

def extract_client(
    client: GoogleAdsClient,
    client_config: dict[str, Any],
    days_back: int = 7,
) -> dict[str, Any]:
    """
    Punto de entrada por cliente. Extrae metricas TOFU y terminos de busqueda,
    y devuelve un dict con todo listo para pasar al normalizador.

    Args:
        client: GoogleAdsClient autenticado.
        client_config: Dict con {client_id, customer_id, ...} del YAML del cliente.
        days_back: Cuantos dias hacia atras extraer (default: 7).

    Returns:
        Dict con las claves:
          - client_id: str
          - customer_id: str
          - date_start: str
          - date_end: str
          - raw_metrics: list[dict]   (una fila por date+channel+device)
          - raw_search_terms: list[dict]
    """
    date_start, date_end = _date_range(days_back)
    customer_id = client_config["customer_id"]

    logger.info(
        "Extrayendo Google Ads para cliente=%s customer_id=%s rango=%s a %s",
        client_config["client_id"],
        customer_id,
        date_start,
        date_end,
    )

    metrics = extract_tofu_metrics(client, customer_id, date_start, date_end)
    terms = extract_search_terms(client, customer_id, date_start, date_end)

    logger.info(
        "Extraccion completada: %d filas de metricas, %d terminos de busqueda.",
        len(metrics),
        len(terms),
    )

    return {
        "client_id": client_config["client_id"],
        "client_name": client_config["client_name"],
        "customer_id": customer_id,
        "date_start": date_start,
        "date_end": date_end,
        "timezone": client_config["timezone"],
        "currency": client_config["currency"],
        "sheets_output_id": client_config["sheets_output_id"],
        "raw_metrics": metrics,
        "raw_search_terms": terms,
    }


def run(config_dir: str = "config/clients", days_back: int = 7) -> list[dict[str, Any]]:
    """
    Funcion de orquestacion principal. Lee todos los clientes activos,
    extrae datos de Google Ads para cada uno y devuelve los resultados crudos.

    Invocada por el workflow de GitHub Actions:
      python -c "from extractors.google_ads import run; run()"

    Args:
        config_dir: Carpeta con los YAMLs de clientes.
        days_back: Dias hacia atras a extraer.

    Returns:
        Lista de dicts con los datos crudos de cada cliente.
    """
    ads_client = build_google_ads_client()
    active_clients = load_active_clients(config_dir)

    if not active_clients:
        logger.warning("No hay clientes activos con Google Ads habilitado.")
        return []

    results = []
    for client_config in active_clients:
        try:
            result = extract_client(ads_client, client_config, days_back)
            results.append(result)
        except Exception:
            logger.exception(
                "Error extrayendo datos para cliente=%s. Se continua con el siguiente.",
                client_config.get("client_id"),
            )

    return results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log_google_ads_exception(
    ex: GoogleAdsException, customer_id: str, context: str
) -> None:
    """Loguea los errores de Google Ads API con todos los detalles utiles."""
    logger.error(
        "Google Ads API error al extraer %s para customer_id=%s. "
        "Request ID: %s. Status: %s.",
        context,
        customer_id,
        ex.request_id,
        ex.error.code().name,
    )
    for error in ex.failure.errors:
        logger.error("  Error: %s — %s", error.error_code, error.message)


# ---------------------------------------------------------------------------
# Ejecucion directa (para pruebas manuales)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    import json

    resultados = run()
    for r in resultados:
        print(f"\n=== {r['client_id']} ({r['customer_id']}) ===")
        print(f"Rango: {r['date_start']} a {r['date_end']}")
        print(f"Filas de metricas: {len(r['raw_metrics'])}")
        print(f"Terminos de busqueda: {len(r['raw_search_terms'])}")
        if r["raw_metrics"]:
            print("Primera fila:", json.dumps(r["raw_metrics"][0], indent=2))
