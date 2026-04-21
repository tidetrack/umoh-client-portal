# Arquitectura técnica — UMOH Client Portal

## Visión general

El sistema tiene dos flujos independientes que convergen en Google Sheets:

```
[1] PIPELINE DE DATOS (asíncrono, cada 6h)
    APIs externas → Python → Google Sheets

[2] DASHBOARD (sincrónico, on-demand)
    Browser → JS → PHP → Google Sheets → JS → Charts
```

---

## Flujo completo de datos

```
Google Ads API ──┐
Meta Ads API ────┼─→ extractors/*.py → normalizers/canonical.py → loaders/sheets_writer.py
MeisterTask API ─┘                                                         │
                                                                    Google Sheets
                                                                           │
                                                              api/lib/sheets.php
                                                                           │
                                                              api/endpoints/*.php
                                                                           │
                                                              dashboard/assets/js/api.js
                                                                           │
                                                              dashboard/assets/js/charts.js
                                                                           │
                                                                       Browser
```

---

## Capa frontend

**Archivos:** `dashboard/assets/js/`

| Archivo | Responsabilidad |
|---------|----------------|
| `api.js` | Única interfaz de datos. Switch `USE_MOCK` para alternar entre mock y PHP real. |
| `mockdata.js` | Datos realistas para desarrollo sin backend. Mismo contrato que PHP. |
| `charts.js` | Renderiza todos los gráficos. Recibe datos normalizados, no hace cálculos. |
| `filters.js` | Navegación, selector de período, KPI modals, user menu, theme toggle. |

**Principio:** `charts.js` y `filters.js` nunca llaman a APIs directamente. Todo pasa por `api.js`.

---

## Capa backend PHP

**Archivos:** `api/`

**Helpers centralizados en `api/lib/config.php`:**

```php
period_dates(string $period, string $last_date): array
// Retorna [$start, $end] para 7d / 30d / 90d / custom

filter_range(array $by_date, string $start, string $end): array
// Filtra un array indexado por fecha dentro del rango

build_trend(array $filtered, string $period, array $fields): array
// Agrupa por día/semana/mes según el período
```

Todos los endpoints siguen el mismo patrón:
```php
require '../lib/config.php';
$period = $_GET['period'] ?? '30d';
$data   = read_from_sheets();       // api/lib/sheets.php
$by_date = index_by_date($data);
[$start, $end] = period_dates($period, $last_date);
$selected = filter_range($by_date, $start, $end);
$trend    = build_trend($selected, $period, [...]);
echo json_encode([...]);
```

---

## Pipeline Python

**Archivos:** `extractors/`, `normalizers/`, `loaders/`

- Corre en GitHub Actions cada 6 horas (`0 */6 * * *`)
- Siempre extrae los últimos 7 días
- El loader hace **upsert** por `date + platform`: actualiza si existe, inserta si no
- Las pestañas de Sheets se crean automáticamente si no existen

---

## Autenticación

**Fase 1 (actual):** `PHASE1_BYPASS = true` — sin login, acceso directo al dashboard.

**Fase 4 (pendiente):** Cada subdominio (`{slug}.umohcrew.com`) mapea a un usuario en MySQL. El login en `login.php` verifica contra `dashboard/config/credentials.php` (no en repo). La sesión usa cookies cross-subdominio en `.umohcrew.com`.

---

## Decisiones de diseño

**Sin frameworks en frontend:** Hostinger shared hosting no soporta Node. Vanilla JS garantiza compatibilidad total sin proceso de build.

**Google Sheets como capa intermedia:** Permite que el pipeline Python y el backend PHP sean completamente independientes. El equipo de UMOH puede ver/editar los datos directamente en Sheets sin tocar código.

**PHP sin Composer:** Shared hosting de Hostinger no garantiza acceso a Composer. Todo el código PHP es autocontenido.

**Upsert en lugar de append:** El pipeline puede fallar y reejecutarse sin generar duplicados. Los datos de 3h atrás en Google Ads pueden actualizarse retroactivamente.
