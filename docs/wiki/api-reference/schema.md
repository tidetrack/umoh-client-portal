# Schema canónico — TOFU / MOFU / BOFU

El schema es el contrato entre el pipeline Python, Google Sheets y los endpoints PHP. No se cambia sin actualizar los tres simultáneamente.

---

## TOFU — Top of Funnel (Awareness)

Fuente: Google Ads API, Meta Marketing API.
Granularidad: diaria, por plataforma.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `date` | string YYYY-MM-DD | Fecha del registro |
| `platform` | string | `google_ads` / `meta` |
| `impressions` | int | Impresiones totales |
| `clicks` | int | Clicks totales |
| `spend` | float | Gasto en ARS |
| `cpc` | float | Calculado: `spend / clicks` |
| `top_search_terms` | json | Array `[{term, clicks}]` |
| `channel_breakdown` | json | `{search, display, video}` en % |
| `device_breakdown` | json | `{mobile, desktop, tablet}` en % |

---

## MOFU — Middle of Funnel (Leads)

Fuente: carga manual en Google Sheets / MeisterTask API (Fase 5).
Granularidad: diaria.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `date` | string YYYY-MM-DD | Fecha del registro |
| `total_leads` | int | Total de leads del período |
| `cost_per_lead` | float | Calculado: `spend / total_leads` |
| `leads_contactado` | int | Leads contactados |
| `leads_no_prospera` | int | Descartados |
| `leads_a_futuro` | int | Para seguimiento posterior |
| `leads_en_emision` | int | En proceso de firma |
| `leads_erroneo` | int | Registros erróneos |
| `leads_alta_intencion` | int | Calculado: igual a `leads_en_emision` |
| `typification_rate` | float | Calculado: `leads_clasificados / total * 100` |
| `segment_voluntary` | int | Segmento Voluntario |
| `segment_monotributista` | int | Segmento Monotributista |
| `segment_obligatorio` | int | Segmento Obligatorio |

---

## BOFU — Bottom of Funnel (Ventas)

Fuente: carga manual en Google Sheets.
Granularidad: diaria.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `date` | string YYYY-MM-DD | Fecha del registro |
| `total_revenue` | float | Ingresos totales en ARS |
| `closed_sales` | int | Ventas cerradas |
| `avg_ticket` | float | Calculado: `revenue / sales` |
| `conversion_rate` | float | Calculado: `sales / leads * 100` |
| `capitas_closed` | int | Cápitas totales vendidas |
| `avg_ticket_capita` | float | Calculado: `revenue / capitas` |
| `sales_voluntary` | int | Ventas segmento Voluntario |
| `sales_monotributista` | int | Ventas segmento Monotributista |
| `sales_obligatorio` | int | Ventas segmento Obligatorio |

---

## Convenciones

- Moneda: ARS, sin decimales para valores grandes (`$1.240.500`)
- Fechas: siempre `YYYY-MM-DD` en base de datos y API, formateadas en el frontend
- Campos calculados: se calculan en PHP al servir el endpoint, no se almacenan en Sheets
- Campos faltantes: el endpoint retorna `0` o `null` — nunca omite el campo (rompe el frontend)
