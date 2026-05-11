"""
scripts/sync_funnel_stages.py
-------------------------------
Sincroniza la configuración de funnel_stages desde el YAML del cliente
hacia la tabla `funnel_stages` en Supabase.

Comportamiento (idempotente):
    1. UPSERT de cada sección presente en el YAML con is_active=true.
    2. Soft-delete: secciones que están en la tabla pero no en el YAML
       quedan marcadas con is_active=false (NO se borran físicamente).
       Sus leads históricos se preservan pero caen a funnel_stage='excluded'
       en la vista leads_with_stage (decisión 2026-04-27).

Puede ejecutarse de forma autónoma o llamarse como módulo desde el orquestador.

Uso directo:
    python scripts/sync_funnel_stages.py [--client prepagas]
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv

# Resolver imports del proyecto desde cualquier directorio de ejecución
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from data.connections.supabase_client import get_client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s — %(message)s',
)
logger = logging.getLogger(__name__)


def sync_funnel_stages_from_yaml(
    client_slug: str,
    yaml_config: dict,
    supabase,
) -> dict:
    """Sincroniza funnel_stages desde el YAML del cliente. Idempotente.

    Se ejecuta al inicio de cada run del pipeline, antes del upsert de leads.

    Pasos:
    1. UPSERT de cada sección del YAML con is_active=true.
    2. SELECT de todas las secciones activas en DB para este cliente.
    3. Soft-delete (is_active=false) de las que están en DB pero no en YAML.

    Args:
        client_slug: Slug del cliente (ej: 'prepagas').
        yaml_config: Dict parseado del YAML del cliente. Debe tener la
                     clave 'funnel_stages' con lista de secciones.
        supabase: Instancia del cliente Supabase.

    Returns:
        Dict {'upserted': N, 'soft_deleted': M}.
    """
    funnel_entries = yaml_config.get('funnel_stages', [])
    yaml_sections = {entry['section'] for entry in funnel_entries}

    # 1) UPSERT de todas las secciones del YAML con is_active=true
    rows = []
    for entry in funnel_entries:
        rows.append({
            'client_slug': client_slug,
            'section_name': entry['section'],
            'funnel_stage': entry['stage'],
            'is_high_intent': bool(entry.get('high_intent', False)),
            'is_closed_won': bool(entry.get('closed_won', False)),
            'is_typified': bool(entry.get('typified', False)),
            'is_lost': bool(entry.get('lost', False)),
            'is_incubating': bool(entry.get('incubating', False)),
            'is_active': True,
            'display_order': entry.get('order'),
        })

    if rows:
        supabase.table('funnel_stages').upsert(
            rows,
            on_conflict='client_slug,section_name',
        ).execute()
        logger.info(
            "funnel_stages upserted: cliente=%s secciones=%d",
            client_slug, len(rows),
        )

    # 2) Obtener secciones activas en DB para este cliente
    existing_resp = (
        supabase.table('funnel_stages')
        .select('section_name')
        .eq('client_slug', client_slug)
        .eq('is_active', True)
        .execute()
    )
    db_sections = {row['section_name'] for row in (existing_resp.data or [])}

    # 3) Soft-delete de secciones huérfanas (en DB pero no en YAML)
    orphaned = db_sections - yaml_sections
    soft_deleted = 0
    for section in orphaned:
        supabase.table('funnel_stages').update({'is_active': False})\
            .eq('client_slug', client_slug)\
            .eq('section_name', section)\
            .execute()
        soft_deleted += 1
        logger.info(
            "Sección soft-deleted: cliente=%s sección='%s'",
            client_slug, section,
        )

    logger.info(
        "sync_funnel_stages completo: cliente=%s upserted=%d soft_deleted=%d",
        client_slug, len(rows), soft_deleted,
    )
    return {'upserted': len(rows), 'soft_deleted': soft_deleted}


def load_client_yaml(client_slug: str, config_dir: Optional[str] = None) -> dict:
    """Carga el YAML del cliente desde clients/{slug}.yaml.

    Args:
        client_slug: Slug del cliente.
        config_dir: Directorio raíz del proyecto. Por defecto, la raíz del repo.

    Returns:
        Dict con el contenido del YAML.

    Raises:
        FileNotFoundError: si el YAML no existe.
    """
    root = Path(config_dir) if config_dir else _ROOT
    yaml_path = root / 'clients' / f'{client_slug}.yaml'

    if not yaml_path.exists():
        raise FileNotFoundError(
            f"Config del cliente no encontrada: {yaml_path}. "
            f"Verificar que clients/{client_slug}.yaml existe."
        )

    with open(yaml_path, encoding='utf-8') as fh:
        return yaml.safe_load(fh)


def main() -> None:
    """Punto de entrada para ejecución directa del script."""
    load_dotenv()

    parser = argparse.ArgumentParser(description='Sincroniza funnel_stages desde YAML → Supabase')
    parser.add_argument('--client', default='prepagas', help='Slug del cliente (default: prepagas)')
    args = parser.parse_args()

    client_slug = args.client
    yaml_config = load_client_yaml(client_slug)
    supabase = get_client()

    result = sync_funnel_stages_from_yaml(client_slug, yaml_config, supabase)
    print(f"sync_funnel_stages: {result}")


if __name__ == '__main__':
    main()
