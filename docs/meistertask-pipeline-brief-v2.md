# Brief Técnico v2: Pipeline MeisterTask → Supabase → Dashboard MOFU/BOFU
**Proyecto:** UMOH Client Portal — Prevención Salud (cliente activo `prepagas`)
**Fecha:** 2026-04-27
**Versión:** 2.0 (reemplaza al brief v1 — el v1 queda como referencia histórica en `meistertask-pipeline-brief.md`)
**Propósito:** Documento de relevamiento revisado para implementar el pipeline MOFU/BOFU. Incorpora las 8 decisiones residuales que cerró Franco el 2026-04-27 más los 10 cambios obligatorios solicitados por el CEO/PM.

---

## Cambios respecto a v1 (resumen)

1. **Multi-tenant día 1**: `client_slug TEXT NOT NULL` en todas las tablas; PKs compuestas `(client_slug, external_id)` donde corresponda.
2. **Tabla `funnel_stages`** nueva (sexta tabla): cache vivo de la configuración del funnel por cliente, con seed inicial para `prepagas`.
3. **`funnel_stage` deja de ser columna de `leads`**: pasa a derivarse vía JOIN con `funnel_stages`. Se crea vista `leads_with_stage`.
4. **Queries de métricas reescritas**: en lugar de hardcodear nombres de sección, usan flags semánticos (`is_high_intent`, `is_closed_won`, `is_typified`).
5. **Sincronización YAML → Supabase**: `config/clients/{slug}.yaml` lleva una clave `funnel_stages:` que se sincroniza a la tabla en cada run.
6. **Email semanal de update_requirements**: notificación a los asesores con leads cerrados sin monto.
7. **Whitelist de keywords** para parser de montos en `comments`: 8 palabras confirmadas (Voluntario, Monotributista, Obligatorio, cotizó, cuota, final, cerró, cerrado).
8. **Nueva estructura de archivos**: `supabase/migrations/`, `data/connections/supabase_client.py`, `config/clients/prepagas.yaml` con clave `funnel_stages:`.
9. **CSVs multi-tenant por path**: `Meistertask/{client_slug}/project-export-*.csv`. El extractor infiere el slug desde el path.
10. **Resolución de los 8 riesgos técnicos** identificados en la corrida anterior (BOM, encoding, dedup de cotizaciones, refresh de `requires_update`, dedup de history, etc.).

---

## 1. Contexto y objetivo

MeisterTask es el CRM de los asesores comerciales de Prevención Salud. Se usa como pipeline de ventas con columnas (secciones) que representan etapas del funnel.

Objetivos del sistema:

1. Exportar el proyecto MeisterTask (CSV) de forma semanal a `Meistertask/{client_slug}/project-export-*.csv`.
2. Procesar y normalizar esos datos en Python.
3. Hacer upsert en Supabase con dedup por `(client_slug, meistertask_id)`.
4. Sincronizar la configuración del funnel desde YAML a la tabla `funnel_stages` en cada run.
5. Exponer los datos a los endpoints PHP del dashboard (`/api/mofu`, `/api/bofu`).
6. Mostrar en el dashboard BOFU un panel de "Requerimientos de actualización" señalando ventas cerradas sin valor monetario.
7. Enviar un email semanal a los asesores responsables con la lista de leads que requieren actualización (decisión C.4).

Cron semanal vía GitHub Actions: lunes 09:00 UTC = 06:00 Argentina.

---

## 2. Fuente de datos: estructura del CSV de MeisterTask

### Path multi-tenant del CSV

El CSV vive en `Meistertask/{client_slug}/project-export-*.csv`. Para el cliente actual:

```
Meistertask/
├── prepagas/
│   └── project-export-789143.csv
├── meistertask-pipeline-brief.md            (v1, histórico)
└── meistertask-pipeline-brief-v2.md         (este documento)
```

El extractor infiere el `client_slug` desde el segundo segmento del path. Esto evita tener que pasar el slug por argumento y mantiene la convención multi-tenant en disco.

> **Migración del archivo actual**: el CSV `Meistertask/project-export-789143.csv` debe moverse a `Meistertask/prepagas/project-export-789143.csv` antes del primer run del pipeline.

### Campos del CSV exportado

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | ID único de la tarea en MeisterTask. **Forma parte de la PK compuesta junto a `client_slug`.** |
| `token` | string | Token único alternativo (ej: `z1xdNlJM`) |
| `name` | string | Título con formato `NOMBRE // CANAL // TELÉFONO` (separadores `//` o `/`) |
| `notes` | string | Descripción de la tarjeta. Contiene plan, cápitas y cuota mensual cuando el asesor lo completó correctamente. |
| `created_at` | ISO 8601 UTC | Fecha de creación del lead |
| `updated_at` | ISO 8601 UTC | Última modificación. **Usar para decidir UPDATE vs SKIP.** |
| `status` | integer | 1 = abierta, 18 = cerrada/completada |
| `due_date` | ISO 8601 UTC | Fecha de seguimiento (próxima acción comercial) |
| `status_updated_at` | ISO 8601 UTC | Cuándo cambió el status numérico |
| `assignee` | string | Nombre del asesor responsable |
| `section` | string | Etapa actual del pipeline (ver sección 3) |
| `project` | string | Siempre "Gestión comercial \| Leads PMAX" |
| `tags` | string | Tags separados por `; ` (ver sección 4) |
| `checklists` | string | Checklist de documentación en formato texto |
| `comments` | string | Historial de actividad: `Nombre (timestamp): texto; Nombre (timestamp): texto` |

