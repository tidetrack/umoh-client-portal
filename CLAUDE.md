# UMOH Client Portal — Contexto del Proyecto

## Qué es este proyecto

Sistema de dashboards de performance para que los clientes de UMOH vean el rendimiento de sus campañas en tiempo real. Cada cliente accede desde un subdominio propio (`{slug}.umohcrew.com`) y ve sus datos organizados por etapa del funnel: TOFU (awareness), MOFU (leads), BOFU (ventas).

El diferencial no es mostrar métricas de ads — es conectar el funnel completo: desde una impresión en Google hasta una venta cerrada en el sistema del cliente. Eso no lo hace ninguna agencia del mercado argentino.

---

## Arquitectura

```
Browser → filters.js → api.js
                          ├─ USE_MOCK=true  → mockdata.js → charts.js
                          └─ USE_MOCK=false → PHP endpoint → API externa → charts.js
```

**Stack:**
- Frontend: HTML + CSS + Vanilla JS (sin frameworks — Hostinger shared hosting)
- Backend: PHP 8.3 (middleware entre el frontend y las APIs externas)
- Base de datos: MySQL en Hostinger (auth de usuarios + config de clientes)
- Charts: Chart.js 4 (CDN)
- Maps: Leaflet.js 1.9 (CDN)
- APIs externas: Google Ads API, Meta Marketing API, MeisterTask API (Fase 2+)
- Pipeline de extracción: Python + GitHub Actions (extrae datos, los escribe en Google Sheets, PHP los lee desde ahí)

**Hosting:** Hostinger shared hosting. Sin Docker, sin Node, sin Composer. PHP puro.

---

## Estructura de carpetas

```
umoh-client-portal/
├── CLAUDE.md                    ← este archivo
├── README.md                    ← propósito del repositorio
├── ARCHITECTURE.md              ← arquitectura técnica detallada
├── PROMPT_MAESTRO.md            ← prompt para iniciar sesiones de Claude Code
├── .env.example                 ← template de variables de entorno
├── clients/
│   └── {slug}.json              ← config e IDs por cliente
├── config/
│   └── clients/
│       └── {slug}.yaml          ← config del pipeline Python por cliente
├── api/
│   ├── config/
│   │   ├── database.php         ← PDO singleton (MySQL)
│   │   └── env.php              ← loader de .env sin Composer
│   ├── auth/
│   │   └── login.php            ← autenticación (Fase 4)
│   ├── connectors/
│   │   ├── google-ads.php       ← wrapper Google Ads API
│   │   └── meta.php             ← wrapper Meta Marketing API
│   └── endpoints/
│       ├── summary.php          ← GET /api/summary?period=30d
│       ├── tofu.php             ← GET /api/tofu?period=30d
│       ├── mofu.php             ← GET /api/mofu?period=30d
│       └── bofu.php             ← GET /api/bofu?period=30d
├── dashboard/
│   ├── index.html               ← SPA con las 4 vistas
│   └── assets/
│       ├── css/umoh.css         ← design system UMOH
│       └── js/
│           ├── mockdata.js      ← datos de prueba realistas
│           ├── api.js           ← abstracción mock ↔ PHP real (USE_MOCK)
│           ├── charts.js        ← render de todos los gráficos
│           └── filters.js       ← navegación + selector de período
├── extractors/                  ← scripts Python de extracción (GitHub Actions)
│   ├── google_ads.py
│   ├── meta_ads.py
│   └── meistertask.py
├── normalizers/
│   └── canonical.py             ← transforma datos crudos al schema TOFU/MOFU/BOFU
├── loaders/
│   └── sheets_writer.py         ← escribe datos normalizados en Google Sheets
├── .github/
│   └── workflows/
│       └── extract_all.yml      ← cron cada 6h: extrae → normaliza → escribe en Sheets
├── docs/
│   ├── plan-implementacion.md   ← fases del proyecto y estado actual
│   ├── manual-alta-clientes.md  ← protocolo de onboarding de clientes
│   └── mensaje-para-claudecode.md ← prompt de inicio de sesión
└── deploy/
    └── hostinger-guide.md       ← instrucciones de deploy en Hostinger
```

---

## Modelo de credenciales

