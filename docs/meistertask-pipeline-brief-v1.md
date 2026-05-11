# Brief Técnico: Pipeline MeisterTask → Supabase → Dashboard MOFU/BOFU
**Proyecto:** UMOH Client Portal — Prevención Salud  
**Fecha:** 2026-04-27  
**Propósito:** Documento de relevamiento para que Claude Code construya el sistema completo de procesamiento de leads desde MeisterTask hasta el dashboard de performance.

---

## 1. Contexto y objetivo

MeisterTask es el CRM de los asesores comerciales de Prevención Salud. Se usa como pipeline de ventas con columnas (secciones) que representan etapas del funnel. El objetivo de este sistema es:

1. Exportar el proyecto MeisterTask (CSV o JSON) de forma semanal.
2. Procesar y normalizar esos datos en Python.
3. Hacer upsert en Supabase (con lógica de dedup: tareas nuevas = INSERT, tareas actualizadas = UPDATE, sin cambios = SKIP).
4. Exponer los datos a los endpoints PHP del dashboard (`/api/mofu` y `/api/bofu`).
5. Mostrar en el dashboard BOFU un panel de "Requerimientos de actualización" señalando las ventas cerradas que no tienen valor monetario registrado (con ID de MeisterTask para que el asesor pueda ir a corregirlo).

La rutina debe ejecutarse una vez por semana vía GitHub Actions cron.

---

## 2. Fuente de datos: estructura del CSV de MeisterTask

### Campos del CSV exportado

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | integer | ID único de la tarea en MeisterTask. **Clave primaria para dedup.** |
| `token` | string | Token único alternativo (ej: `z1xdNlJM`) |
| `name` | string | Título con formato `NOMBRE // CANAL // TELÉFONO` (separadores `//` o `/`) |
| `notes` | string | Descripción de la tarjeta. Contiene plan, cápitas y cuota mensual cuando el asesor lo completó correctamente. |
| `created_at` | ISO 8601 UTC | Fecha de creación del lead en el sistema |
| `updated_at` | ISO 8601 UTC | Última modificación. **Usar para decidir UPDATE vs SKIP.** |
| `status` | integer | 1 = abierta, 18 = cerrada/completada |
| `due_date` | ISO 8601 UTC | Fecha de seguimiento (próxima acción comercial) |
| `status_updated_at` | ISO 8601 UTC | Cuándo cambió el status numérico |
| `assignee` | string | Nombre del asesor responsable |
| `section` | string | Etapa actual del pipeline (ver sección 3) |
| `project` | string | Siempre "Gestión comercial | Leads PMAX" |
| `tags` | string | Tags separados por `; ` (ver sección 4) |
| `checklists` | string | Checklist de documentación en formato texto |
| `comments` | string | Historial de actividad: `Nombre (timestamp): texto; Nombre (timestamp): texto` |

### Parsing del campo `name`

El título sigue el formato `NOMBRE // CANAL // TELÉFONO`. Separadores reales observados: `//` y `/`. Parsear con regex:

```python
import re
TITLE_PATTERN = re.compile(r'^(.+?)\s*[/]{1,2}\s*(.+?)\s*[/]{1,2}\s*(.+)$')
```

Resultado: `nombre`, `canal`, `telefono`.

**Valores de canal observados** (106 tareas):
- `form` / `formulario` / `formulario y whatsapp` → normalizar a `form`
- `wsp` / `whatsapp` → normalizar a `whatsapp`
- `propio` → contacto propio del asesor (no vino de campaña)
- `referido` → referido de cliente existente
- `campaña` → entrada directa de campaña

### Parsing del campo `notes` (datos monetarios)

El manual exige que la descripción incluya:
- `Plan: [código]` → ej: `A2`, `A4`, `ION`, `Plan 200`
- `Cantidad de cápitas: [N]` o mencionado en texto libre
- `Cuota del plan: $[monto]` → valor mensual

Patrones de extracción (cubrir variaciones reales observadas):

```python
MONEY_PATTERNS = [
    re.compile(r'(?:Valor|Precio|Cuota)[^:\$]*:?\s*\$?\s*([\d\.,]+)', re.I),
    re.compile(r'cotizaci[oó]n:?\s*\$?\s*([\d\.,]+)', re.I),
    re.compile(r'\$\s*([\d\.,]+)'),
]
CAPITAS_PATTERN = re.compile(r'(\d+)\s+c[aá]pitas?', re.I)
PLAN_PATTERN = re.compile(r'[Pp]lan\s+([\w\d]+)')
```