### Parsing del campo `name`

```python
import re
TITLE_PATTERN = re.compile(r'^(.+?)\s*[/]{1,2}\s*(.+?)\s*[/]{1,2}\s*(.+)$')
```

Resultado: `nombre`, `canal`, `telefono`. Valores normalizados de `canal`: `form`, `whatsapp`, `propio`, `referido`, `campaña`.

### Parsing del campo `notes` (datos monetarios)

Patrones de extracción:

```python
MONEY_PATTERNS = [
    re.compile(r'(?:Valor|Precio|Cuota)[^:\$]*:?\s*\$?\s*([\d\.,]+)', re.I),
    re.compile(r'cotizaci[oó]n:?\s*\$?\s*([\d\.,]+)', re.I),
    re.compile(r'\$\s*([\d\.,]+)'),
]
CAPITAS_PATTERN = re.compile(r'(\d+)\s+c[aá]pitas?', re.I)
PLAN_PATTERN = re.compile(r'[Pp]lan\s+([\w\d]+)')
```

Si `notes` no tiene monto, buscar en `comments` aplicando la **whitelist de keywords** (sección 7).

---

## 3. Pipeline del tablero comercial (secciones)

A diferencia de v1, las secciones del funnel **NO se hardcodean en el schema** ni en las queries. Se configuran por cliente en `config/clients/{slug}.yaml` y se sincronizan a la tabla `funnel_stages` (sección 6.6).

### Definición de "lead de alta intención"
Cualquier lead cuya sección tenga `is_high_intent = true` en `funnel_stages`, o que tenga el tag `Cotizado`.

### Definición de "lead tipificado"
Cualquier lead que tenga al menos uno de los tags de segmento (`Voluntario`, `Monotributista`, `Obligatorio`). Equivalente a: el lead está en una sección con `is_typified = true` **o** tiene un tag de tipificación.

### Definición de "venta cerrada"
Cualquier lead cuya sección tenga `is_closed_won = true`.

---

## 4. Sistema de etiquetas (tags)

Cada tarea debería tener exactamente 4 categorías de tags. Parsear el campo `tags` con split en `; `.

| Categoría | Valores observados | Normalización |
|-----------|-------------------|---------------|
| **Tipificación** | `Voluntario`, `Monotributista`, `Obligatorio` | → `tipification` |
| **Mes del lead** | `Enero 26`, `Febrero 26`, `Marzo 26`, `Abril 26`, `Junio 26`, … | → `lead_month` (regex `([A-Za-z]+ \d{2})`) |
| **Prepaga** | `Prevs` (=Prevención Salud), `Premedic`, `Sancor`, `OMINT`, `Avalian`, `Andes` | → `prepaga` |
| **Operatoria** | `Operatoria 50/30/15`, `Operatoria 45/30/15`, `Operatoria 30%`, `Cotizado` | → `operatoria` o flag `has_cotizado_tag` |

> **Decisión C.8**: tags hardcodeados en v1. Cuando llegue el segundo cliente, se evalúa migrar el sistema de tags a una columna `JSONB` configurable por cliente.

---

## 5. Asesores comerciales (cliente `prepagas`)

| Nombre | Tareas asignadas |
|--------|-----------------|
| Roco Giudice | 46 |
| Cristian Alejandro Giudice | 29 |
| Fernando Giudice | 27 |
| umoh crew | 2 (admin/test) |

---

## 6. Schema de Supabase (multi-tenant)

### 6.1 Tabla `leads`

```sql
CREATE TABLE IF NOT EXISTS leads (
  client_slug       TEXT NOT NULL,
  meistertask_id    BIGINT NOT NULL,
  token             TEXT NOT NULL,

  -- Parsed from title
  nombre            TEXT,
  canal             TEXT,
  telefono          TEXT,
  name_raw          TEXT,

  -- Content
  notes             TEXT,
  checklists        TEXT,

  -- Pipeline
  section           TEXT NOT NULL,
  -- NOTA: funnel_stage NO vive acá. Se deriva vía JOIN con funnel_stages
  --       (vista leads_with_stage). Esto permite cambiar la clasificación
  --       de una sección sin reimportar todo el dataset.

  -- Assignment
  assignee          TEXT,

  -- Dates
  lead_created_at   TIMESTAMPTZ,
  lead_updated_at   TIMESTAMPTZ,
  due_date          TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ,
  mt_status         INTEGER,

  -- Tags (raw + categorized)
  tags_raw          TEXT,
  tipification      TEXT,
  lead_month        TEXT,
  prepaga           TEXT,
  operatoria        TEXT,
  has_cotizado_tag  BOOLEAN DEFAULT false,

  -- Import tracking
  last_imported_at  TIMESTAMPTZ DEFAULT NOW(),
  import_run_id     UUID,

  PRIMARY KEY (client_slug, meistertask_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_section        ON leads(client_slug, section);
CREATE INDEX IF NOT EXISTS idx_leads_assignee       ON leads(client_slug, assignee);
CREATE INDEX IF NOT EXISTS idx_leads_tipification   ON leads(client_slug, tipification);
CREATE INDEX IF NOT EXISTS idx_leads_lead_month     ON leads(client_slug, lead_month);
```

**Justificación de la PK compuesta `(client_slug, meistertask_id)`**: el `meistertask_id` no es globalmente único entre clientes (cada cuenta de MeisterTask tiene su propio rango de IDs). Una PK simple sobre `meistertask_id` rompe en cuanto entra el segundo cliente. La PK compuesta es la forma natural multi-tenant; los índices secundarios siempre llevan `client_slug` adelante para que el planner los use bien.

