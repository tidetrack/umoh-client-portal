# UMOH Client Portal

Sistema de dashboards de performance en tiempo real para los clientes de UMOH. Cada cliente accede desde su propio subdominio (`{slug}.umohcrew.com`) y ve sus campañas organizadas por etapa del funnel: **TOFU** (awareness) → **MOFU** (leads) → **BOFU** (ventas cerradas).

El diferencial no es mostrar métricas de ads — es conectar el funnel completo: desde una impresión en Google hasta una venta cerrada. Eso no lo hace ninguna agencia del mercado argentino.

---

## Estructura del repositorio

El repositorio está organizado como las áreas de una empresa. Cada carpeta raíz es un área de trabajo independiente pero interconectada.

```
umoh-client-portal/
│
├── product/            INGENIERÍA — el producto (frontend + backend)
│   ├── dashboard/      SPA con las 4 vistas del funnel
│   └── api/            Endpoints PHP + helpers + configuración
│
├── data/               DATA PLATFORM — cómo se obtienen y procesan los datos
│   ├── extractors/     Scripts Python: extracción de APIs externas
│   ├── normalizers/    Transformación al schema canónico TOFU/MOFU/BOFU
│   ├── loaders/        Escritura de datos normalizados en Google Sheets
│   └── connections/    Documentación de cada integración
│
├── clients/            CUENTAS — configuración de cada cliente
│   ├── {slug}.json     Config del dashboard (IDs, moneda, timezone)
│   └── {slug}.yaml     Config del pipeline Python
│
├── ops/                OPERACIONES — deploy, entornos y testing
│   ├── production/     Guías de deploy, scripts de producción, .env.example
│   └── testing/        Entornos de prueba y checklist de validación
│
├── docs/               CONOCIMIENTO — wiki técnica y procedimientos
│   ├── wiki/           Arquitectura, procedures, referencia de API y schema
│   ├── PROMPT_MAESTRO.md
│   ├── plan-implementacion.md
│   └── manual-alta-clientes.md
│
├── .agent/             EQUIPO IA — skills y workflows de agentes
│   ├── skills/         Definición de cada agente especializado
│   └── workflows/      System prompts operativos
│
├── .github/            CI/CD — GitHub Actions (debe estar en root)
│   └── workflows/extract_all.yml   Pipeline cron cada 6h
│
├── README.md           Este archivo
├── CHANGELOG.md        Historial de cambios del código madre
├── ARCHITECTURE.md     Decisiones de arquitectura
├── CLAUDE.md           Instrucciones para Claude Code
└── requirements.txt    Dependencias Python
```

---

## Arquitectura

```
Browser → filters.js → api.js
                          ├─ USE_MOCK=true  → mockdata.js → charts.js
                          └─ USE_MOCK=false → PHP endpoint → Google Sheets → charts.js

GitHub Actions (cron cada 6h)
  └─ data/extractors/ → data/normalizers/ → data/loaders/ → Google Sheets
```

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML + CSS + Vanilla JS (sin frameworks) |
| Backend | PHP 8.3 — Hostinger shared hosting |
| Pipeline | Python 3 + GitHub Actions |
| APIs externas | Google Ads, Meta Marketing, MeisterTask |
| Almacenamiento intermedio | Google Sheets (leída por PHP) |

---

## Producción

Ver [`ops/production/`](./ops/production/README.md) para la guía completa.

| Dato | Valor |
|------|-------|
| Hosting | Hostinger shared hosting |
| FTP | `ftp://147.93.37.161` |
| Subdominio activo | `prepagas.umohcrew.com` |
| Deploy | FTP manual — [`ops/production/deploy/`](./ops/production/deploy/hostinger-guide.md) |
| Variables de entorno | [`ops/production/environments/.env.example`](./ops/production/environments/.env.example) |
| Script producción | [`ops/production/api.production.js`](./ops/production/api.production.js) |

---

## Conexiones

Ver [`data/connections/`](./data/connections/README.md) para documentación completa.

| Servicio | Estado |
|---------|--------|
| Google Ads API | Activo (Fase 1) |
| Google Sheets API | Activo (Fase 1) |
| Meta Marketing API | Pendiente (Fase 3) |
| MeisterTask API | Pendiente (Fase 5) |

---

## Entornos de prueba

Ver [`ops/testing/`](./ops/testing/README.md).

```javascript
// product/dashboard/assets/js/api.js
const USE_MOCK = true;   // desarrollo local
const USE_MOCK = false;  // producción
```

```php
// product/dashboard/auth_check.php
define('PHASE1_BYPASS', true);   // sin login (Fase 1)
define('PHASE1_BYPASS', false);  // login real (Fase 4)
```

---

## Wiki y documentación

| Documento | Descripción |
|-----------|-------------|
| [docs/wiki/](./docs/wiki/README.md) | Índice completo de la wiki |
| [docs/wiki/architecture.md](./docs/wiki/architecture.md) | Arquitectura técnica |
| [docs/wiki/procedures/deploy.md](./docs/wiki/procedures/deploy.md) | Deploy paso a paso |
| [docs/wiki/procedures/client-onboarding.md](./docs/wiki/procedures/client-onboarding.md) | Alta de clientes |
| [docs/wiki/procedures/data-pipeline.md](./docs/wiki/procedures/data-pipeline.md) | Pipeline end-to-end |
| [docs/wiki/api-reference/endpoints.md](./docs/wiki/api-reference/endpoints.md) | Referencia endpoints PHP |
| [docs/wiki/api-reference/schema.md](./docs/wiki/api-reference/schema.md) | Schema TOFU/MOFU/BOFU |
| [CHANGELOG.md](./CHANGELOG.md) | Historial de cambios |

---

## Estado del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1 | Completa | Dashboard + pipeline Google Ads + login |
| 2 | En progreso | Conectar datos reales al dashboard |
| 3 | Pendiente | Meta Ads API |
| 4 | Pendiente | Auth MySQL por subdominio |
| 5 | Pendiente | MeisterTask API |

---

## Equipo de agentes

Punto de entrada: `.agent/skills/ceo/SKILL.md`

Al inicio de cada sesión: *"Actuá como CEO del proyecto. Leé `.agent/skills/ceo/SKILL.md`."*
