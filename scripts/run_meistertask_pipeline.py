"""
scripts/run_meistertask_pipeline.py
-------------------------------------
Orquestador end-to-end del pipeline MeisterTask → Supabase.

Flujo:
    1. Cargar .env (load_dotenv).
    2. Leer CLIENT_SLUG del entorno o --client-slug CLI (default: 'prepagas').
    3. Localizar el CSV: --input CLI > MEISTERTASK_CSV_PATH env > glob en Meistertask/{slug}/.
    4. Cargar clients/{slug}.yaml.
    5. sync_funnel_stages_from_yaml (sincroniza config del funnel antes de todo).
    6. extract_csv → (client_slug_inferido, rows).
       Nota: cuando se usa --input con --client-slug, el slug NO se valida contra
       el directorio padre del CSV (el CSV puede venir de inbox/ con nombre arbitrario).
    7. start_run → run_id.
    8. Por cada fila: normalize → upsert_lead → upsert_monetary (si hay datos)
       → upsert_activity por cada comentario.
    9. recalculate_requires_update.
    10. finish_run con los totales.
    11. Imprimir resumen JSON.

Variables de entorno:
    SUPABASE_URL            URL del proyecto Supabase.
    SUPABASE_SERVICE_KEY    Service role key (full write access).
    CLIENT_SLUG             Slug del cliente (default: 'prepagas').
    MEISTERTASK_CSV_PATH    Path explícito al CSV (opcional; si se omite,
                            el script hace glob en Meistertask/{slug}/).

Ejecución:
    python scripts/run_meistertask_pipeline.py
    python scripts/run_meistertask_pipeline.py --input data/inbox/meistertask/prepagas-meistertask-20260511.csv --client-slug prepagas
"""

from __future__ import annotations

import argparse
import glob
import json
import logging
import os
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv

# Resolver imports del proyecto independientemente del cwd
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from data.connections.supabase_client import get_client
from data.extractors.meistertask_csv import extract_csv
from data.loaders.supabase_writer import SupabaseWriter
from data.normalizers.meistertask import (
    MONEY_KEYWORD_WHITELIST,
    normalize_lead_full,
    parse_comments,
    parse_notes_money,
)
from scripts.sync_funnel_stages import sync_funnel_stages_from_yaml

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s — %(message)s',
)
logger = logging.getLogger(__name__)


def _find_csv(client_slug: str, cli_input: str | None = None) -> str:
    """Localiza el CSV más reciente para el cliente.

    Orden de precedencia:
    1. --input CLI argument (cli_input).
    2. Variable de entorno MEISTERTASK_CSV_PATH.
    3. Glob en Meistertask/{client_slug}/project-export-*.csv.

    Cuando se pasa --input con --client-slug, el CSV puede tener cualquier nombre
    (ej: prepagas-meistertask-20260511.csv desde inbox/). La validación del slug
    contra el directorio padre se saltea en este caso — el slug viene explícito.

    Args:
        client_slug: Slug del cliente.
        cli_input: Path al CSV pasado vía --input, o None.

    Returns:
        Path absoluto al CSV.

    Raises:
        FileNotFoundError: si no se encuentra ningún CSV.
    """
    # 1. Override explícito via --input CLI
    if cli_input:
        p = Path(cli_input)
        if not p.is_absolute():
            p = _ROOT / p
        if p.exists():
            logger.info("Usando CSV desde --input CLI: %s", p)
            return str(p)
        raise FileNotFoundError(f"--input apunta a un archivo inexistente: {p}")

    # 2. Override explícito via env
    env_path = os.environ.get('MEISTERTASK_CSV_PATH')
    if env_path:
        p = Path(env_path)
        if not p.is_absolute():
            p = _ROOT / p
        if p.exists():
            logger.info("Usando CSV desde env MEISTERTASK_CSV_PATH: %s", p)
            return str(p)
        raise FileNotFoundError(f"MEISTERTASK_CSV_PATH apunta a un archivo inexistente: {p}")

    # 3. Glob en Meistertask/{slug}/
    pattern = str(_ROOT / 'Meistertask' / client_slug / 'project-export-*.csv')
    candidates = glob.glob(pattern)
    if not candidates:
        raise FileNotFoundError(
            f"No se encontró CSV para el cliente '{client_slug}'. "
            f"Patrón buscado: {pattern}"
        )

    # El más reciente por mtime
    latest = max(candidates, key=lambda p: Path(p).stat().st_mtime)
    logger.info("CSV encontrado: %s", latest)
    return latest


