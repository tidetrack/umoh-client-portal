# UMOH Client Portal

Sistema de dashboards de performance en tiempo real para los clientes de UMOH. Cada cliente accede desde su propio subdominio (`{slug}.umohcrew.com`) y ve sus campañas organizadas por etapa del funnel: **TOFU** (awareness) → **MOFU** (leads) → **BOFU** (ventas cerradas).

El diferencial no es mostrar métricas de ads — es conectar el funnel completo: desde una impresión en Google hasta una venta cerrada. Eso no lo hace ninguna agencia del mercado argentino.

---

## Tabla de contenidos

1. [Arquitectura](#arquitectura)
2. [Código fuente](#código-fuente)
3. [Producción](#producción)
4. [Conexiones](#conexiones)
5. [Entornos de prueba](#entornos-de-prueba)
6. [Wiki y documentación](#wiki-y-documentación)
7. [Estado del proyecto](#estado-del-proyecto)
8. [Agentes de IA](#agentes-de-ia)

---

## Arquitectura

```
Browser → filters.js → api.js
                          ├─ USE_MOCK=true  → mockdata.js → charts.js
                          └─ USE_MOCK=false → PHP endpoint → Google Sheets → charts.js

GitHub Actions (cron cada 6h)
  └─ extractors/ → normalizers/ → loaders/ → Google Sheets
```

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML + CSS + Vanilla JS (sin frameworks) |
| Backend | PHP 8.3 — Hostinger shared hosting |
| Base de datos | MySQL en Hostinger (Fase 4) |
| Charts | Chart.js 4 (CDN) |
| Pipeline | Python 3 + GitHub Actions |
| APIs externas | Google Ads, Meta Marketing, MeisterTask |
| Almacenamiento intermedio | Google Sheets (leída por PHP) |

---

## Código fuente

```
umoh-client-portal/
├── dashboard/               ← Frontend SPA
│   ├── index.html           ← Vista principal (performance / tofu / mofu / bofu)
│   ├── login.php            ← Login con autenticación PHP
│   ├── auth_check.php       ← Verificación de sesión (AJAX endpoint)
│   ├── logout.php           ← Cierre de sesión
│   └── assets/
│       ├── css/umoh.css     ← Design system completo
│       ├── js/
│       │   ├── api.js       ← Abstracción mock ↔ PHP (USE_MOCK flag)
│       │   ├── charts.js    ← Render de gráficos (Chart.js 4)
│       │   ├── filters.js   ← Navegación, períodos, KPI modals
│       │   └── mockdata.js  ← Datos de prueba realistas
│       └── img/             ← Logos, planetas decorativos, favicon
│
├── api/                     ← Backend PHP
│   ├── config/
│   │   ├── database.php     ← PDO singleton MySQL
│   │   ├── env.php          ← Loader de .env sin Composer
│   │   └── .htaccess        ← Restricciones de acceso directo
│   ├── lib/
│   │   ├── config.php       ← Helpers: period_dates(), filter_range(), build_trend()
│   │   └── sheets.php       ← Lector de Google Sheets via API
│   └── endpoints/
│       ├── summary.php      ← GET ?period=30d — métricas consolidadas
│       ├── tofu.php         ← GET ?period=30d — awareness (Google Ads)
│       ├── mofu.php         ← GET ?period=30d — leads (MeisterTask)
│       └── bofu.php         ← GET ?period=30d — ventas cerradas
│
├── extractors/              ← Extracción de datos desde APIs externas
├── normalizers/             ← Transformación al schema canónico
├── loaders/                 ← Escritura en Google Sheets
├── clients/                 ← Config por cliente ({slug}.json)
└── config/clients/          ← Config del pipeline por cliente ({slug}.yaml)
```

---

## Producción

Ver [`production/`](./production/README.md) para la guía completa.

| Dato | Valor |
|------|-------|
| Hosting | Hostinger shared hosting |
| FTP | `ftp://147.93.37.161` |
| Subdominio activo | `prepagas.umohcrew.com` |
| Deploy | FTP manual (ver `production/deploy/`) |
| Variables de entorno | `.env` en el servidor — nunca en el repo |
| Credenciales pipeline | GitHub Secrets (ver `connections/`) |

---

## Conexiones

Ver [`connections/`](./connections/README.md) para la documentación completa de cada integración.

| Servicio | Estado | Docs |
|---------|--------|------|
| Google Ads API | Activo | [connections/google-ads.md](./connections/google-ads.md) |
| Google Sheets API | Activo | [connections/google-sheets.md](./connections/google-sheets.md) |
| Meta Marketing API | Pendiente (Fase 3) | [connections/meta-ads.md](./connections/meta-ads.md) |
| MeisterTask API | Pendiente (Fase 5) | [connections/meistertask.md](./connections/meistertask.md) |
| MySQL Hostinger | Pendiente (Fase 4) | Auth por subdominio |

---

## Entornos de prueba

Ver [`testing/`](./testing/README.md) para la guía completa.

**Activar modo mock (desarrollo local):**
```javascript
// dashboard/assets/js/api.js
const USE_MOCK = true;
```

**Activar auth bypass (sin login):**
```php
// dashboard/auth_check.php
define('PHASE1_BYPASS', true);
```

Antes de hacer push a producción: `USE_MOCK = false` y `PHASE1_BYPASS = false`.

---

## Wiki y documentación

| Documento | Descripción |
|-----------|-------------|
| [docs/wiki/](./docs/wiki/README.md) | Índice completo de la wiki |
| [docs/wiki/architecture.md](./docs/wiki/architecture.md) | Arquitectura técnica detallada |
| [docs/wiki/procedures/deploy.md](./docs/wiki/procedures/deploy.md) | Deploy paso a paso |
| [docs/wiki/procedures/client-onboarding.md](./docs/wiki/procedures/client-onboarding.md) | Alta de nuevos clientes |
| [docs/wiki/procedures/data-pipeline.md](./docs/wiki/procedures/data-pipeline.md) | Pipeline de datos end-to-end |
| [docs/wiki/api-reference/endpoints.md](./docs/wiki/api-reference/endpoints.md) | Referencia de endpoints PHP |
| [docs/wiki/api-reference/schema.md](./docs/wiki/api-reference/schema.md) | Schema canónico TOFU/MOFU/BOFU |
| [CHANGELOG.md](./CHANGELOG.md) | Historial de cambios del código madre |

---

## Estado del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 1 | Completa | Dashboard frontend + pipeline Google Ads real + login |
| 2 | En progreso | Conectar datos reales al dashboard (PHP → Sheets) |
| 3 | Pendiente | Integración Meta Ads API |
| 4 | Pendiente | Auth con MySQL por subdominio |
| 5 | Pendiente | MeisterTask API para MOFU automático |

---

## Agentes de IA

Este proyecto usa Claude Code con un sistema de agentes especializados. El punto de entrada es:

```
/ceo
```

El agente CEO orquesta todos los subagentes. Ver [`.agent/skills/ceo/SKILL.md`](./.agent/skills/ceo/SKILL.md).