> **Trade-off considerado**: alternativa era PK `id BIGSERIAL` con `UNIQUE(client_slug, meistertask_id)`. Descartada porque agrega un campo sintético sin valor (las FKs apuntan a `meistertask_id` desde el resto del sistema) y duplica el costo de los índices.

### 6.2 Tabla `lead_section_history`

```sql
CREATE TABLE IF NOT EXISTS lead_section_history (
  id                BIGSERIAL PRIMARY KEY,
  client_slug       TEXT NOT NULL,
  meistertask_id    BIGINT NOT NULL,
  section_from      TEXT,
  section_to        TEXT NOT NULL,
  detected_at       TIMESTAMPTZ DEFAULT NOW(),
  import_run_id     UUID,

  FOREIGN KEY (client_slug, meistertask_id)
    REFERENCES leads(client_slug, meistertask_id),

  -- Evita duplicar el mismo cambio si el pipeline corre 2x sin cambios reales
  UNIQUE (client_slug, meistertask_id, section_from, section_to, detected_at)
);

CREATE INDEX IF NOT EXISTS idx_history_lead       ON lead_section_history(client_slug, meistertask_id);
CREATE INDEX IF NOT EXISTS idx_history_section_to ON lead_section_history(client_slug, section_to);
```

### 6.3 Tabla `lead_monetary`

```sql
CREATE TABLE IF NOT EXISTS lead_monetary (
  id                BIGSERIAL PRIMARY KEY,
  client_slug       TEXT NOT NULL,
  meistertask_id    BIGINT NOT NULL,

  -- Plan info
  plan_code         TEXT,
  capitas           INTEGER,

  -- Pricing
  cuota_mensual     NUMERIC(12,2),
  descuento_pct     NUMERIC(5,2),
  precio_final      NUMERIC(12,2),

  -- Metadata
  data_source       TEXT,        -- 'notes_parsed' | 'comments_parsed' | 'manual'
  is_closed         BOOLEAN DEFAULT false,
  requires_update   BOOLEAN DEFAULT false,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (client_slug, meistertask_id)
    REFERENCES leads(client_slug, meistertask_id),

  -- Dedup de cotizaciones múltiples por (lead, plan_code, capitas)
  UNIQUE (client_slug, meistertask_id, plan_code, capitas)
);

CREATE INDEX IF NOT EXISTS idx_monetary_lead            ON lead_monetary(client_slug, meistertask_id);
CREATE INDEX IF NOT EXISTS idx_monetary_requires_update ON lead_monetary(client_slug, requires_update) WHERE requires_update = true;
```

### 6.4 Tabla `lead_activity`

```sql
CREATE TABLE IF NOT EXISTS lead_activity (
  id                BIGSERIAL PRIMARY KEY,
  client_slug       TEXT NOT NULL,
  meistertask_id    BIGINT NOT NULL,
  author            TEXT,
  body              TEXT,
  commented_at      TIMESTAMPTZ,
  extracted_amount  NUMERIC(12,2),

  FOREIGN KEY (client_slug, meistertask_id)
    REFERENCES leads(client_slug, meistertask_id),

  -- Dedup de comentarios por (lead, autor, timestamp, hash del body)
  UNIQUE (client_slug, meistertask_id, author, commented_at, md5(coalesce(body,'')))
);

CREATE INDEX IF NOT EXISTS idx_activity_lead   ON lead_activity(client_slug, meistertask_id);
CREATE INDEX IF NOT EXISTS idx_activity_author ON lead_activity(client_slug, author);
```

### 6.5 Tabla `import_runs`

```sql
CREATE TABLE IF NOT EXISTS import_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_slug     TEXT NOT NULL,
  run_at          TIMESTAMPTZ DEFAULT NOW(),
  source_file     TEXT,
  total_tasks     INTEGER,
  new_tasks       INTEGER,
  updated_tasks   INTEGER,
  skipped_tasks   INTEGER,
  errors          JSONB
);

CREATE INDEX IF NOT EXISTS idx_runs_client ON import_runs(client_slug, run_at DESC);
```

### 6.6 Tabla `funnel_stages` (NUEVA — configuración del funnel por cliente)

```sql
CREATE TABLE IF NOT EXISTS funnel_stages (
  client_slug      TEXT NOT NULL,
  section_name     TEXT NOT NULL,
  funnel_stage     TEXT NOT NULL CHECK (funnel_stage IN ('tofu','mofu','bofu','excluded')),
  is_high_intent   BOOLEAN DEFAULT false,
  is_closed_won    BOOLEAN DEFAULT false,
  is_typified      BOOLEAN DEFAULT false,
  is_lost          BOOLEAN DEFAULT false,
  is_incubating    BOOLEAN DEFAULT false,
  is_active        BOOLEAN DEFAULT true,   -- soft-delete: true=vigente, false=huérfana del YAML
  display_order    INTEGER,

  PRIMARY KEY (client_slug, section_name)
);

CREATE INDEX IF NOT EXISTS idx_funnel_stage  ON funnel_stages(client_slug, funnel_stage);
CREATE INDEX IF NOT EXISTS idx_funnel_active ON funnel_stages(client_slug, is_active) WHERE is_active = true;
```