**Importante:** Si `notes` no tiene monto, buscar también en `comments`. Un caso real (ID `223513837`) tiene el monto en los comentarios: `"Voluntario $114255"`.

---

## 3. Pipeline del tablero comercial (secciones)

### Etapas y su clasificación funnel

| Sección | Descripción | Funnel | Contar en métricas |
|---------|-------------|--------|--------------------|
| `Inbox` | Entrada automática de leads | MOFU | Sí — total leads |
| `Nuevo` | Variante de Inbox | MOFU | Sí — total leads |
| `Prioritarios` | Cierre inminente, docs en tránsito | MOFU | Sí — alta intención |
| `Para Hoy` | Sprint diario del asesor | MOFU | Sí — activo |
| `Procesando` | Pipeline activo recurrente | MOFU | Sí — activo |
| `Contactados` | Contacto establecido | MOFU | Sí — tipificados |
| `Cotizados` | Propuesta formal enviada | MOFU | Sí — alta intención |
| `En Auditoria` | Aprobación médica pendiente | MOFU | Sí — alta intención (pre-BOFU) |
| `Mes que viene` | Intención para próximo mes | MOFU | Sí — incubadora |
| `A futuro` | Lead válido con barrera temporal | MOFU | Sí — incubadora |
| `Ventas Ganadas` | Alta completada | **BOFU** | Sí — venta cerrada |
| `No prospera` | Lead válido que rechazó | MOFU | Sí — perdido |
| `Erroneos` | Fuera de zona/datos falsos | EXCLUSIÓN | No — calidad de adquisición |
| `Tareas Finalizadas` | Limpieza administrativa | EXCLUSIÓN | No |

### Definición de "lead de alta intención" (para typification rate)
Cualquier tarea en: `Cotizados`, `En Auditoria`, `Prioritarios`, o con tag `Cotizado`.

### Definición de "lead tipificado"
Cualquier tarea que tenga al menos uno de los tags de segmento: `Voluntario`, `Monotributista`, `Obligatorio`.

---

## 4. Sistema de etiquetas (tags)

Cada tarea debería tener exactamente 4 categorías de tags (código de 4 colores según el manual). Parsear el campo `tags` con split en `; `.

| Categoría | Valores observados | Normalización sugerida |
|-----------|-------------------|----------------------|
| **Tipificación** | `Voluntario`, `Monotributista`, `Obligatorio` | → `tag_category = 'tipification'` |
| **Mes del lead** | `Enero 26`, `Febrero 26`, `Marzo 26`, `Abril 26`, `Junio 26`, … | → `tag_category = 'lead_month'` — detectar con regex `([A-Za-z]+ \d{2})` |
| **Prepaga** | `Prevs` (= Prevención Salud), `Premedic`, `Sancor`, `OMINT`, `Avalian`, `Andes` | → `tag_category = 'prepaga'` — normalizar `Prevs` → `Prevención Salud` |
| **Operatoria** | `Operatoria 50/30/15`, `Operatoria 45/30/15`, `Operatoria 30%`, `Cotizado` | → `tag_category = 'operatoria'` o `'status_tag'` |

**Tag `Cotizado`** (observado en 53 tareas): es un marcador de estado que indica que se envió propuesta formal, independientemente de la sección en la que esté la tarea. Es útil para MOFU.

---

## 5. Asesores comerciales

| Nombre | Tareas asignadas |
|--------|-----------------|
| Roco Giudice | 46 |
| Cristian Alejandro Giudice | 29 |
| Fernando Giudice | 27 |
| umoh crew | 2 (admin/test) |

El ranking de vendedores debe calcularse por: ventas cerradas, leads gestionados, CPL individual, tasa de cierre y ticket promedio por asesor.

---

## 6. Schema de Supabase

### Tabla 1: `leads`

Tabla principal. Una fila por tarea de MeisterTask. La clave primaria es el `id` de MeisterTask para garantizar idempotencia en los upserts.