def _load_yaml(client_slug: str) -> dict:
    """Carga clients/{slug}.yaml.

    Args:
        client_slug: Slug del cliente.

    Returns:
        Dict con la configuración del cliente.
    """
    yaml_path = _ROOT / 'clients' / f'{client_slug}.yaml'
    with open(yaml_path, encoding='utf-8') as fh:
        return yaml.safe_load(fh)


def _parse_args() -> argparse.Namespace:
    """Parsea argumentos de línea de comandos (todos opcionales)."""
    parser = argparse.ArgumentParser(
        description=(
            "Orquestador del pipeline MeisterTask → Supabase. "
            "Por defecto lee CLIENT_SLUG del entorno y hace glob en Meistertask/{slug}/. "
            "Usar --input + --client-slug para procesar CSVs desde inbox/ u otras rutas."
        )
    )
    parser.add_argument(
        "--input",
        default=None,
        metavar="RUTA_CSV",
        help=(
            "Path explícito al CSV de MeisterTask. Si se omite, el script busca en "
            "MEISTERTASK_CSV_PATH (env) o hace glob en Meistertask/{slug}/. "
            "Cuando se usa --input, --client-slug es obligatorio."
        ),
    )
    parser.add_argument(
        "--client-slug",
        default=None,
        metavar="SLUG",
        help=(
            "Slug del cliente (ej: 'prepagas'). Si se omite, se lee de la variable "
            "de entorno CLIENT_SLUG (default: 'prepagas')."
        ),
    )
    return parser.parse_args()