**Flags semánticos completos (8)**:
- `is_high_intent`: lead listo para cerrar (Cotizados, En Auditoria, Prioritarios)
- `is_closed_won`: venta cerrada (Ventas Ganadas)
- `is_typified`: lead con segmento asignado
- `is_lost` (NUEVO): lead que descartó la oferta. Reemplaza el hardcoding de `section='No prospera'` en métricas.
- `is_incubating` (NUEVO): lead con potencial pero no listo (A futuro, Mes que viene). Reemplaza el hardcoding por nombre de sección.
- `is_active` (NUEVO): soft-delete. `false` cuando una sección desaparece del YAML pero queda en la tabla. Las queries de métricas filtran `WHERE is_active = true`.

#### Seed inicial para `client_slug = 'prepagas'`

```sql
INSERT INTO funnel_stages (client_slug, section_name, funnel_stage, is_high_intent, is_closed_won, is_typified, is_lost, is_incubating, is_active, display_order)
VALUES
  ('prepagas', 'Inbox',              'mofu',     false, false, false, false, false, true,  1),
  ('prepagas', 'Nuevo',              'mofu',     false, false, false, false, false, true,  2),
  ('prepagas', 'Prioritarios',       'mofu',     true,  false, true,  false, false, true,  3),
  ('prepagas', 'Para Hoy',           'mofu',     false, false, true,  false, false, true,  4),
  ('prepagas', 'Procesando',         'mofu',     false, false, true,  false, false, true,  5),
  ('prepagas', 'Contactados',        'mofu',     false, false, true,  false, false, true,  6),
  ('prepagas', 'Cotizados',          'mofu',     true,  false, true,  false, false, true,  7),
  ('prepagas', 'En Auditoria',       'mofu',     true,  false, true,  false, false, true,  8),
  ('prepagas', 'Mes que viene',      'mofu',     false, false, true,  false, true,  true,  9),
  ('prepagas', 'A futuro',           'mofu',     false, false, true,  false, true,  true, 10),
  ('prepagas', 'Ventas Ganadas',     'bofu',     false, true,  true,  false, false, true, 11),
  ('prepagas', 'No prospera',        'mofu',     false, false, true,  true,  false, true, 12),
  ('prepagas', 'Erroneos',           'excluded', false, false, false, false, false, true, 13),
  ('prepagas', 'Tareas Finalizadas', 'excluded', false, false, false, false, false, true, 14)
ON CONFLICT (client_slug, section_name) DO UPDATE SET
  funnel_stage   = EXCLUDED.funnel_stage,
  is_high_intent = EXCLUDED.is_high_intent,
  is_closed_won  = EXCLUDED.is_closed_won,
  is_typified    = EXCLUDED.is_typified,
  is_lost        = EXCLUDED.is_lost,
  is_incubating  = EXCLUDED.is_incubating,
  is_active      = EXCLUDED.is_active,
  display_order  = EXCLUDED.display_order;
```

> **Decisión C.3 — camino (c)**: la verdad vive en `config/clients/prepagas.yaml`. Este seed es el bootstrap inicial; en cada run del pipeline el script reescribe la tabla desde el YAML (sección 12).
>
> **Decisión 2026-04-27 (Franco aprobó)**: agregar flags `is_lost` e `is_incubating` para eliminar el hardcoding residual en las métricas MOFU. La sección 9 ya no referencia `'No prospera'`, `'A futuro'` ni `'Mes que viene'` por nombre.

### 6.7 Vista `leads_with_stage` (deriva el funnel via JOIN)

```sql
CREATE OR REPLACE VIEW leads_with_stage AS
SELECT
  l.*,
  COALESCE(fs.funnel_stage, 'excluded') AS funnel_stage,
  COALESCE(fs.is_high_intent, false)    AS is_high_intent,
  COALESCE(fs.is_closed_won, false)     AS is_closed_won,
  COALESCE(fs.is_typified, false)       AS is_typified,
  COALESCE(fs.is_lost, false)           AS is_lost,
  COALESCE(fs.is_incubating, false)     AS is_incubating
FROM leads l
LEFT JOIN funnel_stages fs
  ON fs.client_slug  = l.client_slug
 AND fs.section_name = l.section
 AND fs.is_active    = true;   -- soft-delete: secciones huérfanas no participan en métricas
```

> **Por qué vista y no columna**: si el cliente reclasifica una sección (ej: mover "En Auditoria" de MOFU a BOFU), no hace falta reimportar nada. Solo se actualiza el YAML, se sincroniza la tabla, y la vista refleja el cambio inmediatamente.
>
> **Filtro `is_active = true`**: si una sección se borra del YAML, el sync la marca `is_active=false` (soft-delete). El LEFT JOIN no la matchea, los leads de esa sección caen a `funnel_stage='excluded'` por COALESCE — se preservan en la tabla `leads` pero salen de las métricas hasta que el operador decida qué hacer con ellos.

---

## 7. Whitelist de keywords para el parser de montos en `comments`

Cuando el campo `notes` no tiene monto, el parser busca en cada comentario del campo `comments`. Para evitar falsos positivos (ej: `$50` en un mensaje casual), el parser **solo extrae un monto si el comentario contiene al menos una de estas 8 keywords**:

```python
MONEY_KEYWORD_WHITELIST = {
    'voluntario',
    'monotributista',
    'obligatorio',
    'cotizó',
    'cuota',
    'final',
    'cerró',
    'cerrado',
}
```

Match case-insensitive. Si aparece alguna palabra → extraer `$X`. Si no → ignorar el comentario para fines monetarios (sigue siendo válido para `lead_activity`).

> **Decisión C.6**: si aparecen falsos positivos o falsos negativos en producción, ampliamos la lista. Mantener un log de extracciones para auditar.