```sql
CREATE TABLE leads (
  meistertask_id    BIGINT PRIMARY KEY,
  token             TEXT NOT NULL,
  
  -- Parsed from title
  nombre            TEXT,
  canal             TEXT,       -- form | whatsapp | propio | referido | campaña
  telefono          TEXT,
  name_raw          TEXT,       -- título original sin parsear
  
  -- Content
  notes             TEXT,
  checklists        TEXT,
  
  -- Pipeline
  section           TEXT NOT NULL,
  funnel_stage      TEXT,       -- 'mofu' | 'bofu' | 'excluded' — calculado al importar
  
  -- Assignment
  assignee          TEXT,
  
  -- Dates
  lead_created_at   TIMESTAMPTZ,
  lead_updated_at   TIMESTAMPTZ,
  due_date          TIMESTAMPTZ,
  status_updated_at TIMESTAMPTZ,
  mt_status         INTEGER,    -- 1=open, 18=closed
  
  -- Tags (raw + categorized)
  tags_raw          TEXT,
  tipification      TEXT,       -- Voluntario | Monotributista | Obligatorio | NULL
  lead_month        TEXT,       -- 'Marzo 26' | 'Abril 26' | etc.
  prepaga           TEXT,       -- Prevención Salud | Premedic | Sancor | OMINT | Avalian
  operatoria        TEXT,       -- '50/30/15' | '45/30/15' | '30%' | NULL
  has_cotizado_tag  BOOLEAN DEFAULT false,
  
  -- Import tracking
  last_imported_at  TIMESTAMPTZ DEFAULT NOW(),
  import_run_id     UUID
);

CREATE INDEX idx_leads_section ON leads(section);
CREATE INDEX idx_leads_assignee ON leads(assignee);
CREATE INDEX idx_leads_tipification ON leads(tipification);
CREATE INDEX idx_leads_lead_month ON leads(lead_month);
CREATE INDEX idx_leads_funnel ON leads(funnel_stage);
```

### Tabla 2: `lead_section_history`

Log de cambios de sección. Permite calcular tiempo en cada etapa, customer journey y velocidad del pipeline. Se inserta un registro cada vez que una tarea cambia de `section` en un import nuevo.

```sql
CREATE TABLE lead_section_history (
  id                BIGSERIAL PRIMARY KEY,
  meistertask_id    BIGINT REFERENCES leads(meistertask_id),
  section_from      TEXT,       -- NULL si es el primer registro
  section_to        TEXT NOT NULL,
  detected_at       TIMESTAMPTZ DEFAULT NOW(),  -- cuándo lo detectamos nosotros
  import_run_id     UUID
);

CREATE INDEX idx_history_lead ON lead_section_history(meistertask_id);
CREATE INDEX idx_history_section_to ON lead_section_history(section_to);
```

### Tabla 3: `lead_monetary`

Datos financieros separados de la tarea principal. Permite múltiples cotizaciones por lead, trackear cuál se cerró y mantener historial de precios. También centraliza los "requerimientos de actualización".

```sql
CREATE TABLE lead_monetary (
  id                BIGSERIAL PRIMARY KEY,
  meistertask_id    BIGINT REFERENCES leads(meistertask_id),
  
  -- Plan info
  plan_code         TEXT,       -- A2, A4, ION, Plan 200, etc.
  capitas           INTEGER,    -- cantidad de beneficiarios
  
  -- Pricing
  cuota_mensual     NUMERIC(12,2),   -- precio de lista
  descuento_pct     NUMERIC(5,2),    -- % de descuento de operatoria
  precio_final      NUMERIC(12,2),   -- cuota_mensual * (1 - descuento_pct/100)
  
  -- Metadata
  data_source       TEXT,       -- 'notes_parsed' | 'comments_parsed' | 'manual'
  is_closed         BOOLEAN DEFAULT false,  -- true = esta es la cotización que se cerró
  requires_update   BOOLEAN DEFAULT false,  -- true = está en Ventas Ganadas pero falta monto
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monetary_lead ON lead_monetary(meistertask_id);
CREATE INDEX idx_monetary_requires_update ON lead_monetary(requires_update) WHERE requires_update = true;
```

### Tabla 4: `lead_activity`

Comentarios parseados del campo `comments`. Permite trazar la bitácora de cada negociación y, en algunos casos, extraer montos que quedaron en comentarios en lugar de en la descripción.

