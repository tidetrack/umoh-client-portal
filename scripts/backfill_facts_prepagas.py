"""
scripts/backfill_facts_prepagas.py
------------------------------------
Script one-time para poblar tofu_facts, mofu_facts y bofu_facts con
todos los datos históricos de Prevención Salud disponibles en Supabase.

Cuándo ejecutar:
    Una sola vez, después de aplicar la migración 010_tofu_ads_daily_campaign_id.sql
    y después de que run_tofu_pipeline.py y run_meistertask_pipeline.py hayan
    importado todos los datos históricos disponibles en las tablas crudas.

Qué hace:
    1. Llama a compute_tofu_facts para todo el rango histórico.
    2. Llama a compute_mofu_facts para todo el rango histórico.
    3. Llama a compute_bofu_facts para todo el rango histórico.
    4. Llama a calcular_conversion_rates para actualizar las 3 tasas en bofu_facts.

    Todos los stored procedures son idempotentes. Re-ejecutar este script
    no corrompe datos — sobreescribe los valores con los correctos.

Variables de entorno requeridas:
    SUPABASE_URL
    SUPABASE_SERVICE_KEY

Uso:
    python scripts/backfill_facts_prepagas.py [--date-start YYYY-MM-DD] [--date-end YYYY-MM-DD]

    Por defecto usa 2026-01-01 hasta hoy. Ajustar --date-start al primer día
    con datos reales en tofu_ads_daily / leads.

Ejemplo:
    python scripts/backfill_facts_prepagas.py --date-start 2026-01-01 --date-end 2026-05-05
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date as _date
from pathlib import Path

from dotenv import load_dotenv

# Resolver imports del directorio data/ independientemente del cwd
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
if str(_ROOT / "data") not in sys.path:
    sys.path.insert(0, str(_ROOT / "data"))

from connections.supabase_client import get_client
from loaders.supabase_writer import SupabaseWriter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constantes del cliente piloto
# ---------------------------------------------------------------------------

CLIENT_SLUG = "prepagas"
CAMPAIGN_ID = "PMAX_PREPAGAS"
CAMPAIGN_NAME = "PMAX Prevención Salud"
DEFAULT_DATE_START = "2026-01-01"


def parse_args() -> argparse.Namespace:
    """Parsea argumentos de línea de comandos."""
    parser = argparse.ArgumentParser(
        description="Backfill one-time de tofu_facts + mofu_facts + bofu_facts para Prepagas"
    )
    parser.add_argument(
        "--date-start",
        type=str,
        default=DEFAULT_DATE_START,
        help=f"Fecha inicio del backfill YYYY-MM-DD (default: {DEFAULT_DATE_START})",
    )
    parser.add_argument(
        "--date-end",
        type=str,
        default=str(_date.today()),
        help="Fecha fin del backfill YYYY-MM-DD (default: hoy)",
    )
    parser.add_argument(
        "--skip-tofu",
        action="store_true",
        default=False,
        help="Omitir el backfill de tofu_facts (solo MOFU + BOFU)",
    )
    parser.add_argument(
        "--skip-mofu-bofu",
        action="store_true",
        default=False,
        help="Omitir el backfill de mofu_facts y bofu_facts (solo TOFU)",
    )
    return parser.parse_args()


def backfill_tofu(
    supabase_client,
    date_start: str,
    date_end: str,
) -> int:
    """Llama a compute_tofu_facts para el rango histórico completo.

    Args:
        supabase_client: Instancia del cliente Supabase (service_role).
        date_start: Fecha inicio YYYY-MM-DD.
        date_end: Fecha fin YYYY-MM-DD.

    Returns:
        Número de filas upserted en tofu_facts. -1 si falló.
    """
    logger.info(
        "Backfill TOFU: cliente=%s rango=%s a %s campaign_id=%s",
        CLIENT_SLUG, date_start, date_end, CAMPAIGN_ID,
    )
    try:
        result = supabase_client.rpc("compute_tofu_facts", {
            "p_client_slug":   CLIENT_SLUG,
            "p_date_start":    date_start,
            "p_date_end":      date_end,
            "p_campaign_id":   CAMPAIGN_ID,
            "p_campaign_name": CAMPAIGN_NAME,
        }).execute()
        rows = result.data if result.data is not None else 0
        logger.info("compute_tofu_facts completado — filas_upserted=%s", rows)
        return rows
    except Exception as exc:
        logger.error("compute_tofu_facts falló: %s", exc, exc_info=True)
        return -1


def backfill_mofu_bofu(
    writer: SupabaseWriter,
    date_start: str,
    date_end: str,
) -> dict[str, int]:
    """Llama a compute_mofu_facts, compute_bofu_facts y calcular_conversion_rates.

    Delega en writer.compute_facts() que ya encadena los tres pasos.

    Args:
        writer: SupabaseWriter inicializado con service_role.
        date_start: Fecha inicio YYYY-MM-DD.
        date_end: Fecha fin YYYY-MM-DD.

    Returns:
        Dict con mofu_rows y bofu_rows.
    """
    logger.info(
        "Backfill MOFU + BOFU: cliente=%s rango=%s a %s campaign_id=%s",
        CLIENT_SLUG, date_start, date_end, CAMPAIGN_ID,
    )
    return writer.compute_facts(
        client_slug=CLIENT_SLUG,
        date_start=date_start,
        date_end=date_end,
        campaign_id=CAMPAIGN_ID,
        campaign_name=CAMPAIGN_NAME,
    )


def main() -> None:
    """Punto de entrada del backfill."""
    load_dotenv()
    args = parse_args()

    date_start = args.date_start
    date_end = args.date_end

    logger.info(
        "=== Backfill facts Prevención Salud | rango=%s a %s ===",
        date_start, date_end,
    )

    sb = get_client()
    writer = SupabaseWriter(sb)

    results: dict = {
        "client_slug": CLIENT_SLUG,
        "campaign_id": CAMPAIGN_ID,
        "date_start": date_start,
        "date_end": date_end,
        "tofu_rows_upserted": None,
        "mofu_rows_upserted": None,
        "bofu_rows_upserted": None,
        "errors": [],
    }

    # ---- TOFU ----
    if not args.skip_tofu:
        tofu_rows = backfill_tofu(sb, date_start, date_end)
        results["tofu_rows_upserted"] = tofu_rows
        if tofu_rows == -1:
            results["errors"].append("compute_tofu_facts falló — ver log arriba")
    else:
        logger.info("--skip-tofu activo: se omite backfill de tofu_facts.")
        results["tofu_rows_upserted"] = "skipped"

    # ---- MOFU + BOFU + conversion rates ----
    if not args.skip_mofu_bofu:
        try:
            facts_result = backfill_mofu_bofu(writer, date_start, date_end)
            results["mofu_rows_upserted"] = facts_result.get("mofu_rows", 0)
            results["bofu_rows_upserted"] = facts_result.get("bofu_rows", 0)
        except Exception as exc:
            logger.error("backfill_mofu_bofu falló: %s", exc, exc_info=True)
            results["errors"].append(f"mofu/bofu backfill: {exc}")
    else:
        logger.info("--skip-mofu-bofu activo: se omite backfill de mofu_facts y bofu_facts.")
        results["mofu_rows_upserted"] = "skipped"
        results["bofu_rows_upserted"] = "skipped"

    # ---- Resumen ----
    print("\n=== RESULTADO DEL BACKFILL ===")
    print(json.dumps(results, indent=2, ensure_ascii=False))

    if results["errors"]:
        logger.error("El backfill terminó con errores. Ver detalles arriba.")
        sys.exit(1)
    else:
        logger.info("Backfill completado sin errores.")


if __name__ == "__main__":
    main()
