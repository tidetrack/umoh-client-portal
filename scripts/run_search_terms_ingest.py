"""
scripts/run_search_terms_ingest.py
-----------------------------------
Ingestión manual de CSVs de search terms históricos hacia Supabase.

Contexto: Google Ads no expone search terms de campañas PMAX via API.
El export manual desde la UI de Google Ads genera un CSV que este script
parsea y carga en la tabla `tofu_search_terms` de Supabase con upsert
idempotente.

Uso:
    python scripts/run_search_terms_ingest.py --input <ruta-csv> [opciones]

Argumentos:
    --input <ruta>         Ruta al CSV exportado desde Google Ads UI.
                           Requerido.
    --client-slug <slug>   Slug del cliente (ej: 'prepagas'). Si se omite,
                           se infiere del nombre del archivo con el formato
                           {slug}-search-terms-{YYYYMMDD}.csv.
    --date <YYYY-MM-DD>    Fecha a usar como 'date' en Supabase. Si se omite,
                           se parsea la fecha de fin del rango que aparece en
                           la segunda línea del CSV (ej: "6 de febrero de 2026
                           - 29 de abril de 2026" → 2026-04-29).
    --campaign-id <id>     campaign_id a asignar a todos los registros.
                           Default: '' (string vacío, conforme al schema).
    --campaign-name <n>    campaign_name a asignar. Default: '' o el tipo de
                           concordancia detectado en la primera fila de datos.
    --dry-run              Parsea y valida sin escribir en Supabase.
                           Muestra resumen de filas que se upsertarían.

Exit codes:
    0   OK — upsert completado (o dry-run exitoso).
    1   Error de validación — CSV malformado, fecha inválida, slug inválido.
    2   Error de conexión Supabase — credenciales ausentes o request fallido.

Schema destino — tofu_search_terms (migración 014_tofu_search_terms.sql):
    PK: (client_slug, date, campaign_id, term)

Mapeo CSV → Supabase:
    client_slug   ← --client-slug o inferido del nombre del archivo
    date          ← --date o fecha de fin del rango del CSV (línea 2)
    campaign_id   ← --campaign-id (default: '')
    campaign_name ← --campaign-name (default: inferido de 'Tipo de concordancia')
    term          ← columna 'Término de búsqueda'
    source        ← 'campaign_search_term_insight' para "Campaña de máximo rendimiento"
                    'search_term_view' para cualquier otro tipo de concordancia
    clicks        ← columna 'Clics' (entero; comas y puntos de miles removidos)
    impressions   ← columna 'Impr.' (ídem)
    import_run_id ← UUID generado en cada ejecución del script
    last_seen_at  ← NOW() UTC en cada upsert

Filas descartadas:
    - Filas cuyo 'Término de búsqueda' comienza con 'Total:' (resumen al pie del CSV)
    - Filas con término vacío
    - Filas cuya primera columna no es un término (título, rango de fechas)
    - Filas con valores de clicks o impressions no parseables
"""

from __future__ import annotations

import argparse
import calendar
import csv
import json
import logging
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Resolver imports del directorio data/ independientemente del cwd
# ---------------------------------------------------------------------------
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "data"))

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Meses en español → número (para parsear el rango del CSV)
# ---------------------------------------------------------------------------
_MESES_ES: dict[str, int] = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}

# Tipo de concordancia → source canónico
_TIPO_CONCORDANCIA_MAP: dict[str, str] = {
    "campaña de máximo rendimiento": "campaign_search_term_insight",
}
_DEFAULT_SOURCE_FALLBACK = "search_term_view"


# ---------------------------------------------------------------------------
# Parsing de fecha en español
# ---------------------------------------------------------------------------

