"""
data/normalizers/meistertask.py
--------------------------------
Normalizador de filas crudas del CSV de MeisterTask al schema de Supabase.

Responsabilidades:
- Parsear el campo `name` en (nombre, canal, telefono).
- Parsear el campo `tags` en categorías: tipification, lead_month, prepaga,
  operatoria, has_cotizado_tag.
- Extraer datos monetarios del campo `notes` (plan, cápitas, cuotas, descuentos).
- Extraer datos monetarios del campo `comments` como fallback (con whitelist).
- Parsear los comentarios en entradas de `lead_activity`.
- Ensamblar el dict `leads` listo para upsert con todos los campos del schema.

Mapeo de campos CSV → Supabase:
    CSV `id`               → leads.meistertask_id   (BIGINT)
    CSV `token`            → leads.token
    CSV `name`             → leads.name_raw + parse_title()
    CSV `notes`            → leads.notes + parse_notes_money()
    CSV `created_at`       → leads.lead_created_at  (TIMESTAMPTZ)
    CSV `updated_at`       → leads.lead_updated_at  (TIMESTAMPTZ)
    CSV `status`           → leads.mt_status        (INTEGER)
    CSV `due_date`         → leads.due_date         (TIMESTAMPTZ, nullable)
    CSV `status_updated_at`→ leads.status_updated_at (TIMESTAMPTZ)
    CSV `assignee`         → leads.assignee
    CSV `section`          → leads.section
    CSV `tags`             → leads.tags_raw + parse_tags()
    CSV `checklists`       → leads.checklists
    CSV `comments`         → parse_comments() → lead_activity rows + monetary fallback
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Patrones de parsing
# ---------------------------------------------------------------------------

TITLE_PATTERN = re.compile(r'^(.+?)\s*[/]{1,2}\s*(.+?)\s*[/]{1,2}\s*(.+)$')

# Patrones de extracción monetaria en `notes`
MONEY_PATTERNS = [
    re.compile(r'(?:Valor|Precio|Cuota)[^:\$]*:?\s*\$?\s*([\d\.,]+)', re.I),
    re.compile(r'cotizaci[oó]n:?\s*\$?\s*([\d\.,]+)', re.I),
    re.compile(r'\$\s*([\d\.,]+)'),
]
# Soporta ambos formatos: "2 cápitas" (numero antes) y "Cápitas: 2" (numero despues).
# El segundo es el formato real del CSV de prepagas (auditoría 2026-04-29).
CAPITAS_PATTERN = re.compile(r'(?:(\d+)\s+c[aá]pitas?|c[aá]pitas?\s*:\s*(\d+))', re.I)
PLAN_PATTERN = re.compile(r'[Pp]lan\s+([\w\d]+)')
# Descuento: "- 50%" o "descuento 30%" etc.
DISCOUNT_PATTERN = re.compile(r'-\s*(\d+(?:\.\d+)?)\s*%|descuento\s+(\d+(?:\.\d+)?)\s*%', re.I)

# Whitelist de keywords para parser de montos en comments (decisión C.6)
MONEY_KEYWORD_WHITELIST: set[str] = {
    'voluntario',
    'monotributista',
    'obligatorio',
    'cotizó',
    'cotizo',
    'cuota',
    'final',
    'cerró',
    'cerro',
    'cerrado',
}

# Prepagas conocidas (hardcodeado en v1 — decisión C.8)
KNOWN_PREPAGAS: set[str] = {'Prevs', 'Premedic', 'Sancor', 'OMINT', 'Avalian', 'Andes'}

# Patrón para parsear comentarios: "Autor (timestamp): texto; Autor (timestamp): texto"
COMMENT_ENTRY_PATTERN = re.compile(
    r'([^(]+)\s*\((\d{4}-\d{2}-\d{2}T[^)]+)\)\s*:\s*(.*?)(?=\s*;\s*[^(]+\s*\(|\s*$)',
    re.DOTALL,
)


# ---------------------------------------------------------------------------
# Helpers de conversión
# ---------------------------------------------------------------------------

def _parse_datetime(value: str) -> Optional[datetime]:
    """Convierte string ISO 8601 (con 'Z' o offset) a datetime aware.

    Supabase acepta ISO 8601 con timezone. Normalizamos a UTC+0 con 'Z'
    para evitar inconsistencias de offset.

    Args:
        value: String ISO 8601 como '2026-03-26T15:32:58+00:00' o '2026-03-26T15:32:58Z'.

    Returns:
        datetime aware o None si el valor está vacío.
    """
    if not value or not value.strip():
        return None
    v = value.strip().replace('Z', '+00:00')
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        logger.warning("No se pudo parsear fecha: %r", value)
        return None


def _datetime_to_iso(dt: Optional[datetime]) -> Optional[str]:
    """Serializa datetime a string ISO 8601 UTC.

    Supabase espera strings ISO; el cliente Python convierte automáticamente
    pero siendo explícitos evitamos bugs de serialización.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _clean_money_str(raw: str) -> Optional[float]:
    """Convierte un string de monto argentino a float.

    Maneja formatos como '100.000', '1.240.500', '105.910,50'.

    Args:
        raw: String crudo extraído por regex (solo dígitos, puntos y comas).

    Returns:
        float o None si no se puede convertir.
    """
    cleaned = raw.strip().replace(' ', '')
    # Si tiene coma → formato europeo (1.234,56 → 1234.56)
    if ',' in cleaned:
        cleaned = cleaned.replace('.', '').replace(',', '.')
    else:
        # Formato argentino con puntos de miles: 100.000 → 100000
        # Pero 100.50 podría ser centavos → si hay exactamente 2 decimales post-punto, es decimal
        parts = cleaned.split('.')
        if len(parts) == 2 and len(parts[-1]) == 2 and len(parts[0]) > 0:
            # Podría ser decimal tipo 105.91 — mantener
            pass
        else:
            # Puntos son separadores de miles
            cleaned = cleaned.replace('.', '')
    try:
        return float(cleaned)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Parsers públicos
