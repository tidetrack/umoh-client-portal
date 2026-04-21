# Google Sheets API

## Qué hace

Actúa como base de datos intermedia entre el pipeline Python y los endpoints PHP. El pipeline escribe datos normalizados en Sheets; PHP los lee para servir al dashboard.

## Archivos relevantes

- `loaders/sheets_writer.py` — escribe datos desde Python
- `api/lib/sheets.php` — lee datos desde PHP

## Estructura de pestañas por cliente

| Pestaña | Quién escribe | Quién lee | Contenido |
|---------|-------------|----------|-----------|
| `tofu_raw` | Pipeline Python | PHP `tofu.php` | Datos diarios Google Ads |
| `mofu_input` | Carga manual / MeisterTask | PHP `mofu.php` | Leads por estado |
| `bofu_input` | Carga manual | PHP `bofu.php` | Ventas cerradas |

## Credencial necesaria

Service Account con rol Editor en la Sheet del cliente.

| Secret | Descripción |
|--------|-------------|
| `GOOGLE_SHEETS_SA_JSON` | JSON completo de la Service Account |

## Setup por cliente nuevo

1. Crear Google Sheet nueva para el cliente
2. Crear las pestañas `tofu_raw`, `mofu_input`, `bofu_input` con las columnas del schema
3. Compartir la Sheet con el email de la Service Account
4. Agregar el `sheet_id` en `clients/{slug}.json`

El loader crea las pestañas automáticamente si no existen.

## ID de sheet por cliente

Ver `clients/{slug}.json` → campo `sheets.output_id`.