---

## 8. Lógica de upsert (dedup, multi-tenant)

```python
def upsert_lead(row: dict, client_slug: str, supabase, run_id: str) -> str:
    mt_id = int(row['id'])
    new_updated_at = parse_datetime(row['updated_at'])

    existing = (
        supabase.table('leads')
        .select('client_slug, meistertask_id, section, lead_updated_at')
        .eq('client_slug', client_slug)
        .eq('meistertask_id', mt_id)
        .maybe_single()
        .execute()
    )

    if existing.data is None:
        record = build_lead_record(row, client_slug, run_id)
        supabase.table('leads').insert(record).execute()
        insert_section_history(client_slug, mt_id, None, row['section'], run_id)
        return 'new'

    db_updated_at = parse_datetime(existing.data['lead_updated_at'])

    if new_updated_at <= db_updated_at:
        return 'skipped'

    old_section = existing.data['section']
    new_section = row['section']

    supabase.table('leads').update(build_lead_record(row, client_slug, run_id))\
        .eq('client_slug', client_slug).eq('meistertask_id', mt_id).execute()

    if old_section != new_section:
        insert_section_history(client_slug, mt_id, old_section, new_section, run_id)

    return 'updated'
```

---

## 9. Métricas MOFU (queries reescritas)

Todas las queries van contra la vista `leads_with_stage`. Filtran siempre por `client_slug`. Cero hardcoding de nombres de sección — todas las métricas operan sobre flags semánticos.

| Métrica | Query |
|---------|-------|
| `total_leads` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND funnel_stage IN ('mofu','bofu')` |
| `cost_per_lead` | TOFU spend / total_leads (vía Google Sheets `tofu_raw`) |
| `typification_rate` | `COUNT(*) WHERE is_typified = true / total_leads * 100` |
| `high_intent_leads` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND (is_high_intent = true OR has_cotizado_tag = true)` |
| `leads_contactado` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND is_typified = true AND is_high_intent = false AND is_closed_won = false AND is_lost = false AND is_incubating = false` |
| `leads_cotizado` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND (is_high_intent = true OR has_cotizado_tag = true)` (el tag `Cotizado` sigue siendo transversal — refuerza la métrica pero no es la única fuente) |
| `leads_a_futuro` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND is_incubating = true` |
| `leads_no_prospera` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND is_lost = true` |
| `leads_en_emision` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND is_closed_won = true` (proxy: cerradas en proceso de emisión) |
| `leads_erroneo` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND funnel_stage='excluded'` |
| `segment_voluntario` | `WHERE tipification = 'Voluntario'` |
| `segment_monotributista` | `WHERE tipification = 'Monotributista'` |
| `segment_obligatorio` | `WHERE tipification = 'Obligatorio'` |

> **Hardcoding residual eliminado (decisión 2026-04-27)**: las métricas `leads_no_prospera` y `leads_a_futuro` ahora usan los flags `is_lost` e `is_incubating` en lugar de matchear por `section_name`. El único hardcoding semántico que sobrevive son los valores de `tipification` (`'Voluntario'`, `'Monotributista'`, `'Obligatorio'`) — son tags del CRM y forman parte del contrato canónico, no del schema de Supabase.
>
> **Si llega un segundo cliente con otras categorías**: el flag se mantiene (`is_lost`, `is_incubating`), solo cambia qué secciones lo tienen activado en el YAML del cliente. La query no se toca.

### Filtros de período

Los leads se filtran por `lead_month` (tag) para comparar cohortes mes a mes. **Fallback (decisión C.7)**: cuando falta el tag de mes, usar `lead_created_at`.

---

## 10. Métricas BOFU (queries reescritas)

Solo leads con `is_closed_won = true`. El revenue sale de `lead_monetary.precio_final` (o `cuota_mensual` si no hay descuento).

| Métrica | Query |
|---------|-------|
| `closed_sales` | `SELECT COUNT(*) FROM leads_with_stage WHERE client_slug=$1 AND is_closed_won = true` |
| `total_revenue` | `SELECT SUM(precio_final) FROM lead_monetary lm JOIN leads_with_stage l USING (client_slug, meistertask_id) WHERE l.client_slug=$1 AND lm.is_closed = true AND l.is_closed_won = true` |
| `avg_ticket` | `total_revenue / closed_sales` |
| `conversion_rate` | `closed_sales / total_leads` |
| `capitas_closed` | `SELECT SUM(capitas) FROM lead_monetary lm JOIN leads_with_stage l USING (client_slug, meistertask_id) WHERE l.client_slug=$1 AND lm.is_closed = true AND l.is_closed_won = true` |
| `avg_ticket_capita` | `total_revenue / capitas_closed` |
| `sales_voluntario` | `SUM(precio_final) WHERE l.tipification = 'Voluntario' AND l.is_closed_won = true` |
| `sales_monotributista` | idem `'Monotributista'` |
| `sales_obligatorio` | idem `'Obligatorio'` |

### Ranking de vendedores

```sql
SELECT
  assignee,
  COUNT(*) FILTER (WHERE is_closed_won)                        AS sales,
  SUM(lm.precio_final) FILTER (WHERE is_closed_won)            AS revenue,
  AVG(lm.precio_final) FILTER (WHERE is_closed_won)            AS avg_ticket,
  COUNT(*)                                                      AS leads_total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_closed_won) / NULLIF(COUNT(*),0), 2) AS close_rate
FROM leads_with_stage l
LEFT JOIN lead_monetary lm
  ON lm.client_slug = l.client_slug
 AND lm.meistertask_id = l.meistertask_id
 AND lm.is_closed = true
WHERE l.client_slug = $1
GROUP BY assignee
ORDER BY revenue DESC NULLS LAST;
```

