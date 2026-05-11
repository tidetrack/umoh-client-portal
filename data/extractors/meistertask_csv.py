"""
data/extractors/meistertask_csv.py
-----------------------------------
Extractor de CSV exportado desde MeisterTask.

Responsabilidades:
- Inferir el client_slug desde el path del CSV (penúltimo segmento).
- Abrir el CSV con encoding utf-8-sig para descartar el BOM que MeisterTask
  incluye al exportar (el BOM provoca que la primera columna sea '\\ufeffid'
  en lugar de 'id').
- Devolver el par (client_slug, rows) donde rows es una lista de dicts crudos
  con las claves originales del CSV.

Convención de path multi-tenant:
    Meistertask/{client_slug}/project-export-{id}.csv
    → client_slug = Path(csv_path).parts[-2]

El slug se valida contra el patrón [a-z][a-z0-9_-]+ para detectar rutas
accidentales (ej: pasar el archivo desde la raíz en lugar de dentro de la
carpeta del cliente).
"""

from __future__ import annotations

import csv
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

_SLUG_PATTERN = re.compile(r'^[a-z][a-z0-9_-]+$')


def extract_csv(csv_path: str) -> tuple[str, list[dict]]:
    """Lee el CSV de MeisterTask y devuelve (client_slug, filas crudas).

    El client_slug se infiere del penúltimo segmento del path:
        Meistertask/prepagas/project-export-789143.csv → 'prepagas'

    El archivo se abre con encoding='utf-8-sig' para descartar el BOM.
    Cada fila es un dict con las claves del encabezado del CSV.

    Args:
        csv_path: Ruta absoluta o relativa al CSV exportado de MeisterTask.

    Returns:
        Tupla (client_slug, rows). rows es una lista de dicts crudos;
        los valores son strings tal como vienen del CSV (sin parsear fechas
        ni números — eso lo hace el normalizador).

    Raises:
        ValueError: si el directorio padre del CSV no matchea el patrón de slug.
        FileNotFoundError: si csv_path no existe.
    """
    path = Path(csv_path).resolve()

    if not path.exists():
        raise FileNotFoundError(f"CSV no encontrado: {path}")

    # Inferir client_slug desde el penúltimo segmento del path.
    # path.parts = ('/', ..., 'Meistertask', 'prepagas', 'project-export-789143.csv')
    client_slug = path.parent.name

    if not _SLUG_PATTERN.match(client_slug):
        raise ValueError(
            f"El directorio padre del CSV '{client_slug}' no es un slug válido "
            f"([a-z][a-z0-9_-]+). Asegurate de que el CSV esté en "
            f"Meistertask/{{client_slug}}/project-export-*.csv"
        )

    rows: list[dict] = []
    with open(path, encoding='utf-8-sig', newline='') as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            rows.append(dict(row))

    logger.info(
        "CSV leído: %s | client_slug=%s | filas=%d",
        path.name,
        client_slug,
        len(rows),
    )

    return client_slug, rows
