"""
scripts/run_tofu_pipeline.py
----------------------------
Orquestador del pipeline TOFU: extrae Google Ads → normaliza → escribe en
Google Sheets Y en Supabase (dual-write, política C.5 Opción B).

Sheets sigue siendo la fuente de lectura para los endpoints PHP (MOFU/BOFU).
Supabase queda listo para la migración de endpoints en v2.

Uso:
    python scripts/run_tofu_pipeline.py [--days N] [--no-sheets]

Args:
    --days N      Días hacia atrás a extraer (default: 7).
    --no-sheets   Omitir escritura en Google Sheets (solo escribe en Supabase).
                  Útil para pruebas del loader Supabase sin credenciales de Sheets.

NOTA sobre config_dir:
    El extractor google_ads.run() acepta config_dir como parámetro.
    Su default interno es "config/clients" (hardcodeado en el archivo del extractor),
    pero la estructura real del repo usa "clients/" — ver sección "Inconsistencia conocida"
    más abajo. Este script siempre pasa config_dir="clients" explícitamente.

Inconsistencia conocida (NO se resuelve aquí — decisión del equipo):
    data/extractors/google_ads.py define:
        def run(config_dir: str = "config/clients", ...)
        def load_active_clients(config_dir: str = "config/clients", ...)
    Pero los YAMLs de clientes están en clients/ (no en config/clients/).
    El pipeline NO falla si siempre se pasa config_dir="clients" explícitamente
    (como hace este script), pero el default del extractor es incorrecto.
    Si alguien llama run() sin argumentos obtendrá 0 clientes y un WARNING.
    Corrección pendiente: cambiar el default en google_ads.py a "clients".
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

# Resolver imports del directorio data/ independientemente del cwd
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "data"))

from dotenv import load_dotenv

# Los imports de los módulos del pipeline van después del sys.path.insert
from connections.supabase_client import get_client as get_supabase_client
from extractors.google_ads import run as extract_google_ads
from loaders.supabase_tofu_writer import write_tofu_ads
from normalizers.canonical import normalize

import pandas as pd

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    """Parsea argumentos de línea de comandos."""
    parser = argparse.ArgumentParser(
        description="Pipeline TOFU: Google Ads → Sheets + Supabase"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="Días hacia atrás a extraer (default: 7)",
    )
    parser.add_argument(
        "--no-sheets",
        action="store_true",
        default=False,
        help="Omitir escritura en Google Sheets (solo Supabase)",
    )
    return parser.parse_args()


def main() -> None:
    """
    Flujo principal del pipeline TOFU.

    1. Carga variables de entorno desde .env (no-op en GitHub Actions).
    2. Lee --days y --no-sheets de los argumentos.
    3. Extrae datos de Google Ads para todos los clientes activos en clients/.
    4. Normaliza cada resultado al schema TOFU canónico.
    5. Concatena todos los DataFrames.
    6. Escribe en Google Sheets (salvo --no-sheets).
    7. Escribe en Supabase (siempre).
    8. Imprime resumen JSON.
    """
    load_dotenv()

    args = parse_args()
    days_back: int = args.days
    write_sheets: bool = not args.no_sheets

    logger.info(
        "Iniciando pipeline TOFU — days_back=%d, write_sheets=%s",
        days_back,
        write_sheets,
    )

    # ------------------------------------------------------------------
    # Paso 1: Extracción
    # NOTA: Pasamos config_dir="clients" explícitamente para evitar el
    # default incorrecto "config/clients" del extractor (ver docstring).
    # ------------------------------------------------------------------
    logger.info("Extrayendo datos de Google Ads desde clients/ ...")
    raw_results = extract_google_ads(config_dir="clients", days_back=days_back)

    if not raw_results:
        logger.warning("No hay resultados de extracción. Pipeline finalizado sin datos.")
        print(json.dumps({"status": "no_data", "rows_written_sheets": 0, "rows_written_supabase": 0}))
        return

    logger.info("Extracción completada: %d cliente(s).", len(raw_results))

    # ------------------------------------------------------------------
    # Paso 2: Normalización
    # ------------------------------------------------------------------
    dfs: list[pd.DataFrame] = []
    failed_clients: list[str] = []

    for raw in raw_results:
        client_id = raw.get("client_id", "unknown")
        try:
            df = normalize(raw)
            if not df.empty:
                dfs.append(df)
                logger.info("Normalizado: client_id=%s — %d filas TOFU.", client_id, len(df))
            else:
                logger.warning("DataFrame vacío para client_id=%s. Se omite.", client_id)
        except Exception:
            logger.exception("Error normalizando client_id=%s.", client_id)
            failed_clients.append(client_id)

    if not dfs:
        logger.error("No hay DataFrames para cargar después de normalización.")
        print(json.dumps({"status": "normalization_failed", "failed": failed_clients}))
        sys.exit(1)

    combined = pd.concat(dfs, ignore_index=True)
    logger.info("DataFrame combinado: %d filas totales.", len(combined))

    # ------------------------------------------------------------------
    # Paso 3: Escritura en Google Sheets (dual-write, no desactivar)
    # ------------------------------------------------------------------
    rows_sheets = 0
    sheets_error: str | None = None

    if write_sheets:
        try:
            from loaders.sheets_writer import write_normalized_data
            write_normalized_data(combined)
            rows_sheets = len(combined)
            logger.info("Sheets: %d filas escritas.", rows_sheets)
        except Exception as exc:
            sheets_error = str(exc)
            logger.error("Error escribiendo en Sheets: %s", exc)
            # No se lanza — el pipeline continúa hacia Supabase
    else:
        logger.info("--no-sheets activo: se omite escritura en Google Sheets.")

    # ------------------------------------------------------------------
    # Paso 4: Escritura en Supabase
    # ------------------------------------------------------------------
    supabase_result: dict = {}
    supabase_error: str | None = None

    try:
        supabase_result = write_tofu_ads(combined)
        logger.info(
            "Supabase: %d filas escritas — clientes=%s, plataformas=%s",
            supabase_result.get("rows_written", 0),
            supabase_result.get("clients", []),
            supabase_result.get("platforms", []),
        )
    except Exception as exc:
        supabase_error = str(exc)
        logger.exception("Error escribiendo en Supabase.")

    # ------------------------------------------------------------------
    # Paso 5: Poblar tofu_facts via stored procedure
    #
    # Se ejecuta por cada cliente procesado. Para v1 (Prepagas, campaña única)
    # el campaign_id se toma del DataFrame si está disponible; si no, usa el
    # placeholder 'PMAX_PREPAGAS'.
    #
    # El stored procedure es idempotente (UPSERT) — re-ejecutarlo es seguro.
    # Si el upsert a tofu_ads_daily falló (supabase_error), igual intentamos
    # compute_tofu_facts para actualizar con los datos que sí llegaron.
    # ------------------------------------------------------------------
    facts_errors: list[str] = []

    try:
        sb = get_supabase_client()

        for raw in raw_results:
            client_id = raw.get("client_id", "")
            date_start = raw.get("date_start", "")
            date_end = raw.get("date_end", "")

            # Determinar campaign_id y campaign_name del run.
            # Si el extractor trajo campaign_id reales, usamos el primer valor
            # encontrado en raw_metrics (en v1 siempre hay una sola campaña).
            raw_metrics_list = raw.get("raw_metrics", [])
            if raw_metrics_list and raw_metrics_list[0].get("campaign_id"):
                campaign_id = raw_metrics_list[0]["campaign_id"]
                campaign_name = raw_metrics_list[0].get("campaign_name", "PMAX Prevención Salud")
            else:
                campaign_id = "PMAX_PREPAGAS"
                campaign_name = "PMAX Prevención Salud"

            logger.info(
                "Calculando tofu_facts — cliente=%s rango=%s a %s campaign_id=%s",
                client_id, date_start, date_end, campaign_id,
            )

            try:
                result = sb.rpc("compute_tofu_facts", {
                    "p_client_slug":   client_id,
                    "p_date_start":    date_start,
                    "p_date_end":      date_end,
                    "p_campaign_id":   campaign_id,
                    "p_campaign_name": campaign_name,
                }).execute()
                rows_computed = result.data if result.data is not None else 0
                logger.info(
                    "compute_tofu_facts completado — cliente=%s filas_upserted=%s",
                    client_id, rows_computed,
                )
            except Exception as exc:
                err_msg = f"compute_tofu_facts falló para cliente={client_id}: {exc}"
                logger.error(err_msg)
                facts_errors.append(err_msg)

    except Exception as exc:
        err_msg = f"Error inicializando Supabase para compute_tofu_facts: {exc}"
        logger.error(err_msg)
        facts_errors.append(err_msg)

    # ------------------------------------------------------------------
    # Paso 6: Espejo de tofu_facts a Google Sheets (Fase 3 — sprint 1.7)
    # ------------------------------------------------------------------
    # Lee tofu_facts desde Supabase y las replica en la pestaña 'tofu_facts'
    # de la Sheet de cada cliente. Independiente del flag --no-sheets (que
    # controla el flujo legacy tofu_raw). Se saltea si falta el secret
    # GOOGLE_SHEETS_SA_JSON. No bloquea el pipeline si falla.
    sheets_mirror_results: dict[str, dict[str, int]] = {}
    sheets_mirror_errors: list[str] = []

    if not facts_errors and "GOOGLE_SHEETS_SA_JSON" in os.environ:
        try:
            from loaders.supabase_writer import SupabaseWriter
            writer = SupabaseWriter()

            for raw in raw_results:
                client_id = raw.get("client_id", "")
                sheet_id = raw.get("sheets_output_id", "")
                if not sheet_id or str(sheet_id).startswith("REEMPLAZAR"):
                    logger.info(
                        "Mirror sheets — sheet_id no configurado para cliente=%s, se omite.",
                        client_id,
                    )
                    continue
                try:
                    mirror = writer.mirror_facts_to_sheets(
                        client_slug=client_id,
                        spreadsheet_id=str(sheet_id),
                        mirror_tofu=True,
                        mirror_mofu=False,
                        mirror_bofu=False,
                    )
                    sheets_mirror_results[client_id] = mirror.get("tofu", {})
                except Exception as exc:
                    err_msg = f"Mirror sheets falló para cliente={client_id}: {exc}"
                    logger.error(err_msg)
                    sheets_mirror_errors.append(err_msg)
        except Exception as exc:
            err_msg = f"Error inicializando mirror_facts_to_sheets: {exc}"
            logger.error(err_msg)
            sheets_mirror_errors.append(err_msg)
    elif "GOOGLE_SHEETS_SA_JSON" not in os.environ:
        logger.info("Mirror sheets — GOOGLE_SHEETS_SA_JSON ausente, se omite.")

    # ------------------------------------------------------------------
    # Paso 7: Resumen
    # ------------------------------------------------------------------
    has_errors = bool(supabase_error or facts_errors or sheets_mirror_errors)
    summary = {
        "status": "ok" if not has_errors else "partial_failure",
        "days_back": days_back,
        "clients_processed": [r.get("client_id") for r in raw_results],
        "clients_failed_normalization": failed_clients,
        "rows_in_dataframe": len(combined),
        "rows_written_sheets": rows_sheets if write_sheets else "skipped",
        "sheets_error": sheets_error,
        "rows_written_supabase": supabase_result.get("rows_written", 0),
        "supabase_clients": supabase_result.get("clients", []),
        "supabase_platforms": supabase_result.get("platforms", []),
        "supabase_error": supabase_error,
        "facts_errors": facts_errors,
        "sheets_mirror": sheets_mirror_results,
        "sheets_mirror_errors": sheets_mirror_errors,
    }

    print(json.dumps(summary, indent=2, ensure_ascii=False))

    if has_errors:
        sys.exit(1)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )
    main()