---

## 11. Panel "Requerimientos de actualización" (BOFU dashboard) + Email semanal

### 11.1 Card en BOFU (decisión C.4 — frontend)

Card con badge rojo y tabla expandible:
- Título: "Datos incompletos"
- Badge: número de ventas sin monto
- Tabla: ID de tarea (link a MeisterTask), nombre del lead, asesor asignado, antigüedad
- Link: `https://www.meistertask.com/app/task/{meistertask_id}`

### 11.2 Email semanal a asesores (decisión C.4 — backend)

Después del cron del lunes, si hay leads con `requires_update = true`, enviar email a cada asesor responsable con su lista filtrada.

**Mecanismo recomendado para v1**: GitHub Action con step `dawidd6/action-send-mail` usando SMTP de Hostinger (ya configurado para el dominio del cliente). Cero costo adicional, cero infra nueva.

```yaml
- name: Notify assignees
  if: success() && env.HAS_UPDATE_REQUIREMENTS == 'true'
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.hostinger.com
    server_port: 465
    secure: true
    username: ${{ secrets.SMTP_USER }}
    password: ${{ secrets.SMTP_PASS }}
    subject: "[UMOH] Leads con datos pendientes — ${{ env.RUN_DATE }}"
    to: ${{ env.ASSIGNEE_EMAILS }}
    from: "UMOH Crew <reportes@umohcrew.com>"
    html_body: file://reports/update_requirements.html
```

**Alternativa v2**: Resend (API simple, free tier 3.000 mails/mes). Migrar cuando haya 3+ clientes y SMTP de Hostinger se vuelva limitante.

**Mapping asesor → email**: tabla nueva en Supabase (no incluida en v1 — se hardcodea en `config/clients/prepagas.yaml` bajo `assignee_emails:`). Se promueve a tabla cuando lleguen 3+ clientes.

**Nuevos secrets de GitHub**:
| Secret | Descripción |
|--------|-------------|
| `SMTP_USER` | Usuario SMTP de Hostinger (ej: `reportes@umohcrew.com`) |
| `SMTP_PASS` | Contraseña SMTP |

---

## 12. Sincronización YAML → Supabase (`funnel_stages`)

### 12.1 Estructura del YAML

`config/clients/prepagas.yaml` agrega la clave `funnel_stages:`:

```yaml
client_id: prepagas
active: true
platforms:
  google_ads:
    enabled: true
    customer_id: "123-456-7890"
  meta:
    enabled: true
    ad_account_id: "act_123456789"
sheets:
  output_id: "{SHEET_ID}"
reporting:
  timezone: "America/Argentina/Mendoza"
  currency: "ARS"
  lead_statuses: [Contactado, No Prospera, A Futuro, En Emisión, Erróneo]
  segments: [Voluntario, Monotributista, Obligatorio]

# NUEVO en v2:
funnel_stages:
  - section: "Inbox"              { stage: mofu,     high_intent: false, closed_won: false, typified: false, lost: false, incubating: false, order: 1  }
  - section: "Nuevo"              { stage: mofu,     high_intent: false, closed_won: false, typified: false, lost: false, incubating: false, order: 2  }
  - section: "Prioritarios"       { stage: mofu,     high_intent: true,  closed_won: false, typified: true,  lost: false, incubating: false, order: 3  }
  - section: "Para Hoy"           { stage: mofu,     high_intent: false, closed_won: false, typified: true,  lost: false, incubating: false, order: 4  }
  - section: "Procesando"         { stage: mofu,     high_intent: false, closed_won: false, typified: true,  lost: false, incubating: false, order: 5  }
  - section: "Contactados"        { stage: mofu,     high_intent: false, closed_won: false, typified: true,  lost: false, incubating: false, order: 6  }
  - section: "Cotizados"          { stage: mofu,     high_intent: true,  closed_won: false, typified: true,  lost: false, incubating: false, order: 7  }
  - section: "En Auditoria"       { stage: mofu,     high_intent: true,  closed_won: false, typified: true,  lost: false, incubating: false, order: 8  }
  - section: "Mes que viene"      { stage: mofu,     high_intent: false, closed_won: false, typified: true,  lost: false, incubating: true,  order: 9  }
  - section: "A futuro"           { stage: mofu,     high_intent: false, closed_won: false, typified: true,  lost: false, incubating: true,  order: 10 }
  - section: "Ventas Ganadas"     { stage: bofu,     high_intent: false, closed_won: true,  typified: true,  lost: false, incubating: false, order: 11 }
  - section: "No prospera"        { stage: mofu,     high_intent: false, closed_won: false, typified: true,  lost: true,  incubating: false, order: 12 }
  - section: "Erroneos"           { stage: excluded, high_intent: false, closed_won: false, typified: false, lost: false, incubating: false, order: 13 }
  - section: "Tareas Finalizadas" { stage: excluded, high_intent: false, closed_won: false, typified: false, lost: false, incubating: false, order: 14 }

assignee_emails:
  "Roco Giudice":               "roco@..."
  "Cristian Alejandro Giudice": "cristian@..."
  "Fernando Giudice":           "fernando@..."
```

### 12.2 Flujo de sincronización (con soft-delete automático)