# ---------------------------------------------------------------------------

def parse_title(name: str) -> dict:
    """Parsea el campo `name` del CSV en componentes del lead.

    Formato esperado: 'NOMBRE // CANAL // TELÉFONO'
    Los separadores pueden ser '/' o '//'.

    Args:
        name: Valor crudo del campo `name` del CSV.

    Returns:
        Dict con claves: nombre, canal, telefono, name_raw.
        Si no matchea el patrón, nombre = name_raw = name; canal y telefono = None.
    """
    m = TITLE_PATTERN.match(name.strip()) if name else None
    if m:
        return {
            'nombre': m.group(1).strip(),
            'canal': m.group(2).strip(),
            'telefono': m.group(3).strip(),
            'name_raw': name,
        }
    return {
        'nombre': name.strip() if name else None,
        'canal': None,
        'telefono': None,
        'name_raw': name,
    }


def parse_tags(tags_raw: str, segments: list[str]) -> dict:
    """Categoriza los tags del CSV en campos semánticos.

    Los tags vienen separados por '; '. Se clasifican en:
    - tipification: uno de los segmentos del cliente (ej: 'Voluntario')
    - lead_month: regex '^([A-Za-z]+ \\d{2})$' (ej: 'Marzo 26')
    - prepaga: coincide con KNOWN_PREPAGAS
    - operatoria: empieza con 'Operatoria'
    - has_cotizado_tag: True si el tag literal 'Cotizado' está presente

    Args:
        tags_raw: Valor crudo del campo `tags` del CSV (puede estar vacío).
        segments: Lista de segmentos del cliente desde el YAML
                  (ej: ['Voluntario', 'Monotributista', 'Obligatorio']).

    Returns:
        Dict con claves: tipification, lead_month, prepaga, operatoria,
        has_cotizado_tag. Valores None si no se encontró la categoría.
    """
    result: dict = {
        'tipification': None,
        'lead_month': None,
        'prepaga': None,
        'operatoria': None,
        'has_cotizado_tag': False,
    }

    if not tags_raw or not tags_raw.strip():
        return result

    tags = [t.strip() for t in tags_raw.split(';') if t.strip()]
    segments_set = {s.lower(): s for s in segments}
    month_pattern = re.compile(r'^[A-Za-záéíóúÁÉÍÓÚüÜ]+ \d{2}$')

    for tag in tags:
        tag_lower = tag.lower()

        if tag == 'Cotizado':
            result['has_cotizado_tag'] = True

        elif tag_lower in segments_set:
            result['tipification'] = segments_set[tag_lower]

        elif month_pattern.match(tag):
            result['lead_month'] = tag

        elif tag in KNOWN_PREPAGAS:
            result['prepaga'] = tag

        elif tag.startswith('Operatoria'):
            result['operatoria'] = tag

    return result