**GitHub Secrets** (para el pipeline Python en GitHub Actions):
| Secret | Descripción |
|--------|-------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token de la cuenta MCC |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ID del MCC de UMOH (cuenta paraguas) |
| `GOOGLE_ADS_CLIENT_ID` | OAuth2 Client ID (Google Cloud Console) |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 Client Secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | Refresh token generado en el flujo OAuth |
| `META_SYSTEM_USER_TOKEN` | Token permanente del System User en Business Manager |
| `GOOGLE_SHEETS_SA_JSON` | JSON de Service Account para escribir en Sheets |

**Variables de entorno en Hostinger** (para el backend PHP, archivo `.env`):
Mismos valores que los Secrets de GitHub, más la conexión a MySQL.

---

## Schema canónico (TOFU / MOFU / BOFU)

Los datos de todas las plataformas se normalizan a un esquema único antes de escribirse en Sheets y antes de servirse desde los endpoints PHP.

**TOFU:** date, platform, impressions, clicks, spend, cpc (calculado), top_search_terms, channel_breakdown, device_breakdown

**MOFU:** date, total_leads, cost_per_lead (calculado), leads_contactado, leads_no_prospera, leads_a_futuro, leads_en_emision, leads_erroneo, leads_alta_intencion, typification_rate (calculado), segment_voluntary, segment_monotributista, segment_obligatorio

**BOFU:** date, total_revenue, closed_sales, avg_ticket (calculado), conversion_rate (calculado), capitas_closed, avg_ticket_capita (calculado), sales_voluntary, sales_monotributista, sales_obligatorio

---

## Convenciones de código

- IDs de elementos HTML: kebab-case con prefijo de sección (`tofu-clicks`, `bofu-revenue`)
- IDs de canvas Chart.js: `chart-{nombre}`
- Períodos: `'7d'`, `'30d'`, `'90d'`, `'custom'`
- Moneda: ARS, formato `$1.240.500` (sin decimales para valores grandes)
- Todos los endpoints PHP retornan `Content-Type: application/json`
- Python: type hints en todas las funciones, docstrings explicando el mapeo de campos
- Sin `console.log` de debug en código final
- Sin variables definidas y no usadas

---

## Config de cliente (dos archivos por cliente)

Cada cliente tiene dos archivos de configuración complementarios:

**`clients/{slug}.json`** — usado por el frontend PHP para saber cómo renderizar el dashboard:
```json
{
  "slug": "prepagas",
  "name": "Prevención Salud",
  "google_customer_id": "123-456-7890",
  "meta_account_id": "act_123456789",
  "mofu_source": "meistertask",
  "meistertask_project_id": "",
  "currency": "ARS",
  "timezone": "America/Argentina/Mendoza"
}
```

**`config/clients/{slug}.yaml`** — usado por el pipeline Python (GitHub Actions):
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
```

---

## Pipeline Python — decisiones de diseño

**Rango de fechas del extractor:** siempre últimos 7 días. El loader hace dedup por `date + platform` antes de escribir — si una fila ya existe, la actualiza; si no existe, la inserta. Esto cubre gaps si un run falla sin generar duplicados.

**Creación automática de Sheets:** el loader verifica si las pestañas existen y las crea si no. Esto hace que el alta de un cliente nuevo sea completamente automatizable.

**Frecuencia del pipeline:** cada 6 horas (`0 */6 * * *`). Los datos de Google Ads tienen un lag de ~3 horas, Meta puede tardar hasta 24h en consolidar conversiones — más frecuente que 6h no agrega valor.

---

## Estado del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1 | Completa | Dashboard frontend con mock data, esqueleto PHP con TODOs |
| 2 | Pendiente | Conectar Google Ads API (extractor Python + endpoints PHP TOFU) |
| 3 | Pendiente | Conectar Meta API |
| 4 | Pendiente | Login + MySQL auth por subdominio |
| 5 | Pendiente | MeisterTask API para MOFU automático |

**Próximo paso concreto antes de empezar Fase 2:** obtener el Developer Token de Google Ads API (se solicita desde el MCC en Google Ads → Herramientas → API Center). El proceso de aprobación puede tardar días — solicitarlo ahora.

---

## Agentes disponibles

Ver `.agent/workflows/` para las instrucciones de cada agente. El orquestador es `.agent/skills/tidetrack-pm/SKILL.md`.

Agentes especializados para este proyecto: @pipeline-engineer, @schema-guardian, @sheets-architect, @dashboard-builder, @ui-ux-pro, @lean-code-manager, @ai-interpreter, @client-onboarding.
