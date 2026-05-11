# UMOH Client Portal

Sistema de dashboards de performance en tiempo real para los clientes de UMOH. Cada cliente accede desde su propio subdominio (`{slug}.umohcrew.com`) y ve sus campañas organizadas por etapa del funnel: **TOFU** (awareness) → **MOFU** (leads) → **BOFU** (ventas cerradas).

El diferencial no es mostrar métricas de ads — es conectar el funnel completo: desde una impresión en Google hasta una venta cerrada. Eso no lo hace ninguna agencia del mercado argentino.

**Cliente activo:** Prevención Salud — `prepagas.umohcrew.com`

---

## Arquitectura

```
Browser → sidebar.js + filters.js → api.js
                                        ├─ USE_MOCK=true  → mockdata.js → charts.js
                                        └─ USE_MOCK=false → PHP endpoints → Supabase → charts.js
                                                                           ↘ Google Sheets (espejo)

GitHub Actions (cron cada 6h — TOFU / cron semanal — MOFU)
  └─ data/extractors/ → data/normalizers/ → Supabase + Google Sheets
```

| Capa | Tecnologia |
|------|-----------|
| Frontend | HTML + CSS + Vanilla JS (sin frameworks — Hostinger shared hosting) |
| Backend | PHP 8.3 |
| Base de datos | Supabase (Postgres) — multi-tenant, 15 migraciones |
| Pipeline | Python 3.11 + GitHub Actions |
| CRM leads | MeisterTask via CSV export semanal |
| Charts | Chart.js 4 (CDN) |
| Mapas | Leaflet.js 1.9 (CDN) |
| Espejo cliente | Google Sheets via Service Account |

---

## Estructura del repositorio

```
umoh-client-portal/
│
├── product/            PRODUCTO — frontend + backend PHP
│   ├── dashboard/      SPA con 5 vistas: Inicio / Performance / TOFU / MOFU / BOFU
│   └── api/            Endpoints PHP + helpers + configuracion
│
├── data/               PIPELINE — extraccion y procesamiento de datos
│   ├── extractors/     Scripts Python: Google Ads, Meta, MeisterTask, GA
│   ├── normalizers/    Transformacion al schema canonico TOFU/MOFU/BOFU
│   ├── loaders/        Escritura en Supabase + Google Sheets
│   └── connections/    Documentacion de cada integracion
│
├── clients/            CLIENTES — config por cliente
│   ├── {slug}.json     Config del dashboard (IDs, moneda, timezone)
│   └── {slug}.yaml     Config del pipeline Python (plataformas, funnel_stages)
│
├── supabase/           BASE DE DATOS — schema y migraciones
│   └── migrations/     15 migraciones aplicadas en prod
│
├── Meistertask/        INPUT DE DATOS — CSVs exportados del CRM del cliente
│   └── prepagas/       Exports del proyecto MeisterTask de Prevención Salud
│
├── scripts/            RUNNERS — scripts de ejecucion manual y backfills
│
├── ops/                OPERACIONES — deploy, entornos
│   ├── production/     Guias de deploy, scripts de produccion
│   └── testing/        Entornos de prueba
│
├── docs/               CONOCIMIENTO — wiki tecnica y procedimientos
│   ├── wiki/           Arquitectura, procedures, referencia de API
│   ├── estado-del-proyecto.md    Estado actual por fase (actualizar cada sprint)
│   ├── PROMPT_MAESTRO.md         Briefing de inicio de sesion de Claude Code
│   ├── plan-implementacion.md    Plan original de fases
│   └── manual-alta-clientes.md  Protocolo de onboarding de clientes
│
├── .agent/             EQUIPO IA — skills y workflows de agentes
├── .claude/agents/     Agentes Claude Code ejecutables
├── .github/workflows/  CI/CD — GitHub Actions (pipeline cron)
│
├── README.md           Este archivo
├── CHANGELOG.md        Historial de cambios
├── BACKLOG.md          Tareas MVP y post-MVP con estado actual
├── ARCHITECTURE.md     Decisiones de arquitectura
└── CLAUDE.md           Instrucciones para Claude Code
```

---

## Produccion

| Dato | Valor |
|------|-------|
| URL cliente | `https://prepagas.umohcrew.com` |
| Hosting | Hostinger shared hosting |
| FTP | `ftp://147.93.37.161/prepagas/` |
| Deploy | FTP manual a `/public_html/prepagas/` |
| Supabase | Ver `.env` para project ref |
| MCC Google Ads | `865-936-8705` |

Configuracion de entorno:
```javascript
// product/dashboard/assets/js/api.js
const USE_MOCK = false;  // produccion (true = mock local)
```

```php
// product/dashboard/auth_check.php
define('PHASE1_BYPASS', true);  // sin login activo (cambiar a false en Fase 4)
```

---

## Estado del proyecto

Ver `docs/estado-del-proyecto.md` para el estado detallado y `BACKLOG.md` para las tareas.

| Fase | Estado | Descripcion |
|------|--------|-------------|
| 1 | En produccion (MVP parcial) | Dashboard con datos reales. BOFU y SUMMARY pendientes de validacion. |
| 2 | Parcial | Google Ads activo. Meta Ads extractor creado, sin integrar. |
| 3 | Parcial | MeisterTask via CSV funciona. API directa no implementada. |
| 4 | Pendiente | Login page existe, auth no activada (PHASE1_BYPASS). |
| 5 | Parcial | Tabla `ai_summaries` en Supabase. Llamada a Claude API pendiente. |

---

## Iniciar una sesion de desarrollo

1. Leer `CLAUDE.md` — convenciones, stack, agentes disponibles
2. Leer `docs/estado-del-proyecto.md` — que paso y que viene
3. Leer `BACKLOG.md` — tareas concretas con estado
4. Pegar el prompt en `docs/PROMPT_MAESTRO.md` al inicio de la sesion

---

## Conexiones activas

| Servicio | Estado |
|---------|--------|
| Google Ads API | Activo — extrae TOFU cada 6h |
| Supabase | Activo — fuente de verdad de todos los datos |
| Google Sheets API | Activo — espejo de auditoria para el cliente |
| MeisterTask CSV | Activo — export manual semanal para MOFU/BOFU |
| Meta Ads API | Extractor creado, pendiente de credenciales e integracion |
| Google Analytics | Extractor creado, pendiente de integracion |

---

## Equipo de agentes

Punto de entrada: el CEO orquestador en `.claude/agents/ceo-tidetrack-pm.md`.

Al inicio de cada sesion Claude Code: *"Actua como CEO del proyecto. Lee CLAUDE.md y docs/estado-del-proyecto.md."*