def main() -> None:
    """Punto de entrada del pipeline."""
    load_dotenv()
    args = _parse_args()

    # --client-slug CLI tiene precedencia sobre la variable de entorno
    client_slug = args.client_slug or os.environ.get('CLIENT_SLUG', 'prepagas')
    logger.info("=== Pipeline MeisterTask → Supabase | cliente=%s ===", client_slug)

    # Validar: si se pasa --input, también debe haber un slug explícito
    if args.input and not args.client_slug and not os.environ.get('CLIENT_SLUG'):
        logger.warning(
            "--input especificado sin --client-slug ni CLIENT_SLUG env. "
            "Usando default 'prepagas'. Si es incorrecto, pasá --client-slug explícito."
        )

    # 1. Localizar CSV
    csv_path = _find_csv(client_slug, cli_input=args.input)

    # 2. Cargar YAML del cliente
    yaml_config = _load_yaml(client_slug)
    segments: list[str] = yaml_config.get('reporting', {}).get('segments', [])
    logger.info("Segmentos del cliente: %s", segments)

    # 3. Inicializar cliente Supabase y writer
    supabase = get_client()
    writer = SupabaseWriter(supabase)

    # 4. Sincronizar funnel_stages desde YAML → Supabase
    sync_result = sync_funnel_stages_from_yaml(client_slug, yaml_config, supabase)
    logger.info("funnel_stages sync: %s", sync_result)

    # 5. Extraer CSV
    # Cuando se usa --input (CSV desde inbox/ u otra ruta), el directorio padre
    # puede no coincidir con client_slug. Si se pasó --input, usamos client_slug
    # explícito como fuente de verdad y no validamos el slug inferido del path.
    explicit_input = bool(args.input)
    try:
        csv_client_slug, rows = extract_csv(csv_path)
    except ValueError as exc:
        if explicit_input:
            # El directorio padre no matchea el patrón de slug — leer directamente.
            logger.info(
                "extract_csv rechazó el path (%s). "
                "Usando --client-slug '%s' explícito y leyendo CSV directamente.",
                exc, client_slug,
            )
            import csv as _csv
            rows = []
            with open(csv_path, encoding='utf-8-sig', newline='') as fh:
                reader = _csv.DictReader(fh)
                for row in reader:
                    rows.append(dict(row))
            csv_client_slug = client_slug
        else:
            raise

    if explicit_input:
        # El slug viene explícito vía --input + --client-slug: no validar el inferido.
        # El directorio padre del CSV puede ser 'inbox', 'meistertask', etc.
        logger.info(
            "Slug explícito '%s' — se omite validación del slug inferido del CSV ('%s').",
            client_slug, csv_client_slug,
        )
        csv_client_slug = client_slug
    elif csv_client_slug != client_slug:
        raise ValueError(
            f"El slug inferido del CSV ({csv_client_slug!r}) no coincide "
            f"con CLIENT_SLUG ({client_slug!r}). "
            f"Verificar que el CSV está en Meistertask/{client_slug}/ "
            f"o pasá --input + --client-slug explícitamente."
        )
    logger.info("Filas extraídas del CSV: %d", len(rows))

    # 6. Obtener flags de secciones cerradas para determinar is_closed en monetary
    closed_sections = _get_closed_sections(supabase, client_slug)

    # 7. Iniciar run
    run_id = writer.start_run(client_slug, Path(csv_path).name)

    # 8. Procesar cada fila
    counters = {'total': 0, 'new': 0, 'updated': 0, 'skipped': 0, 'errors': []}

    for row in rows:
        counters['total'] += 1
        mt_id_str = row.get('id', '')
        try:
            # Normalizar lead completo (con tags)
            lead_record = normalize_lead_full(row, client_slug, run_id, segments)

            # Upsert del lead principal
            status = writer.upsert_lead(lead_record, run_id)
            counters[status] += 1

            # Determinar si el lead está en una sección "cerrada"
            is_closed = row.get('section', '') in closed_sections

            # Monetario desde notes
            notes_money = parse_notes_money(row.get('notes', ''))
            money_from_notes = notes_money is not None

            if notes_money:
                writer.upsert_monetary(notes_money, client_slug, int(mt_id_str), run_id, is_closed)

            # Comentarios → actividades + monetario fallback
            activities, money_extractions = parse_comments(
                row.get('comments', ''),
                MONEY_KEYWORD_WHITELIST,
            )

            for activity in activities:
                writer.upsert_activity(activity, client_slug, int(mt_id_str), run_id)

            # Monetario fallback desde comments (solo si notes no tenía datos)
            if not money_from_notes and money_extractions:
                for extraction in money_extractions:
                    amount = extraction.get('extracted_amount')
                    if amount is not None:
                        fallback_monetary = {
                            'plan_code': None,
                            'capitas': None,
                            'cuota_mensual': amount,
                            'descuento_pct': None,
                            'precio_final': amount,
                            'data_source': 'comments_parsed',
                        }
                        writer.upsert_monetary(
                            fallback_monetary, client_slug, int(mt_id_str), run_id, is_closed,
                        )
                        break  # Solo tomar el primer monto del fallback

        except Exception as e:
            logger.error("Error procesando lead id=%s: %s", mt_id_str, e, exc_info=True)
            counters['errors'].append({'id': mt_id_str, 'error': str(e)})

    # 9. Recalcular requires_update
    writer.recalculate_requires_update(client_slug)

    # 10. Finalizar run
    writer.finish_run(run_id, counters)

    # 11. Poblar facts tables (MOFU + BOFU) via stored procedures.
    #
    # Se ejecuta incluso si hubo errores parciales en el procesamiento de leads,
    # porque el stored procedure trabaja sobre los datos que sí llegaron a la DB.
    # El campaign_id en v1 es el placeholder fijo 'PMAX_PREPAGAS'.
    # Para el rango de fechas, usamos el día más antiguo de leads procesados
    # en este run — si no se puede determinar, usamos los últimos 7 días.
    #
    # Los stored procedures compute_mofu_facts y compute_bofu_facts son
    # idempotentes (UPSERT). Re-ejecutarlos no rompe datos.
    #
    # Después, calcular_conversion_rates (ya llamado dentro de compute_facts)
    # actualiza las 3 tasas en bofu_facts con denominadores correctos.
    from datetime import date as _date, timedelta as _timedelta
    facts_result: dict = {}
    try:
        # Determinar rango de fechas: últimos 7 días como cobertura segura.
        # Cubre el lag del CSV + posibles re-importaciones de días anteriores.
        date_end = _date.today().strftime('%Y-%m-%d')
        date_start = (_date.today() - _timedelta(days=6)).strftime('%Y-%m-%d')

        campaign_id = yaml_config.get('reporting', {}).get(
            'campaign_id', 'PMAX_PREPAGAS'
        )
        campaign_name = yaml_config.get('reporting', {}).get(
            'campaign_name', 'PMAX Prevención Salud'
        )

        logger.info(
            "Calculando MOFU + BOFU facts — cliente=%s rango=%s a %s campaign_id=%s",
            client_slug, date_start, date_end, campaign_id,
        )

        facts_result = writer.compute_facts(
            client_slug=client_slug,
            date_start=date_start,
            date_end=date_end,
            campaign_id=campaign_id,
            campaign_name=campaign_name,
        )
        logger.info(
            "Facts actualizadas — mofu_rows=%s bofu_rows=%s",
            facts_result.get('mofu_rows', 0),
            facts_result.get('bofu_rows', 0),
        )
    except Exception as exc:
        logger.error("Error calculando facts: %s", exc, exc_info=True)
        facts_result = {'mofu_rows': 0, 'bofu_rows': 0, 'error': str(exc)}

    # 11.5 Espejo de mofu_facts + bofu_facts a Google Sheets (Fase 3 — sprint 1.7)
    # Solo se ejecuta si hay GOOGLE_SHEETS_SA_JSON disponible y la Sheet del
    # cliente está configurada en clients/{slug}.yaml. No bloquea el pipeline
    # si falla — los datos siguen vivos en Supabase.
    mirror_result: dict = {}
    sheet_id = yaml_config.get('sheets', {}).get('output_id', '')
    if (
        sheet_id
        and not str(sheet_id).startswith('REEMPLAZAR')
        and 'GOOGLE_SHEETS_SA_JSON' in os.environ
    ):
        try:
            mirror_result = writer.mirror_facts_to_sheets(
                client_slug=client_slug,
                spreadsheet_id=str(sheet_id),
                mirror_tofu=False,
                mirror_mofu=True,
                mirror_bofu=True,
            )
            logger.info(
                "Mirror sheets actualizado — mofu=%s bofu=%s",
                mirror_result.get('mofu', {}),
                mirror_result.get('bofu', {}),
            )
        except Exception as exc:
            logger.error("Error en mirror_facts_to_sheets: %s", exc, exc_info=True)
            mirror_result = {'error': str(exc)}
    elif 'GOOGLE_SHEETS_SA_JSON' not in os.environ:
        logger.info("Mirror sheets — GOOGLE_SHEETS_SA_JSON ausente, se omite.")
    else:
        logger.info("Mirror sheets — sheets.output_id no configurado, se omite.")

    # 12. Resumen
    summary = {
        'run_id': run_id,
        'client_slug': client_slug,
        'csv_file': Path(csv_path).name,
        'total': counters['total'],
        'new': counters['new'],
        'updated': counters['updated'],
        'skipped': counters['skipped'],
        'errors': len(counters['errors']),
        'soft_deleted_stages': sync_result.get('soft_deleted', 0),
        'facts_mofu_rows': facts_result.get('mofu_rows', 0),
        'facts_bofu_rows': facts_result.get('bofu_rows', 0),
        'facts_error': facts_result.get('error'),
        'sheets_mirror': mirror_result,
    }

    print('\n=== RESUMEN DEL PIPELINE ===')
    print(json.dumps(summary, indent=2, ensure_ascii=False))

    if counters['errors']:
        logger.warning("Hubo %d errores. Ver log detallado arriba.", len(counters['errors']))
        sys.exit(1)


def _get_closed_sections(supabase, client_slug: str) -> set[str]:
    """Obtiene los nombres de secciones marcadas como is_closed_won en Supabase.

    Se usa para determinar si un lead está "cerrado" al escribir el monetario.

    Args:
        supabase: Instancia del cliente Supabase.
        client_slug: Slug del cliente.

    Returns:
        Set de nombres de sección con is_closed_won=true.
    """
    resp = (
        supabase.table('funnel_stages')
        .select('section_name')
        .eq('client_slug', client_slug)
        .eq('is_closed_won', True)
        .eq('is_active', True)
        .execute()
    )
    return {row['section_name'] for row in (resp.data or [])}


if __name__ == '__main__':
    main()