def _parse_fecha_es(texto: str) -> str:
    """Convierte '29 de abril de 2026' a '2026-04-29'.

    Args:
        texto: String con formato 'D de Mes de YYYY' en español.

    Returns:
        String con formato 'YYYY-MM-DD'.

    Raises:
        ValueError: si el texto no tiene el formato esperado o el mes es inválido.
    """
    texto = texto.strip().lower()
    # Acepta "29 de abril de 2026" o "29 de abril 2026"
    match = re.match(
        r"(\d{1,2})\s+de\s+([a-záéíóúü]+)(?:\s+de)?\s+(\d{4})", texto
    )
    if not match:
        raise ValueError(
            f"No se pudo parsear la fecha '{texto}'. "
            "Formato esperado: 'D de Mes de YYYY' en español."
        )
    dia = int(match.group(1))
    mes_str = match.group(2)
    anio = int(match.group(3))

    mes = _MESES_ES.get(mes_str)
    if mes is None:
        raise ValueError(
            f"Mes '{mes_str}' no reconocido en la fecha '{texto}'. "
            f"Meses válidos: {list(_MESES_ES.keys())}"
        )
    return f"{anio:04d}-{mes:02d}-{dia:02d}"


def _parse_date_range_line(line: str) -> tuple[str, str]:
    """Parsea la línea '6 de febrero de 2026 - 29 de abril de 2026'.

    Args:
        line: Segunda línea del CSV exportado por Google Ads UI.

    Returns:
        Tupla (date_start, date_end) en formato 'YYYY-MM-DD'.

    Raises:
        ValueError: si la línea no tiene el formato 'fecha - fecha'.
    """
    parts = line.strip().split(" - ")
    if len(parts) != 2:
        raise ValueError(
            f"No se pudo parsear el rango de fechas: '{line.strip()}'. "
            "Formato esperado: 'D de Mes de YYYY - D de Mes de YYYY'."
        )
    date_start = _parse_fecha_es(parts[0])
    date_end = _parse_fecha_es(parts[1])
    return date_start, date_end


# ---------------------------------------------------------------------------
# Inferir client_slug del nombre del archivo
# ---------------------------------------------------------------------------

def _infer_slug_from_filename(path: Path) -> str | None:
    """Intenta inferir el client_slug del nombre del archivo.

    Soporta dos formatos:
    - Diario:  {slug}-search-terms-{YYYYMMDD}.csv  (ej: prepagas-search-terms-20260429.csv)
    - Mensual: {slug}-search-terms-{YYYYMM}.csv    (ej: prepagas-search-terms-202604.csv)

    Args:
        path: Path al archivo CSV.

    Returns:
        Slug inferido, o None si el nombre no coincide con ningún patrón.
    """
    stem = path.stem  # nombre sin extensión
    # Formato diario (8 dígitos) — tiene precedencia
    match = re.match(r"^(.+)-search-terms-\d{8}$", stem)
    if match:
        return match.group(1)
    # Formato mensual (6 dígitos)
    match = re.match(r"^(.+)-search-terms-\d{6}$", stem)
    if match:
        return match.group(1)
    return None


def _resolve_date_from_filename(path: Path) -> str | None:
    """Intenta inferir la fecha a usar desde el nombre del archivo.

    Para archivos mensuales ({slug}-search-terms-{YYYYMM}.csv), resuelve el
    ÚLTIMO día del mes como fecha canónica. Esto es consistente con el modelo
    de datos: un CSV mensual representa todo el mes, y la fecha de cierre es
    el extremo más informativo para el upsert por (date, campaign_id, term).

    Ejemplos:
        'prepagas-search-terms-202603.csv' → '2026-03-31'
        'prepagas-search-terms-202604.csv' → '2026-04-30'
        'prepagas-search-terms-20260429.csv' → None  (diario: fecha viene del CSV)

    Args:
        path: Path al archivo CSV.

    Returns:
        Fecha 'YYYY-MM-DD' del último día del mes, o None si el nombre es diario
        o no coincide con el patrón mensual.
    """
    stem = path.stem
    match = re.match(r"^.+-search-terms-(\d{6})$", stem)
    if not match:
        return None
    yyyymm = match.group(1)
    try:
        year = int(yyyymm[:4])
        month = int(yyyymm[4:6])
        last_day = calendar.monthrange(year, month)[1]
        return f"{year:04d}-{month:02d}-{last_day:02d}"
    except (ValueError, IndexError):
        return None


# ---------------------------------------------------------------------------
# Parsear un número con posibles separadores de miles (coma o punto)
# ---------------------------------------------------------------------------

def _parse_int(raw: str) -> int | None:
    """Convierte '2,671' o '2.671' a 2671. Retorna None si no es parseable.

    Args:
        raw: String del valor numérico extraído del CSV.

    Returns:
        Entero o None.
    """
    cleaned = raw.strip().replace(",", "").replace(".", "")
    try:
        return int(cleaned)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Parsear CSV