```python
def sync_funnel_stages_from_yaml(client_slug: str, yaml_config: dict, supabase) -> dict:
    """
    Sincroniza funnel_stages desde YAML del cliente. Idempotente.
    Se ejecuta al inicio de cada run del pipeline, antes del upsert de leads.

    Comportamiento:
    1. UPSERT de cada sección presente en el YAML con is_active=true.
    2. Soft-delete: cualquier sección que exista en la tabla para este client_slug
       y NO esté en el YAML actual queda marcada is_active=false. NO se borra
       físicamente — los leads históricos asignados a esa sección se preservan.

    Returns dict con conteo: {'upserted': N, 'soft_deleted': M}
    """
    yaml_sections = {entry['section'] for entry in yaml_config.get('funnel_stages', [])}

    # 1) UPSERT secciones del YAML (todas con is_active=true)
    rows = []
    for entry in yaml_config.get('funnel_stages', []):
        rows.append({
            'client_slug':    client_slug,
            'section_name':   entry['section'],
            'funnel_stage':   entry['stage'],
            'is_high_intent': entry.get('high_intent', False),
            'is_closed_won':  entry.get('closed_won', False),
            'is_typified':    entry.get('typified', False),
            'is_lost':        entry.get('lost', False),
            'is_incubating':  entry.get('incubating', False),
            'is_active':      True,
            'display_order':  entry.get('order'),
        })
    if rows:
        supabase.table('funnel_stages').upsert(
            rows, on_conflict='client_slug,section_name'
        ).execute()

    # 2) Soft-delete: secciones en DB pero NO en YAML → is_active=false
    existing = (
        supabase.table('funnel_stages')
        .select('section_name')
        .eq('client_slug', client_slug)
        .eq('is_active', True)
        .execute()
    )
    db_sections = {row['section_name'] for row in (existing.data or [])}
    orphaned = db_sections - yaml_sections

    soft_deleted = 0
    for section in orphaned:
        supabase.table('funnel_stages').update({'is_active': False})\
            .eq('client_slug', client_slug)\
            .eq('section_name', section)\
            .execute()
        soft_deleted += 1

    return {'upserted': len(rows), 'soft_deleted': soft_deleted}
```

> **Soft-delete (decisión 2026-04-27)**: si una sección desaparece del YAML, el sync hace `UPDATE funnel_stages SET is_active=false`, NO `DELETE`. Justificación:
>
> 1. **Preservar leads históricos**: si un lead estaba asignado a una sección que se borra del YAML, no debería perder contexto.
> 2. **Reversibilidad**: si fue un error tipográfico en el YAML, el siguiente run reactiva la sección sin pérdida.
> 3. **Auditabilidad**: queda en la tabla con `is_active=false` para trazabilidad.
> 4. **Métricas limpias**: la vista `leads_with_stage` filtra `is_active=true` en el JOIN, los leads de secciones huérfanas caen automáticamente a `funnel_stage='excluded'` (vía COALESCE) y no contaminan los conteos.
>
> **Cuándo borrar físicamente**: solo manualmente, vía SQL ad-hoc, después de validar que no hay leads asociados (`SELECT COUNT(*) FROM leads WHERE client_slug=$1 AND section=$2`).

---

## 13. Pipeline Python: estructura de archivos (v2)

```
data/
├── connections/
│   └── supabase_client.py           # singleton: lee SUPABASE_URL + SUPABASE_SERVICE_KEY de .env
├── extractors/
│   └── meistertask_csv.py           # lector + parser; infiere client_slug del path
├── normalizers/
│   └── meistertask.py               # normaliza al schema de Supabase
└── loaders/
    └── supabase_writer.py           # upsert con dedup multi-tenant

scripts/
├── run_meistertask_pipeline.py      # orquestador end-to-end
└── sync_funnel_stages.py            # sincroniza YAML → tabla funnel_stages

supabase/
├── migrations/
│   ├── 001_initial.sql              # leads, lead_section_history, lead_monetary, lead_activity, import_runs
│   ├── 002_funnel_stages.sql        # tabla funnel_stages + seed prepagas
│   ├── 003_views.sql                # vista leads_with_stage
│   └── 004_rls_policies.sql         # RLS y políticas service_role / anon
└── seeds/
    └── prepagas_funnel_stages.sql   # bootstrap inicial (idempotente con ON CONFLICT)

config/clients/
└── prepagas.yaml                    # ahora incluye funnel_stages: y assignee_emails:

Meistertask/
└── prepagas/
    └── project-export-789143.csv    # CSV multi-tenant por path

reports/                              # NUEVO — usado por el step de email
└── update_requirements.html.tmpl

.github/workflows/
└── meistertask_weekly.yml           # cron lunes 09:00 UTC
```

### Workflow GitHub Actions (extracto)

```yaml
name: MeisterTask → Supabase (weekly)

on:
  schedule:
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install supabase python-dotenv pyyaml
      - name: Run pipeline
        env:
          SUPABASE_URL:           ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY:   ${{ secrets.SUPABASE_SERVICE_KEY }}
          CLIENT_SLUG:            prepagas
          MEISTERTASK_CSV_PATH:   Meistertask/prepagas/project-export-789143.csv
        run: python scripts/run_meistertask_pipeline.py
      - name: Build update-requirements report
        run: python scripts/build_update_report.py
      - name: Send email if pending
        if: env.HAS_UPDATE_REQUIREMENTS == 'true'
        uses: dawidd6/action-send-mail@v3
        with: { ... }
```

---

## 14. Endpoints PHP `/api/mofu` y `/api/bofu`