```sql
CREATE TABLE lead_activity (
  id                BIGSERIAL PRIMARY KEY,
  meistertask_id    BIGINT REFERENCES leads(meistertask_id),
  author            TEXT,
  body              TEXT,
  commented_at      TIMESTAMPTZ,
  extracted_amount  NUMERIC(12,2)  -- NULL si no hay monto en el comentario
);

CREATE INDEX idx_activity_lead ON lead_activity(meistertask_id);
CREATE INDEX idx_activity_author ON lead_activity(author);
```

### Tabla 5: `import_runs`

Log de cada ejecución del pipeline. Permite auditar qué cambió en cada run.

```sql
CREATE TABLE import_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at          TIMESTAMPTZ DEFAULT NOW(),
  source_file     TEXT,       -- nombre del CSV exportado
  total_tasks     INTEGER,
  new_tasks       INTEGER,
  updated_tasks   INTEGER,
  skipped_tasks   INTEGER,
  errors          JSONB
);
```

---

## 7. Lógica de upsert (dedup)

Al procesar cada fila del CSV:

```python
def upsert_lead(row, supabase_client, run_id):
    mt_id = int(row['id'])  # BOM en el CSV: usar row['﻿id']
    new_updated_at = parse_datetime(row['updated_at'])
    
    existing = supabase_client.table('leads')\
        .select('meistertask_id, section, lead_updated_at')\
        .eq('meistertask_id', mt_id)\
        .maybe_single()\
        .execute()
    
    if existing.data is None:
        # INSERT — tarea nueva
        supabase_client.table('leads').insert(build_lead_record(row, run_id)).execute()
        insert_section_history(mt_id, None, row['section'], run_id)
        return 'new'
    
    db_updated_at = parse_datetime(existing.data['lead_updated_at'])
    
    if new_updated_at <= db_updated_at:
        # SKIP — sin cambios
        return 'skipped'
    
    # UPDATE — tarea modificada
    old_section = existing.data['section']
    new_section = row['section']
    
    supabase_client.table('leads')\
        .update(build_lead_record(row, run_id))\
        .eq('meistertask_id', mt_id)\
        .execute()
    
    if old_section != new_section:
        # Registrar cambio de sección en el historial
        insert_section_history(mt_id, old_section, new_section, run_id)
    
    return 'updated'
```

---

## 8. Métricas MOFU

Todas las tareas con `funnel_stage = 'mofu'` (excluye `Erroneos` y `Tareas Finalizadas`).

| Métrica | Cálculo |
|---------|---------|
| `total_leads` | COUNT(*) WHERE funnel_stage IN ('mofu', 'bofu') |
| `cost_per_lead` | TOFU spend / total_leads (vía JOIN con tabla tofu_raw de Google Sheets) |
| `typification_rate` | COUNT(*) WHERE tipification IS NOT NULL / total_leads |
| `high_intent_leads` | COUNT(*) WHERE section IN ('Cotizados', 'En Auditoria', 'Prioritarios') OR has_cotizado_tag = true |
| `leads_contactado` | COUNT(*) WHERE section IN ('Contactados', 'Prioritarios', 'Para Hoy', 'Procesando') |
| `leads_cotizado` | COUNT(*) WHERE section = 'Cotizados' OR has_cotizado_tag = true |
| `leads_a_futuro` | COUNT(*) WHERE section IN ('A futuro', 'Mes que viene') |
| `leads_en_emision` | COUNT(*) WHERE section = 'En Auditoria' |
| `leads_no_prospera` | COUNT(*) WHERE section = 'No prospera' |
| `leads_erroneo` | COUNT(*) WHERE section = 'Erroneos' |
| `segment_voluntario` | COUNT(*) WHERE tipification = 'Voluntario' |
| `segment_monotributista` | COUNT(*) WHERE tipification = 'Monotributista' |
| `segment_obligatorio` | COUNT(*) WHERE tipification = 'Obligatorio' |

### Filtros de período

Los leads se filtran por `lead_month` (tag) para comparar cohortes mes a mes. El campo `lead_created_at` se usa como fallback cuando falta el tag de mes.

---

## 9. Métricas BOFU

Solo tareas con `section = 'Ventas Ganadas'`. El revenue se calcula a partir de `lead_monetary.precio_final` (o `cuota_mensual` si no hay descuento registrado).

