"""
extractors/meta_ads.py
----------------------
STUB — Extractor TOFU desde Meta Marketing API. Fase 3.

Este archivo define la estructura del extractor y deja TODOs explícitos
en cada punto donde falta credencial, decisión de producto o implementación.
El módulo importa sin error; raise NotImplementedError en los puntos críticos.

Credenciales requeridas (Fase 3):
    META_SYSTEM_USER_TOKEN   Token permanente del System User en Business Manager.
                             Se genera en: Business Manager → System Users → Generate Token.
                             Scopes mínimos: ads_read, ads_management.

Dependencia Python a agregar en requirements.txt cuando se active:
    facebook-business>=19.0.0
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Conexión con Meta Marketing API
# ---------------------------------------------------------------------------

def build_meta_client() -> Any:
    """
    Construye el cliente de Meta Marketing API usando el System User Token.

    TODO (Fase 3): Implementar con la SDK oficial de Meta:
        from facebook_business.api import FacebookAdsApi
        import os

        token = os.environ["META_SYSTEM_USER_TOKEN"]
        FacebookAdsApi.init(access_token=token)
        # FacebookAdsApi.init devuelve la instancia global que usan AdAccount, etc.
        # No hay un objeto "client" explícito como en Google Ads — la API
        # se usa directamente desde AdAccount(f"act_{account_id}").

    TODO (Fase 3): Agregar validación del token antes de operar:
        from facebook_business.adobjects.adaccount import AdAccount
        me = AdAccount("act_{account_id}").api_get(fields=["account_id"])
        # Si el token expiró o no tiene permisos, lanza FacebookRequestError.

    Returns:
        La instancia de FacebookAdsApi inicializada.

    Raises:
        NotImplementedError: Siempre — pendiente Fase 3.
    """
    raise NotImplementedError(
        "TODO: Fase 3 — Implementar build_meta_client() con META_SYSTEM_USER_TOKEN. "
        "Ver docstring para instrucciones."
    )


# ---------------------------------------------------------------------------
# Extracción de métricas TOFU
# ---------------------------------------------------------------------------

def extract_tofu_metrics(
    account_id: str,
    since: str,
    until: str,
) -> list[dict[str, Any]]:
    """
    Extrae métricas diarias TOFU desde el endpoint /insights de Meta Marketing API.

    TODO (Fase 3): Llamar al endpoint GET /{ad_account_id}/insights con:
        params = {
            "level": "account",           # Agregar a nivel de cuenta, no campaña
            "time_increment": 1,          # Una fila por día
            "time_range": {"since": since, "until": until},
            "fields": [
                "date_start",
                "impressions",
                "clicks",              # link_clicks — verificar diferencia con all clicks
                "spend",
                "cpc",
            ],
            "breakdowns": ["publisher_platform", "device_platform"],
        }

    TODO (Fase 3): El endpoint devuelve paginación cursored — iterar con
        result.load_next_page() hasta que no haya más páginas.

    TODO (Fase 3): Mapear publisher_platform a los valores del schema canónico:
        Meta devuelve: facebook, instagram, audience_network, messenger
        En channel_breakdown usar los nombres tal cual — son reconocibles.

    TODO (Fase 3): Mapear device_platform:
        Meta devuelve: mobile_app, desktop, mobile_web
        Normalizar a: Mobile, Desktop (colapsar mobile_app + mobile_web)

    TODO (Fase 3): spend en Meta ya viene en unidad real (USD/ARS según cuenta)
        — NO dividir por 1_000_000 como en Google Ads.

    Args:
        account_id: ID de la cuenta de Meta (con o sin prefijo "act_").
        since: Fecha inicio en formato YYYY-MM-DD.
        until: Fecha fin en formato YYYY-MM-DD.

    Returns:
        Lista de dicts con una entrada por (date, publisher_platform, device_platform).
        Shape idéntico al output de google_ads.extract_tofu_metrics() para que
        el normalizador canónico pueda procesarlo con normalize_meta().

    Raises:
        NotImplementedError: Siempre — pendiente Fase 3.
    """
    raise NotImplementedError(
        "TODO: Fase 3 — Implementar extract_tofu_metrics() con Meta Insights API."
    )


def extract_search_terms(
    account_id: str,
    since: str,
    until: str,
) -> list[dict[str, Any]]:
    """
    Meta no tiene un equivalente directo a search terms de Google.

    TODO (Fase 3, opcional): Evaluar si se extraen top ad creatives/copy como
        sustituto del campo top_search_terms en el schema TOFU canónico.
        Endpoint candidato: /{ad_account_id}/ads con breakdown por creative.
        Si se decide no implementar, retornar [] y dejar top_search_terms vacío.

    Returns:
        Lista vacía — Meta no expone search terms en su API de insights.

    Raises:
        NotImplementedError: Siempre — pendiente decisión de producto en Fase 3.
    """
    raise NotImplementedError(
        "TODO: Fase 3 — Decidir si se extraen top creatives como sustituto "
        "de search terms para Meta. Por ahora retornar [] es válido."
    )


# ---------------------------------------------------------------------------
# Punto de entrada por cliente
# ---------------------------------------------------------------------------

def extract_client(
    client_config: dict[str, Any],
    days_back: int = 7,
) -> dict[str, Any]:
    """
    Punto de entrada por cliente. Misma firma que google_ads.extract_client()
    para que el orquestador pueda iterar ambos extractores uniformemente.

    TODO (Fase 3): Implementar llamando a build_meta_client() y extract_tofu_metrics().
        El dict retornado debe tener las claves:
          client_id, client_name, date_start, date_end, timezone, currency,
          sheets_output_id, raw_metrics, raw_search_terms
        con raw_metrics teniendo shape: [{date, platform, impressions, clicks,
          spend, channel, device}, ...]
        donde platform="meta" en todas las filas.

    Args:
        client_config: Dict con la configuración del cliente. Claves esperadas:
            client_id, client_name, meta_account_id (de platforms.meta.ad_account_id
            en el YAML), timezone, currency, sheets_output_id.
        days_back: Cuántos días hacia atrás extraer (default: 7).

    Returns:
        Dict con los datos crudos listos para normalize() del normalizer canónico.

    Raises:
        NotImplementedError: Siempre — pendiente Fase 3.
    """
    raise NotImplementedError(
        "TODO: Fase 3 — Implementar extract_client() para Meta Ads. "
        "Ver docstring para el contrato del dict de retorno."
    )


# ---------------------------------------------------------------------------
# Función de orquestación
# ---------------------------------------------------------------------------

def run(
    config_dir: str = "clients",
    days_back: int = 7,
) -> list[dict[str, Any]]:
    """
    Función de orquestación principal. Misma firma que google_ads.run().

    TODO (Fase 3): Leer clientes activos con meta.enabled=true desde config_dir,
        llamar a extract_client() por cada uno y retornar la lista de resultados.
        Mismo patrón que google_ads.run(): capturar excepciones por cliente
        y continuar con el siguiente.

    Args:
        config_dir: Carpeta con los YAMLs de clientes (debe ser 'clients/', no
                    'config/clients/' — ver nota de inconsistencia en run_tofu_pipeline.py).
        days_back: Días hacia atrás a extraer.

    Returns:
        Lista de dicts con datos crudos de cada cliente Meta activo.

    Raises:
        NotImplementedError: Siempre — pendiente Fase 3.
    """
    raise NotImplementedError(
        "TODO: Fase 3 — Implementar run() para Meta Ads."
    )


# ---------------------------------------------------------------------------
# Ejecución directa (para pruebas manuales — activar en Fase 3)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    # TODO (Fase 3): Descomentar y ajustar cuando el extractor esté implementado.
    # import json
    # resultados = run()
    # for r in resultados:
    #     print(f"\n=== {r['client_id']} ===")
    #     print(f"Rango: {r['date_start']} a {r['date_end']}")
    #     print(f"Filas de métricas: {len(r['raw_metrics'])}")
    print("Meta Ads extractor — STUB. Implementación pendiente en Fase 3.")