def parse_notes_money(notes: str) -> Optional[dict]:
    """Extrae datos monetarios del campo `notes`.

    Busca en orden: cuota/precio/valor → cápitas → plan → descuento.
    Calcula precio_final si hay cuota + descuento.

    Args:
        notes: Texto libre del campo `notes` del CSV.

    Returns:
        Dict con claves: plan_code, capitas, cuota_mensual, descuento_pct,
        precio_final, data_source='notes_parsed'. None si no se encontró monto.
    """
    if not notes or not notes.strip():
        return None

    cuota_mensual: Optional[float] = None
    descuento_pct: Optional[float] = None
    precio_final: Optional[float] = None
    capitas: Optional[int] = None
    plan_code: Optional[str] = None

    # Buscar cuota/precio — tomar el primer match
    for pattern in MONEY_PATTERNS:
        m = pattern.search(notes)
        if m:
            val = _clean_money_str(m.group(1))
            if val is not None:
                cuota_mensual = val
                break

    if cuota_mensual is None:
        return None

    # Buscar cápitas. Pattern tiene 2 grupos alternos según formato:
    #   group(1) → "N cápitas"      (numero antes)
    #   group(2) → "Cápitas: N"     (numero despues, formato real del CSV)
    m = CAPITAS_PATTERN.search(notes)
    if m:
        cap_str = m.group(1) or m.group(2)
        if cap_str:
            capitas = int(cap_str)

    # Buscar plan
    m = PLAN_PATTERN.search(notes)
    if m:
        plan_code = m.group(1).strip()

    # Buscar descuento
    m = DISCOUNT_PATTERN.search(notes)
    if m:
        pct_str = m.group(1) or m.group(2)
        if pct_str:
            try:
                descuento_pct = float(pct_str)
            except ValueError:
                pass

    # Calcular precio_final
    if descuento_pct is not None and cuota_mensual is not None:
        precio_final = round(cuota_mensual * (1 - descuento_pct / 100), 2)
    else:
        # Si no hay descuento, el precio final es la cuota
        precio_final = cuota_mensual

    return {
        'plan_code': plan_code,
        'capitas': capitas,
        'cuota_mensual': cuota_mensual,
        'descuento_pct': descuento_pct,
        'precio_final': precio_final,
        'data_source': 'notes_parsed',
    }


def parse_comments(
    comments_raw: str,
    money_keyword_whitelist: set[str],
) -> tuple[list[dict], list[dict]]:
    """Parsea el campo `comments` en actividades y extracciones monetarias.

    El formato de comments es:
        'Autor (timestamp): texto; Autor (timestamp): texto; ...'

    Para cada comentario:
    - Siempre genera una entrada en `activities`.
    - Si contiene al menos una keyword de la whitelist Y tiene un monto '$X',
      también genera una entrada en `money_extractions`.

    body_hash se calcula como md5(body) para coincidir con la columna generada
    en Supabase. El INSERT no debe incluir body_hash explícitamente — es una
    columna generada. Se calcula acá solo para logging/debug.

    Args:
        comments_raw: Valor crudo del campo `comments` del CSV.
        money_keyword_whitelist: Set de keywords (lowercase) para filtrar comentarios
                                 con potencial monetario.

    Returns:
        Tupla (activities, money_extractions).
        - activities: lista de dicts {author, body, commented_at, extracted_amount}
        - money_extractions: subconjunto de activities que tienen extracted_amount
    """
    activities: list[dict] = []
    money_extractions: list[dict] = []

    if not comments_raw or not comments_raw.strip():
        return activities, money_extractions

    # Separar comentarios: "Autor (ts): texto; Autor (ts): texto"
    # El texto del comentario puede contener ';' dentro de la oración.
    # El separador real es '; Nombre' — split por el patrón de inicio de comentario.
    entries = _split_comments(comments_raw)

    for entry in entries:
        author, commented_at_str, body = entry
        commented_at = _parse_datetime(commented_at_str)
        body_stripped = body.strip()

        # body_hash para referencia (no se envía al INSERT)
        body_hash = hashlib.md5((body_stripped or '').encode('utf-8')).hexdigest()

        extracted_amount: Optional[float] = None

        # Buscar monto solo si hay keyword de whitelist
        body_lower = body_stripped.lower()
        has_keyword = any(kw in body_lower for kw in money_keyword_whitelist)
        if has_keyword:
            m = re.search(r'\$\s*([\d\.,]+)', body_stripped)
            if m:
                val = _clean_money_str(m.group(1))
                if val is not None:
                    extracted_amount = val

        activity: dict = {
            'author': author.strip() if author else None,
            'body': body_stripped,
            'commented_at': _datetime_to_iso(commented_at),
            'extracted_amount': extracted_amount,
            # body_hash solo para debug, NO incluir en INSERT
            '_body_hash': body_hash,
        }
        activities.append(activity)

        if extracted_amount is not None:
            money_extractions.append(activity)

    return activities, money_extractions