| Métrica | Cálculo |
|---------|---------|
| `closed_sales` | COUNT(*) WHERE section = 'Ventas Ganadas' |
| `total_revenue` | SUM(lead_monetary.precio_final) WHERE is_closed = true |
| `avg_ticket` | total_revenue / closed_sales |
| `conversion_rate` | closed_sales / total_leads |
| `capitas_closed` | SUM(lead_monetary.capitas) WHERE is_closed = true |
| `avg_ticket_capita` | total_revenue / capitas_closed |
| `sales_voluntario` | SUM(precio_final) WHERE leads.tipification = 'Voluntario' |
| `sales_monotributista` | SUM(precio_final) WHERE leads.tipification = 'Monotributista' |
| `sales_obligatorio` | SUM(precio_final) WHERE leads.tipification = 'Obligatorio' |

### Ranking de vendedores
Agregar todas las métricas BOFU con GROUP BY `leads.assignee`.

---

## 10. Panel "Requerimientos de actualización" (BOFU dashboard)

Este panel es **crítico** para la integridad del cálculo de revenue. Debe aparecer en la vista BOFU del dashboard con una alerta visual cuando hay ventas sin monto registrado.

### Estado actual del export (2026-04-27): 21 ventas cerradas

**Con datos monetarios completos (12):**
| ID MeisterTask | Lead | Monto registrado |
|----------------|------|-----------------|
| 222844699 | Laura Quinteros | $105.910 |
| 222853066 | Mayra Jayat | $83.265 |
| 222852781 | Pamela Lenciana | $79.412 |
| 222852406 | Antonella / Joseph | $149.528 |
| 222852630 | Antonella Pietrelli | $199.059 |
| 222853461 | Mariela Diaz (hijas) | $68.261 (por cápita) |
| 222852518 | Erica Echavarria | $105.331 |
| 222852825 | Javier Vera | $133.975 |
| 223859776 | Samuel Marquez | $78.115 |
| 223513837 | Cecilia Interlandi | $114.255 (en comentarios) |
| 224074916 | Candela Masman | $89.832 |

**Sin datos monetarios — REQUIEREN ACTUALIZACIÓN (9):**

| ID MeisterTask | Lead | Asignado | Acción requerida |
|----------------|------|----------|-----------------|
| 223013998 | Agustín Molina Beriau | Cristian A. Giudice | Agregar plan, cápitas y cuota en descripción |
| 223455255 | José Colombatti | Cristian A. Giudice | Agregar plan, cápitas y cuota en descripción |
| 223006406 | Camila Cornejo | Cristian A. Giudice | Agregar plan, cápitas y cuota en descripción |
| 223456715 | Matías Sirvent Cañas | Cristian A. Giudice | Agregar plan, cápitas y cuota en descripción |
| 223793544 | Daniela Bruna | Cristian A. Giudice | Agregar plan, cápitas y cuota en descripción |
| 223736706 | Malena Ozollo | Cristian A. Giudice | Agregar plan, cápitas y cuota en descripción |
| 223455462 | Ignacio Valot / Bettiana | Cristian A. Giudice | Agregar plan, cápitas y cuota en descripción |
| 223741021 | Oriana Gonzalez | Cristian A. Giudice | Agregar plan, cápitas y cuota en descripción |
| 222851499 | Jorge Muñoz | Roco Giudice | Solo dice "Individual Monotributista", falta monto |
| 224193216 | Ana Pittari | Roco Giudice | Solo dice "Matrimonio + 2 Hijos", falta monto |

El campo `requires_update = true` en `lead_monetary` marca estas tareas. El endpoint `/api/bofu` debe devolver este listado en una clave `update_requirements`.

---

## 11. Pipeline Python: estructura de archivos

```
extractors/
└── meistertask_csv.py     # Lector y parser del CSV exportado

normalizers/
└── meistertask.py         # Normaliza datos al schema de Supabase

loaders/
└── supabase_writer.py     # Upsert en Supabase con lógica de dedup

scripts/
└── run_meistertask_pipeline.py  # Orchestrador: lee CSV → normaliza → upsert → genera report

.github/workflows/
└── meistertask_weekly.yml  # Cron semanal: lunes 6am ARG (9:00 UTC)
```

### Workflow GitHub Actions