# ---------------------------------------------------------------------------

EXPECTED_HEADER_FIELDS = {
    "Término de búsqueda",
    "Tipo de concordancia",
    "Clics",
    "Impr.",
}

TOTALS_PREFIXES = ("Total: ",)


def parse_csv(
    csv_path: Path,
    client_slug: str,
    date: str,
    campaign_id: str,
    campaign_name_override: str | None,
    run_id: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Lee y parsea el CSV de search terms exportado desde Google Ads UI.

    El CSV tiene un encabezado de 3 líneas antes de los datos:
        Línea 1: 'Informe de términos de búsqueda'
        Línea 2: '6 de febrero de 2026 - 29 de abril de 2026'
        Línea 3: nombres de columnas reales

    Las últimas filas tienen resúmenes de totales que deben descartarse.

    Args:
        csv_path:              Path al archivo CSV.
        client_slug:           Slug del cliente (ej: 'prepagas').
        date:                  Fecha YYYY-MM-DD a asignar a todos los registros.
        campaign_id:           campaign_id a asignar (puede ser '').
        campaign_name_override: Si no es None, sobreescribe el valor de la columna
                                'Tipo de concordancia' como campaign_name.
        run_id:                UUID del run para import_run_id.

    Returns:
        Tupla (valid_rows, discarded_rows).
        valid_rows:    Lista de dicts listos para upsert en tofu_search_terms.
        discarded_rows: Lista de dicts con {'row': ..., 'reason': ...} para logging.
    """
    valid_rows: list[dict[str, Any]] = []
    discarded_rows: list[dict[str, Any]] = []

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        raw_lines = f.readlines()

    if len(raw_lines) < 4:
        raise ValueError(
            f"El CSV tiene solo {len(raw_lines)} líneas. "
            "Se esperan al menos 4 (título, rango, header, 1+ filas de datos)."
        )

    # Saltar las 3 líneas de encabezado y procesar el resto como CSV
    csv_data = "".join(raw_lines[2:])  # línea 3 en adelante (índice 2)

    reader = csv.DictReader(csv_data.splitlines())

    # Verificar que el header tenga los campos esperados
    if reader.fieldnames is None:
        raise ValueError("No se pudo leer el header del CSV.")
    fieldnames_set = set(reader.fieldnames)
    missing = EXPECTED_HEADER_FIELDS - fieldnames_set
    if missing:
        raise ValueError(
            f"Faltan columnas requeridas en el CSV: {missing}. "
            f"Columnas encontradas: {list(reader.fieldnames)}"
        )

    now_utc = datetime.now(tz=timezone.utc).isoformat()

    for raw_row in reader:
        term = raw_row.get("Término de búsqueda", "").strip()

        # Descartar filas vacías
        if not term:
            discarded_rows.append({"row": dict(raw_row), "reason": "término vacío"})
            continue

        # Descartar filas de totales al pie del CSV
        if any(term.startswith(prefix) for prefix in TOTALS_PREFIXES):
            discarded_rows.append(
                {"row": dict(raw_row), "reason": f"fila de total: '{term}'"}
            )
            continue

        # Parsear clicks
        raw_clicks = raw_row.get("Clics", "0")
        clicks = _parse_int(raw_clicks)
        if clicks is None:
            discarded_rows.append(
                {
                    "row": dict(raw_row),
                    "reason": f"clicks no parseable: '{raw_clicks}'",
                }
            )
            continue

        # Parsear impressions
        raw_impr = raw_row.get("Impr.", "0")
        impressions = _parse_int(raw_impr)
        if impressions is None:
            discarded_rows.append(
                {
                    "row": dict(raw_row),
                    "reason": f"impressions no parseable: '{raw_impr}'",
                }
            )
            continue

        # Determinar source a partir de 'Tipo de concordancia'
        tipo = raw_row.get("Tipo de concordancia", "").strip()
        source = _TIPO_CONCORDANCIA_MAP.get(tipo.lower(), _DEFAULT_SOURCE_FALLBACK)

        # campaign_name: usar override si se pasó, si no usar el valor del CSV
        if campaign_name_override is not None:
            c_name = campaign_name_override
        else:
            # En exports PMAX, 'Tipo de concordancia' = 'Campaña de máximo rendimiento'
            # Es más descriptivo usar ese valor como campaign_name cuando no hay nombre real
            c_name = tipo if tipo else ""

        row: dict[str, Any] = {
            "client_slug":    client_slug,
            "date":           date,
            "campaign_id":    campaign_id,
            "campaign_name":  c_name,
            "term":           term,
            "source":         source,
            "clicks":         clicks,
            "impressions":    impressions,
            "import_run_id":  run_id,
            "last_seen_at":   now_utc,
        }
        valid_rows.append(row)

    return valid_rows, discarded_rows


# ---------------------------------------------------------------------------
# Upsert en Supabase
# ---------------------------------------------------------------------------

_UPSERT_BATCH_SIZE = 500  # Supabase PostgREST acepta hasta ~1000; 500 es seguro


def upsert_to_supabase(
    rows: list[dict[str, Any]],
    client_slug: str,
    run_id: str,
) -> dict[str, Any]:
    """Hace upsert idempotente de los rows en tofu_search_terms.

    La PK compuesta (client_slug, date, campaign_id, term) garantiza idempotencia:
    si se corre el mismo CSV dos veces, la segunda ejecución actualiza
    clicks, impressions, import_run_id y last_seen_at pero no crea duplicados.

    El upsert se hace en lotes de _UPSERT_BATCH_SIZE para evitar timeouts
    en CSVs grandes (5000+ filas).

    Args:
        rows:        Lista de dicts listos para upsert (salida de parse_csv).
        client_slug: Slug del cliente (solo para logging).
        run_id:      UUID del run (solo para logging).

    Returns:
        Dict con estadísticas: {'rows_upserted': int, 'batches': int}.

    Raises:
        RuntimeError (exit code 2): si las credenciales de Supabase faltan.
        Exception (exit code 2):    si el request a Supabase falla.
    """
    from connections.supabase_client import get_client

    try:
        sb = get_client()
    except RuntimeError as exc:
        logger.error("Error de conexión Supabase: %s", exc)
        raise

    total_upserted = 0
    batches = 0

    for i in range(0, len(rows), _UPSERT_BATCH_SIZE):
        batch = rows[i : i + _UPSERT_BATCH_SIZE]
        batches += 1
        logger.info(
            "Upsertando batch %d (%d filas) — run_id=%s client_slug=%s",
            batches, len(batch), run_id, client_slug,
        )
        try:
            response = (
                sb.table("tofu_search_terms")
                .upsert(batch, on_conflict="client_slug,date,campaign_id,term")
                .execute()
            )
            upserted = len(response.data) if response.data else 0
            total_upserted += upserted
            logger.info("Batch %d completado — filas_upsertadas=%d", batches, upserted)
        except Exception:
            logger.exception(
                "Error en upsert — batch=%d run_id=%s client_slug=%s",
                batches, run_id, client_slug,
            )
            raise

    return {"rows_upserted": total_upserted, "batches": batches}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    """Parsea argumentos de línea de comandos."""
    parser = argparse.ArgumentParser(
        description=(
            "Ingestión manual de CSVs de search terms (Google Ads UI) hacia "
            "Supabase (tabla tofu_search_terms). Idempotente por PK compuesta "
            "(client_slug, date, campaign_id, term)."
        )
    )
    parser.add_argument(
        "--input",
        required=True,
        metavar="RUTA_CSV",
        help="Path al CSV exportado desde Google Ads UI.",
    )
    parser.add_argument(
        "--client-slug",
        default=None,
        metavar="SLUG",
        help=(
            "Slug del cliente (ej: 'prepagas'). Si se omite, se infiere del "
            "nombre del archivo con formato {slug}-search-terms-{YYYYMMDD}.csv."
        ),
    )
    parser.add_argument(
        "--date",
        default=None,
        metavar="YYYY-MM-DD",
        help=(
            "Fecha a asignar a todos los registros. Si se omite, se usa la "
            "fecha de FIN del rango que aparece en la línea 2 del CSV."
        ),
    )
    parser.add_argument(
        "--campaign-id",
        default="",
        metavar="ID",
        help=(
            "campaign_id a asignar a todos los registros. "
            "Default: '' (string vacío, conforme al schema)."
        ),
    )
    parser.add_argument(
        "--campaign-name",
        default=None,
        metavar="NOMBRE",
        help=(
            "campaign_name a asignar. Si se omite, se usa el valor de la "
            "columna 'Tipo de concordancia' del CSV (ej: 'Campaña de máximo "
            "rendimiento')."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help=(
            "Parsea y valida el CSV sin escribir en Supabase. "
            "Imprime resumen de filas que se upsertarían."
        ),
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Flujo principal del script de ingestión manual de search terms.

    1. Carga variables de entorno desde .env (no-op en GitHub Actions).
    2. Valida argumentos (path del CSV, slug, fecha).
    3. Lee y parsea el CSV: descarta headers, totales y filas inválidas.
    4. Loguea resumen de filas válidas y descartadas.
    5. En modo --dry-run: imprime resumen y termina sin escribir.
    6. En modo normal: upsert en Supabase y termina con exit code adecuado.
    """
    load_dotenv()
    args = parse_args()

    csv_path = Path(args.input).resolve()

    # ------------------------------------------------------------------
    # Validación: el CSV existe
    # ------------------------------------------------------------------
    if not csv_path.exists():
        logger.error("El archivo no existe: %s", csv_path)
        sys.exit(1)
    if not csv_path.is_file():
        logger.error("La ruta no es un archivo regular: %s", csv_path)
        sys.exit(1)

    # ------------------------------------------------------------------
    # Validación: client_slug
    # ------------------------------------------------------------------
    client_slug = args.client_slug
    if not client_slug:
        client_slug = _infer_slug_from_filename(csv_path)
        if client_slug:
            logger.info(
                "client_slug inferido del nombre del archivo: '%s'", client_slug
            )
        else:
            logger.error(
                "No se pudo inferir el client_slug del nombre '%s'. "
                "Usá --client-slug <slug> explícitamente.",
                csv_path.name,
            )
            sys.exit(1)

    # ------------------------------------------------------------------
    # Parsear rango de fechas de la línea 2 del CSV (siempre, para logging)
    # ------------------------------------------------------------------
    with open(csv_path, encoding="utf-8-sig") as f:
        raw_lines = f.readlines()

    if len(raw_lines) < 2:
        logger.error("El CSV tiene menos de 2 líneas — no es un export válido.")
        sys.exit(1)

    date_start_csv: str | None = None
    date_end_csv: str | None = None
    range_line = raw_lines[1].strip()

    if range_line:
        try:
            date_start_csv, date_end_csv = _parse_date_range_line(range_line)
            logger.info(
                "Rango detectado en el CSV: %s → %s", date_start_csv, date_end_csv
            )
        except ValueError as exc:
            logger.warning(
                "No se pudo parsear el rango de fechas del CSV: %s. "
                "Se requiere --date explícito.",
                exc,
            )

    # ------------------------------------------------------------------
    # Validación: fecha a usar
    # ------------------------------------------------------------------
    date_to_use = args.date
    if date_to_use:
        # Validar formato YYYY-MM-DD
        try:
            datetime.strptime(date_to_use, "%Y-%m-%d")
        except ValueError:
            logger.error(
                "Formato de fecha inválido: '%s'. Usar YYYY-MM-DD.", date_to_use
            )
            sys.exit(1)
        logger.info("Usando fecha explícita: %s", date_to_use)
    else:
        # Intentar inferir fecha desde el nombre del archivo (formato mensual YYYYMM)
        date_from_filename = _resolve_date_from_filename(csv_path)
        if date_from_filename:
            date_to_use = date_from_filename
            logger.info(
                "Fecha inferida del nombre del archivo (último día del mes): %s",
                date_to_use,
            )
        elif date_end_csv:
            date_to_use = date_end_csv
            logger.info(
                "Usando fecha de fin del rango del CSV como date: %s", date_to_use
            )
        else:
            logger.error(
                "No se pudo determinar la fecha. Pasá --date YYYY-MM-DD explícitamente."
            )
            sys.exit(1)

    # ------------------------------------------------------------------
    # Generar run_id para auditoría
    # ------------------------------------------------------------------
    run_id = str(uuid.uuid4())
    logger.info(
        "Iniciando ingestión — run_id=%s client_slug=%s date=%s csv=%s",
        run_id, client_slug, date_to_use, csv_path.name,
    )

    # ------------------------------------------------------------------
    # Parsear CSV
    # ------------------------------------------------------------------
    try:
        valid_rows, discarded_rows = parse_csv(
            csv_path=csv_path,
            client_slug=client_slug,
            date=date_to_use,
            campaign_id=args.campaign_id,
            campaign_name_override=args.campaign_name,
            run_id=run_id,
        )
    except ValueError as exc:
        logger.error("Error de validación al parsear el CSV: %s", exc)
        sys.exit(1)

    # ------------------------------------------------------------------
    # Resumen de parsing
    # ------------------------------------------------------------------
    rows_read = len(valid_rows) + len(discarded_rows)
    logger.info(
        "Parsing completado — filas_leídas=%d válidas=%d descartadas=%d",
        rows_read, len(valid_rows), len(discarded_rows),
    )

    # Resumen de descartadas con motivo
    discard_reasons: dict[str, int] = {}
    for d in discarded_rows:
        reason = d.get("reason", "desconocido")
        discard_reasons[reason] = discard_reasons.get(reason, 0) + 1

    if discard_reasons:
        logger.info("Filas descartadas por motivo: %s", discard_reasons)

    # Resumen por source
    source_counts: dict[str, int] = {}
    for r in valid_rows:
        src = r.get("source", "unknown")
        source_counts[src] = source_counts.get(src, 0) + 1
    logger.info("Filas válidas por source: %s", source_counts)

    # ------------------------------------------------------------------
    # Dry-run: imprimir resumen y salir sin escribir
    # ------------------------------------------------------------------
    if args.dry_run:
        summary = {
            "mode": "dry_run",
            "client_slug": client_slug,
            "date": date_to_use,
            "date_range_csv": (
                f"{date_start_csv} → {date_end_csv}"
                if date_start_csv and date_end_csv
                else None
            ),
            "campaign_id": args.campaign_id,
            "run_id": run_id,
            "csv_file": csv_path.name,
            "rows_read": rows_read,
            "rows_valid": len(valid_rows),
            "rows_discarded": len(discarded_rows),
            "discard_reasons": discard_reasons,
            "source_counts": source_counts,
            "sample_rows": valid_rows[:3],  # Muestra 3 filas de ejemplo
        }
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        logger.info("Dry-run completado — no se escribió nada en Supabase.")
        sys.exit(0)

    # ------------------------------------------------------------------
    # Verificar que hay algo que upsertear
    # ------------------------------------------------------------------
    if not valid_rows:
        logger.warning(
            "No hay filas válidas para upsertear — client_slug=%s date=%s.",
            client_slug, date_to_use,
        )
        summary = {
            "status": "no_data",
            "client_slug": client_slug,
            "date": date_to_use,
            "rows_read": rows_read,
            "rows_valid": 0,
            "rows_discarded": len(discarded_rows),
            "discard_reasons": discard_reasons,
        }
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        sys.exit(0)

    # ------------------------------------------------------------------
    # Upsert en Supabase
    # ------------------------------------------------------------------
    try:
        result = upsert_to_supabase(
            rows=valid_rows,
            client_slug=client_slug,
            run_id=run_id,
        )
    except RuntimeError:
        # Error de credenciales (SUPABASE_URL o SUPABASE_SERVICE_KEY faltantes)
        sys.exit(2)
    except Exception:
        logger.exception("Error de conexión/request en Supabase.")
        sys.exit(2)

    # ------------------------------------------------------------------
    # Resumen final
    # ------------------------------------------------------------------
    summary = {
        "status": "ok",
        "client_slug": client_slug,
        "date": date_to_use,
        "date_range_csv": (
            f"{date_start_csv} → {date_end_csv}"
            if date_start_csv and date_end_csv
            else None
        ),
        "campaign_id": args.campaign_id,
        "run_id": run_id,
        "csv_file": csv_path.name,
        "rows_read": rows_read,
        "rows_valid": len(valid_rows),
        "rows_upserted": result["rows_upserted"],
        "rows_discarded": len(discarded_rows),
        "discard_reasons": discard_reasons,
        "source_counts": source_counts,
        "batches": result["batches"],
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    logger.info(
        "Ingestión completada — run_id=%s rows_upserted=%d",
        run_id, result["rows_upserted"],
    )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stdout,
    )
    main()