def _split_comments(raw: str) -> list[tuple[str, str, str]]:
    """Divide el string de comentarios en tuplas (author, timestamp, body).

    Los comentarios están separados por '; ' pero el body puede contener ';'.
    La heurística es: un nuevo comentario empieza cuando hay '; Nombre ('.

    Args:
        raw: String completo del campo `comments`.

    Returns:
        Lista de tuplas (author, timestamp_str, body).
    """
    result: list[tuple[str, str, str]] = []

    # Patrón: una entrada es 'Nombre (timestamp): cuerpo'
    # Spliteamos por la secuencia '; ' seguida de un nombre con '('
    # para manejar ';' dentro del body.
    entry_pattern = re.compile(
        r'([^(;]+?)\s*\((\d{4}-\d{2}-\d{2}T[^)]+)\)\s*:\s*'
    )

    # Buscar todas las posiciones de inicio de comentario
    starts = [(m.start(), m.end(), m.group(1), m.group(2)) for m in entry_pattern.finditer(raw)]

    for i, (start, end, author, timestamp) in enumerate(starts):
        # El body va desde 'end' hasta el comienzo del siguiente comentario
        # (o hasta '; ' + siguiente inicio, o hasta el final)
        if i + 1 < len(starts):
            next_start = starts[i + 1][0]
            # Retroceder para quitar el '; ' separador
            body_end = next_start
            # Si hay '; ' antes del próximo autor, cortar ahí
            separator_pos = raw.rfind('; ', end, next_start)
            if separator_pos != -1 and separator_pos >= end:
                body_end = separator_pos
            body = raw[end:body_end]
        else:
            body = raw[end:]

        # Limpiar posible '; ' al final del body
        body = body.rstrip('; ').rstrip()

        result.append((author.strip(), timestamp.strip(), body))

    return result


def normalize_lead(row: dict, client_slug: str, run_id: str) -> dict:
    """Ensambla un dict listo para upsert en la tabla `leads`.

    Combina los resultados de parse_title, parse_tags y los campos de fecha.
    Los datos monetarios y comentarios se procesan por separado en el loader.

    Args:
        row: Dict crudo tal como viene del CSV (todas las claves son strings).
        client_slug: Slug del cliente (ej: 'prepagas').
        run_id: UUID del import_run actual.

    Returns:
        Dict con todos los campos de la tabla `leads` listos para upsert.
        Las fechas son strings ISO 8601 (el cliente Supabase las acepta así).
    """
    title = parse_title(row.get('name', ''))

    # Los segmentos se leen desde el YAML en el orquestador y se pasan
    # como contexto, pero normalize_lead opera sin YAML para mantenerse
    # stateless. parse_tags se llama por separado con los segmentos.
    # Acá devolvemos tags_raw para que el loader los procese con el YAML.

    lead_created_at = _datetime_to_iso(_parse_datetime(row.get('created_at', '')))
    lead_updated_at = _datetime_to_iso(_parse_datetime(row.get('updated_at', '')))
    due_date = _datetime_to_iso(_parse_datetime(row.get('due_date', '')))
    status_updated_at = _datetime_to_iso(_parse_datetime(row.get('status_updated_at', '')))

    return {
        'client_slug': client_slug,
        'meistertask_id': int(row['id']),
        'token': row.get('token', ''),
        'nombre': title['nombre'],
        'canal': title['canal'],
        'telefono': title['telefono'],
        'name_raw': title['name_raw'],
        'notes': row.get('notes') or None,
        'checklists': row.get('checklists') or None,
        'section': row.get('section', ''),
        'assignee': row.get('assignee') or None,
        'lead_created_at': lead_created_at,
        'lead_updated_at': lead_updated_at,
        'due_date': due_date,
        'status_updated_at': status_updated_at,
        'mt_status': int(row.get('status', 1)),
        'tags_raw': row.get('tags') or None,
        # Tags categorizados — se llenaron antes de llamar a esta función
        # y se mezclan en el orquestador. Acá van como None; el loader los
        # reemplaza con los valores de parse_tags.
        'tipification': None,
        'lead_month': None,
        'prepaga': None,
        'operatoria': None,
        'has_cotizado_tag': False,
        'import_run_id': run_id,
    }


def normalize_lead_full(
    row: dict,
    client_slug: str,
    run_id: str,
    segments: list[str],
) -> dict:
    """Versión completa de normalize_lead que también parsea los tags.

    Llama a normalize_lead + parse_tags y mezcla los resultados.

    Args:
        row: Dict crudo del CSV.
        client_slug: Slug del cliente.
        run_id: UUID del import_run actual.
        segments: Lista de segmentos del cliente desde el YAML.

    Returns:
        Dict completo con todos los campos de `leads` incluyendo los tags
        categorizados.
    """
    lead_record = normalize_lead(row, client_slug, run_id)
    tags = parse_tags(row.get('tags', ''), segments)

    lead_record['tipification'] = tags['tipification']
    lead_record['lead_month'] = tags['lead_month']
    lead_record['prepaga'] = tags['prepaga']
    lead_record['operatoria'] = tags['operatoria']
    lead_record['has_cotizado_tag'] = tags['has_cotizado_tag']

    return lead_record