```yaml
name: MeisterTask → Supabase (weekly)

on:
  schedule:
    - cron: '0 9 * * 1'   # Lunes 09:00 UTC = 06:00 Argentina
  workflow_dispatch:        # Run manual desde GitHub Actions

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: pip install supabase python-dotenv
      
      - name: Run pipeline
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          MEISTERTASK_CSV_PATH: Meistertask/project-export-789143.csv
        run: python scripts/run_meistertask_pipeline.py
```

**Nota importante:** El CSV debe reemplazarse en el repo con el export actualizado antes de que corra el cron, o bien el pipeline debe descargarlo automáticamente vía MeisterTask API (Fase futura). Por ahora: export manual semanal → commit → workflow.

---

## 12. Endpoint PHP `/api/mofu` y `/api/bofu` — cambios requeridos

Los endpoints actuales leen de Google Sheets. Deben ser refactorizados (o complementados) para leer de Supabase cuando el cliente es `prepagas`.

### Opción A — Supabase como fuente única (recomendada)
Reemplazar la lectura de `mofu_input` y `bofu_input` de Google Sheets por queries SQL a Supabase. La tabla `tofu_raw` sigue en Google Sheets (datos de Google Ads).

### Opción B — Mantener Google Sheets + Supabase en paralelo
El pipeline Python sigue escribiendo en Google Sheets (como está ahora) Y también en Supabase. Los endpoints PHP siguen leyendo de Sheets. Supabase se usa solo para el análisis avanzado y el panel de requerimientos.

**Recomendación:** Implementar Opción B primero (no rompe lo que ya funciona) y migrar a Opción A en una segunda fase.

---

## 13. Integración con el dashboard existente

### Nueva clave en la respuesta de `/api/bofu`

```json
{
  "revenue": 2117232.5,
  "closed_sales": 21,
  "avg_ticket": 100820.6,
  ...
  "data_quality": {
    "total_closed": 21,
    "with_amount": 12,
    "missing_amount": 9,
    "coverage_pct": 57.1,
    "update_requirements": [
      { "meistertask_id": "223013998", "lead": "Agustín Molina Beriau", "assignee": "Cristian A. Giudice" },
      { "meistertask_id": "223455255", "lead": "José Colombatti", "assignee": "Cristian A. Giudice" },
      ...
    ]
  }
}
```

### Componente visual en el dashboard (BOFU tab)

Agregar una card de alerta debajo de los KPIs principales:
- Título: "Datos incompletos"
- Badge rojo con el número de ventas sin monto
- Tabla expandible con: ID de tarea (link directo a MeisterTask), nombre del lead, asesor asignado
- Link a MeisterTask: `https://www.meistertask.com/app/task/{meistertask_id}`

---

## 14. Secrets de GitHub requeridos

| Secret | Descripción |
|--------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase (ej: `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Service role key (permisos de escritura) |

---

## 15. Estado actual y próximos pasos

### Completado
- Análisis del CSV y manual de MeisterTask
- Definición del schema de Supabase
- Identificación de los 9 leads sin datos monetarios
- Lógica de dedup y upsert definida

### Pendiente (para Claude Code)
1. Crear proyecto en Supabase y ejecutar las DDL de las tablas
2. Implementar `extractors/meistertask_csv.py`
3. Implementar `normalizers/meistertask.py`
4. Implementar `loaders/supabase_writer.py`
5. Implementar `scripts/run_meistertask_pipeline.py`
6. Crear `.github/workflows/meistertask_weekly.yml`
7. Actualizar `api/endpoints/bofu.php` para incluir `data_quality`
8. Actualizar `api/endpoints/mofu.php` para leer desde Supabase (Opción B: en paralelo con Sheets)
9. Actualizar `dashboard/assets/js/charts.js` para renderizar el panel de requerimientos de actualización
10. Cargar el CSV actual (2026-04-27) como primer import histórico

### Decisiones ya tomadas
- Historial de secciones: **Opción B** — log completo de cambios para customer journey analysis
- Datos monetarios: **Tabla separada** `lead_monetary` con múltiples cotizaciones por lead
- Clasificación de "En Auditoria": **MOFU** (alta intención, pre-BOFU)
- Integración inicial: **Opción B** (Supabase + Google Sheets en paralelo, no romper lo existente)
