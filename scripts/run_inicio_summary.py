"""
scripts/run_inicio_summary.py
------------------------------
Genera el resumen heurístico de la sección "Inicio" del dashboard y lo
guarda en la tabla `ai_summaries` de Supabase.

Decisión de Franco (2026-05-07): NO usar Claude API — el resumen lo genera
un script local con reglas heurísticas, controlable y disparable manualmente
por el usuario. Sin costos de tokens.

El endpoint `/api/inicio.php` lee de `ai_summaries` en lugar de generar
el resumen on-the-fly. Este script tiene que correrse cada vez que se
quiera refrescar el resumen visible al cliente.

Uso:
    python scripts/run_inicio_summary.py --client-slug prepagas --period 30d
    python scripts/run_inicio_summary.py --client-slug prepagas --period all

Variables de entorno requeridas:
    SUPABASE_URL
    SUPABASE_SERVICE_KEY

Frecuencia recomendada: a demanda. Cuando el cliente cargue datos nuevos
desde MeisterTask y quieras que el "Hola, X" del Inicio refleje los
nuevos números, corré el script.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT / "data") not in sys.path:
    sys.path.insert(0, str(_ROOT / "data"))

from connections.supabase_client import get_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers de formato (ARS y números — mismo criterio que inicio.php)
# ---------------------------------------------------------------------------

def fmt_ars(n: float) -> str:
    """Formato moneda ARS sin decimales: $1.240.500."""
    n = round(n)
    return "$" + f"{n:,.0f}".replace(",", ".")


def fmt_num(n: int | float) -> str:
    """Formato número con separador de miles."""
    return f"{int(n):,}".replace(",", ".")


# ---------------------------------------------------------------------------
# Resolver rango de fechas según período
# ---------------------------------------------------------------------------

def period_to_dates(period: str, supabase, client_slug: str) -> tuple[str, str]:
    """Calcula [start, end] según el período, usando como referencia la última
    fecha disponible en tofu_facts."""
    if period.startswith("all"):
        first = supabase.table("tofu_facts").select("date") \
            .eq("client_slug", client_slug).order("date", desc=False).limit(1).execute()
        last = supabase.table("tofu_facts").select("date") \
            .eq("client_slug", client_slug).order("date", desc=True).limit(1).execute()
        if not first.data or not last.data:
            return ("2026-01-01", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        return (first.data[0]["date"], last.data[0]["date"])

    last_resp = supabase.table("tofu_facts").select("date") \
        .eq("client_slug", client_slug).order("date", desc=True).limit(1).execute()
    end = last_resp.data[0]["date"] if last_resp.data else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    days_back_map = {"7d": 6, "30d": 29, "90d": 89}
    days = days_back_map.get(period, 29)
    end_dt = datetime.fromisoformat(end)
    start_dt = end_dt - __import__("datetime").timedelta(days=days)
    return (start_dt.strftime("%Y-%m-%d"), end)


# ---------------------------------------------------------------------------
# Agregar métricas del período desde las facts tables
# ---------------------------------------------------------------------------

def aggregate_period(supabase, client_slug: str, start: str, end: str) -> dict:
    """Lee las 3 facts tables y devuelve totales del período."""
    tofu_rows = supabase.table("tofu_facts") \
        .select("impressions,clicks,spend") \
        .eq("client_slug", client_slug) \
        .gte("date", start).lte("date", end).execute().data or []

    impressions = sum(int(r.get("impressions") or 0) for r in tofu_rows)
    clicks      = sum(int(r.get("clicks") or 0) for r in tofu_rows)
    spend       = sum(float(r.get("spend") or 0) for r in tofu_rows)

    mofu_rows = supabase.table("mofu_facts") \
        .select("total_leads,closed_won_leads") \
        .eq("client_slug", client_slug) \
        .gte("date", start).lte("date", end).execute().data or []

    total_leads      = sum(int(r.get("total_leads") or 0) for r in mofu_rows)
    closed_won_leads = sum(int(r.get("closed_won_leads") or 0) for r in mofu_rows)

    bofu_rows = supabase.table("bofu_facts") \
        .select("sales_count,revenue,avg_ticket,conversion_rate_mes") \
        .eq("client_slug", client_slug) \
        .gte("date", start).lte("date", end).execute().data or []

    closed_sales = sum(int(r.get("sales_count") or 0) for r in bofu_rows)
    revenue      = sum(float(r.get("revenue") or 0) for r in bofu_rows)
    avg_ticket   = revenue / closed_sales if closed_sales > 0 else 0
    conv_rate    = (sum(float(r.get("conversion_rate_mes") or 0) for r in bofu_rows) /
                    len(bofu_rows)) if bofu_rows else 0

    cpl = spend / total_leads if total_leads > 0 else 0
    ctr = (clicks / impressions * 100) if impressions > 0 else 0
    roi = ((revenue - spend) / spend * 100) if spend > 0 else 0

    return {
        "impressions": impressions, "clicks": clicks, "spend": spend,
        "total_leads": total_leads, "closed_won_leads": closed_won_leads,
        "closed_sales": closed_sales, "revenue": revenue,
        "avg_ticket": avg_ticket, "conversion_rate": conv_rate,
        "cpl": cpl, "ctr": ctr, "roi": roi,
    }


# ---------------------------------------------------------------------------
# Generar headline / highlights / recommendation con heurísticas
# (mismas reglas que inicio.php — porteadas a Python para consistencia)
# ---------------------------------------------------------------------------

def build_summary(m: dict) -> dict:
    rev          = m["revenue"]
    sales        = m["closed_sales"]
    leads        = m["total_leads"]
    spend        = m["spend"]
    impressions  = m["impressions"]
    avg_ticket   = m["avg_ticket"]
    conv_rate    = m["conversion_rate"]
    ctr          = m["ctr"]
    roi_ratio    = (rev / spend) if spend > 0 else 0
    cpl          = m["cpl"]

    # Headline
    if rev > 0 and sales > 0:
        headline = (f"El período generó {fmt_ars(rev)} en ingresos con {sales} "
                    f"ventas cerradas, a un ticket promedio de {fmt_ars(avg_ticket)}.")
    elif leads > 0:
        headline = (f"El período capturó {leads} leads de campaña con "
                    f"{fmt_ars(spend)} de inversión publicitaria.")
    elif impressions > 0:
        headline = (f"El período alcanzó {fmt_num(impressions)} impresiones "
                    f"con un CTR de {ctr:.2f}% en Google Ads.")
    else:
        headline = ("Sin datos suficientes para este período. Verificá que el "
                    "pipeline de extracción esté corriendo.")

    # Highlights
    highlights: list[str] = []
    if impressions > 0:
        highlights.append(f"{fmt_num(impressions)} impresiones registradas — "
                          f"CTR de {ctr:.2f}% (industria aseguradora: 3–6%).")
    if leads > 0 and cpl > 0:
        highlights.append(f"{leads} leads captados a un costo por lead de {fmt_ars(cpl)}.")
    if sales > 0 and conv_rate > 0:
        highlights.append(f"Tasa de conversión de {conv_rate:.1f}% — "
                          f"{sales} ventas cerradas de {leads} leads.")
    if roi_ratio > 1:
        highlights.append(f"ROI positivo de {roi_ratio:.1f}x: cada peso invertido "
                          f"generó {roi_ratio:.1f} pesos en ingresos.")
    elif rev == 0 and spend > 0:
        highlights.append(f"Inversión de {fmt_ars(spend)} activa en el período "
                          f"sin ingresos registrados aún.")
    if not highlights:
        highlights = [
            "Los datos del período se están procesando o el pipeline no ha corrido aún.",
            "Verificá el estado del extractor en GitHub Actions.",
        ]

    # Recomendación
    if ctr < 2 and impressions > 5000:
        recommendation = ("El CTR está por debajo del benchmark de la industria (3–6%). "
                          "Revisá el copy de los anuncios y la relevancia de las palabras "
                          "clave para mejorar la tasa de clicks.")
    elif leads > 0 and conv_rate < 5:
        recommendation = ("La tasa de conversión de leads a ventas está baja. El equipo "
                          "comercial debería revisar la velocidad de contacto y la calidad "
                          "de los leads que ingresan al CRM.")
    elif leads == 0 and impressions > 0:
        recommendation = ("Hay tráfico pero sin leads. Revisá el formulario de contacto y "
                          "la landing page — puede haber un problema de UX que está "
                          "impidiendo que los visitantes conviertan.")
    elif roi_ratio > 2:
        recommendation = ("El ROI está en terreno muy positivo. Este es el momento ideal "
                          "para escalar presupuesto en las campañas con mejor CPC y "
                          "mantener el mix de palabras clave ganador.")
    else:
        recommendation = ("Revisá los datos del período anterior para identificar "
                          "variaciones significativas. Un análisis semanal del CPL y la "
                          "tasa de tipificación puede revelar oportunidades de optimización.")

    return {
        "headline": headline,
        "highlights": highlights,
        "recommendation": recommendation,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Genera el resumen heurístico de la sección Inicio y lo "
                    "guarda en ai_summaries (Supabase)."
    )
    parser.add_argument("--client-slug", default="prepagas",
                        help="Slug del cliente (default: prepagas)")
    parser.add_argument("--period", default="30d",
                        choices=["7d", "30d", "90d", "all"],
                        help="Período del resumen (default: 30d)")
    parser.add_argument("--print-only", action="store_true",
                        help="Solo imprimir el resumen, no guardar en Supabase")
    args = parser.parse_args()

    supabase = get_client()
    logger.info("Generando resumen — cliente=%s período=%s",
                args.client_slug, args.period)

    start, end = period_to_dates(args.period, supabase, args.client_slug)
    logger.info("Rango de fechas: %s → %s", start, end)

    metrics = aggregate_period(supabase, args.client_slug, start, end)
    logger.info("Métricas agregadas: revenue=%s sales=%d leads=%d impr=%d",
                fmt_ars(metrics["revenue"]), metrics["closed_sales"],
                metrics["total_leads"], metrics["impressions"])

    summary = build_summary(metrics)

    print("\n=== RESUMEN GENERADO ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False))

    if args.print_only:
        logger.info("--print-only activo: no se guarda en ai_summaries.")
        return

    # UPSERT en ai_summaries
    payload = {
        "client_slug":    args.client_slug,
        "period":         args.period,
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "generated_by":   "heuristic",
        "headline":       summary["headline"],
        "highlights":     summary["highlights"],
        "recommendation": summary["recommendation"],
    }

    try:
        supabase.table("ai_summaries").upsert(
            payload, on_conflict="client_slug,period"
        ).execute()
        logger.info("Resumen guardado en ai_summaries (cliente=%s, período=%s).",
                    args.client_slug, args.period)
    except Exception as exc:
        logger.error("Error guardando en ai_summaries: %s", exc, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