> **Decisión C.5 — Opción B**: en v1, Supabase y Google Sheets corren en paralelo. Los endpoints PHP siguen leyendo de Sheets. Supabase se usa para análisis avanzado (ranking de vendedores, panel de update_requirements). En v2 se migra a Opción A (Supabase como fuente única).

### Cambios mínimos en v1
- `/api/bofu` agrega la clave `data_quality.update_requirements` leyendo de Supabase.
- `/api/mofu` y `/api/bofu` siguen sirviendo el resto de los KPIs desde Sheets.

### Migración a Opción A (v2)
Reemplazar la lectura de `mofu_input` y `bofu_input` de Sheets por queries SQL contra `leads_with_stage`. La tabla `tofu_raw` (Google Ads) sigue en Sheets hasta que se migre TOFU también.

---

## 15. Resolución de los 8 riesgos técnicos

| # | Riesgo | Solución concreta | Archivo donde se resuelve |
|---|--------|-------------------|---------------------------|
| 1 | BOM (Byte Order Mark) en CSVs de MeisterTask: `row['﻿id']` en lugar de `row['id']` | Abrir el CSV con `encoding='utf-8-sig'` (descarta BOM automáticamente) | `data/extractors/meistertask_csv.py` |
| 2 | Encoding inconsistente (acentos rotos en Postgres) | Forzar `utf-8` en lectura y escritura; validar que el cliente Supabase use `utf-8` por default | `data/extractors/meistertask_csv.py`, `data/connections/supabase_client.py` |
| 3 | Cotizaciones múltiples por lead duplicadas en `lead_monetary` | UNIQUE `(client_slug, meistertask_id, plan_code, capitas)` + UPSERT con `on_conflict=...` | `supabase/migrations/001_initial.sql`, `data/loaders/supabase_writer.py` |
| 4 | `requires_update` queda obsoleto cuando el asesor completa el monto | Recalcular en cada run: `UPDATE lead_monetary SET requires_update = (precio_final IS NULL OR cuota_mensual IS NULL) WHERE client_slug = $1` antes de cerrar el run | `data/loaders/supabase_writer.py` |
| 5 | `lead_section_history` se duplica si el pipeline corre 2x sin cambios reales | UNIQUE `(client_slug, meistertask_id, section_from, section_to, detected_at)` + chequeo previo a insertar (solo insertar si la última fila para ese lead tiene un `section_to` distinto) | `supabase/migrations/001_initial.sql`, `data/loaders/supabase_writer.py` |
| 6 | `lead_activity` se duplica al reimportar el mismo CSV (los comentarios siempre vienen completos) | UNIQUE `(client_slug, meistertask_id, author, commented_at, md5(body))` + UPSERT | `supabase/migrations/001_initial.sql`, `data/loaders/supabase_writer.py` |
| 7 | El parser de comments extrae montos falsos (ej: `$50` en charla casual) | Whitelist de 8 keywords (sección 7); solo extraer si match | `data/normalizers/meistertask.py` |
| 8 | `funnel_stage` desincronizado entre clientes si se hardcodea en código | Tabla `funnel_stages` + vista `leads_with_stage` + sync desde YAML al inicio de cada run | `supabase/migrations/002_funnel_stages.sql`, `scripts/sync_funnel_stages.py` |

---

## 16. Secrets de GitHub requeridos (v2)

| Secret | Descripción | Origen |
|--------|-------------|--------|
| `SUPABASE_URL` | `https://piwtcnyoatpeqdimyiaf.supabase.co` | Confirmado por Franco |
| `SUPABASE_SERVICE_KEY` | Service role key (escritura) | Ya configurado |
| `SMTP_USER` | Usuario SMTP de Hostinger | A configurar |
| `SMTP_PASS` | Password SMTP | A configurar |

---

## 17. Estado actual y próximos pasos

### Decisiones cerradas (2026-04-27, residuales C.1–C.8)
- **C.1**: Supabase URL y service key confirmadas; `.env.example` ya creado.
- **C.2**: Multi-tenant día 1 con `client_slug` en todas las tablas.
- **C.3**: Stages configurables vía `config/clients/{slug}.yaml` → tabla `funnel_stages` (camino c).
- **C.4**: Card en BOFU + email semanal a los asesores.
- **C.5**: Opción B en v1 (Supabase + Sheets en paralelo); migración a A en v2.
- **C.6**: Whitelist de 8 keywords para parser de montos en comments.
- **C.7**: Fallback de `lead_month` → `lead_created_at`.
- **C.8**: Tags hardcodeados en v1; JSONB cuando entre el segundo cliente.

### Pendiente para Claude Code (Fases 1+)
1. **Fase 1**: Aplicar migraciones `001_initial.sql`, `002_funnel_stages.sql`, `003_views.sql`, `004_rls_policies.sql` en Supabase. Crear `data/connections/supabase_client.py`. (`@supabase-architect`)
2. **Fase 2**: Implementar extractor + normalizer + loader Python. (`@pipeline-engineer`)
3. **Fase 3**: GitHub Actions weekly cron + step de email. (`@pipeline-engineer`)
4. **Fase 4**: Endpoints PHP — agregar `data_quality.update_requirements` en `/api/bofu`. (`@dashboard-builder`)
5. **Fase 5**: Card "Datos incompletos" en BOFU del dashboard. (`@dashboard-builder` + `@ui-ux-pro`)
6. **Fase 6**: Cierre — changelog, docs, deploy. (`@auto-changelog` + `@github-docs` + `@github-sync`)

---

**Fin del brief v2.**
