"""
extractors/google_analytics.py
-------------------------------
STUB — Extractor de tráfico desde Google Analytics 4 Data API. Fase futura.

Este archivo define la estructura del extractor y deja TODOs explícitos
en cada punto donde falta credencial, decisión de producto o implementación.
El módulo importa sin error; raise NotImplementedError en los puntos críticos.

Destino en Supabase: tabla ga_traffic_daily (migración 006_tofu.sql).
Schema de destino:
    client_slug, date, sessions, users, new_users, pageviews,
    bounce_rate, avg_session_duration_sec, conversions, conversion_rate,
    channel_breakdown, landing_pages, device_breakdown

Credenciales requeridas:
    GA_SERVICE_ACCOUNT_JSON   JSON completo de la Service Account con acceso
                              a la propiedad GA4. Puede ser la misma SA usada
                              para Google Sheets si se le agrega el rol
                              "Viewer" en la propiedad GA4.
                              Scope requerido: https://www.googleapis.com/auth/analytics.readonly

Dependencia Python a agregar en requirements.txt cuando se active:
    google-analytics-data>=0.18.0
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Conexión con GA4 Data API
# ---------------------------------------------------------------------------

def build_ga_client() -> Any:
    """
    Construye el cliente de GA4 Data API usando una Service Account.

    TODO: Implementar con la SDK oficial:
        import json
        import os
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.oauth2 import service_account

        sa_json_str = os.environ["GA_SERVICE_ACCOUNT_JSON"]
        sa_info = json.loads(sa_json_str)
        credentials = service_account.Credentials.from_service_account_info(
            sa_info,
            scopes=["https://www.googleapis.com/auth/analytics.readonly"],
        )
        return BetaAnalyticsDataClient(credentials=credentials)

    TODO: La propiedad GA4 debe otorgar acceso a la Service Account:
        GA4 → Admin → Property Access Management → Agregar SA con rol Viewer.
        El property_id tiene el formato numérico "123456789" (sin prefijo "properties/").

    Returns:
        BetaAnalyticsDataClient listo para llamar a runReport.

    Raises:
        NotImplementedError: Siempre — pendiente configuración de credenciales.
    """
    raise NotImplementedError(
        "TODO: Implementar build_ga_client() con GA_SERVICE_ACCOUNT_JSON. "
        "Ver docstring para instrucciones de acceso a la propiedad GA4."
    )


# ---------------------------------------------------------------------------
# Extracción de métricas de tráfico
# ---------------------------------------------------------------------------

def extract_ga_traffic(
    property_id: str,
    date_start: str,
    date_end: str,
) -> list[dict[str, Any]]:
    """
    Extrae métricas diarias de tráfico desde la GA4 Data API usando runReport.

    TODO: Construir el RunReportRequest con:
        from google.analytics.data_v1beta.types import (
            RunReportRequest, DateRange, Dimension, Metric
        )

        request = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=date_start, end_date=date_end)],
            dimensions=[
                Dimension(name="date"),
                Dimension(name="sessionDefaultChannelGroup"),  # canal: Organic, Paid, etc.
                Dimension(name="deviceCategory"),              # desktop, mobile, tablet
            ],
            metrics=[
                Metric(name="sessions"),
                Metric(name="totalUsers"),
                Metric(name="newUsers"),
                Metric(name="screenPageViews"),
                Metric(name="bounceRate"),               # 0-1 float, multiplicar x100
                Metric(name="averageSessionDuration"),   # segundos float → cast a int
                Metric(name="conversions"),              # requiere configurar goals en GA4
            ],
        )
        response = client.run_report(request)

    TODO: Mapeo de dimensión "date" de GA4:
        GA4 devuelve fechas en formato YYYYMMDD (sin guiones).
        Convertir a YYYY-MM-DD: datetime.strptime(val, "%Y%m%d").strftime("%Y-%m-%d")

    TODO: Mapeo de sessionDefaultChannelGroup a channel_breakdown:
        GA4 devuelve nombres en inglés: "Organic Search", "Paid Search",
        "Direct", "Organic Social", "Paid Social", "Referral", "Email", etc.
        Evaluar si mapear a nombres en español o dejar los originales.
        Sugerencia: dejar en inglés para consistencia con Meta (que también usa inglés).

    TODO: Manejo de landing pages como dimensión separada:
        Para poblar landing_pages en ga_traffic_daily, hacer una segunda llamada
        con dimensions=["date", "landingPage"] y metric sessions.
        Limitar a top 10 por día para evitar filas muy pesadas en JSONB.

    TODO: conversions requiere que estén configurados eventos de conversión en GA4.
        Si la propiedad no tiene goals configurados, el campo devuelve 0.
        Documentar al cliente que necesita configurar el evento "generate_lead"
        o equivalente como conversión en GA4.

    Args:
        property_id: ID numérico de la propiedad GA4 (ej: "123456789").
        date_start: Fecha inicio en formato YYYY-MM-DD.
        date_end: Fecha fin en formato YYYY-MM-DD.

    Returns:
        Lista de dicts con una entrada por (date, channel, device).
        Shape para el loader supabase_ga_writer (pendiente de crear):
            {date, channel, device, sessions, users, new_users, pageviews,
             bounce_rate, avg_session_duration_sec, conversions}

    Raises:
        NotImplementedError: Siempre — pendiente implementación.
    """
    raise NotImplementedError(
        "TODO: Implementar extract_ga_traffic() con GA4 Data API runReport."
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

    TODO: Implementar con:
        1. Leer client_config["ga4_property_id"] (agregar este campo al YAML del cliente).
        2. Llamar a build_ga_client() y extract_ga_traffic().
        3. Retornar dict con shape:
            {
                client_id, date_start, date_end,
                raw_traffic: [{date, channel, device, sessions, ...}],
                raw_landing_pages: [{date, landing_page, sessions}],
            }

    TODO: El YAML del cliente (clients/{slug}.yaml) necesita un nuevo campo:
        platforms:
          google_analytics:
            enabled: true
            property_id: "123456789"   # GA4 property ID numérico

    TODO: Loader para ga_traffic_daily en Supabase (archivo pendiente):
        data/loaders/supabase_ga_writer.py
        Mismo patrón que supabase_tofu_writer.py pero para ga_traffic_daily.

    Args:
        client_config: Dict con la configuración del cliente. Clave adicional
            esperada: ga4_property_id (del YAML del cliente).
        days_back: Cuántos días hacia atrás extraer (default: 7).

    Returns:
        Dict con los datos crudos de tráfico GA4 del cliente.

    Raises:
        NotImplementedError: Siempre — pendiente implementación.
    """
    raise NotImplementedError(
        "TODO: Implementar extract_client() para Google Analytics 4. "
        "Requiere agregar 'ga4_property_id' al YAML de cada cliente."
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

    TODO: Leer clientes activos con google_analytics.enabled=true desde config_dir,
        llamar a extract_client() por cada uno, retornar lista de resultados.

    Args:
        config_dir: Carpeta con los YAMLs de clientes.
        days_back: Días hacia atrás a extraer.

    Returns:
        Lista de dicts con datos crudos de tráfico GA4 por cliente.

    Raises:
        NotImplementedError: Siempre — pendiente implementación.
    """
    raise NotImplementedError(
        "TODO: Implementar run() para Google Analytics 4."
    )


# ---------------------------------------------------------------------------
# Ejecución directa (para pruebas manuales)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    # TODO: Descomentar cuando el extractor esté implementado.
    # resultados = run()
    # for r in resultados:
    #     print(f"\n=== {r['client_id']} ===")
    print("Google Analytics 4 extractor — STUB. Implementación pendiente.")
