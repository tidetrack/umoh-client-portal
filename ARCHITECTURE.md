# UMOH Client Portal — Architecture

## Stack
| Layer | Tech | Constraint |
|---|---|---|
| Frontend | HTML + CSS + Vanilla JS | Sin frameworks. Hostinger shared. |
| Backend | PHP 8.3 | Middleware entre FE y APIs externas |
| Database | MySQL (Hostinger) | Auth + config de clientes |
| Charts | Chart.js 4 (CDN) | Donuts, barras, líneas |
| Maps | Leaflet.js 1.9 (CDN) | Choropleth geográfico |
| APIs externas | Google Ads API, Meta Marketing API | Fase 2 |

## Dominios
Cada cliente vive en un subdominio: `{slug}.umohcrew.com`  
El servidor raíz sirve el directorio `/dashboard/` como SPA.

## Estructura de carpetas
```
umoh-client-portal/
├── clients/
│   └── {slug}.json          ← config e IDs por cliente
├── api/
│   ├── config/
│   │   ├── database.php     ← PDO connection
│   │   └── env.php          ← loader de .env sin Composer
│   ├── auth/
│   │   └── login.php        ← valida MySQL, retorna session token
│   ├── connectors/
│   │   ├── google-ads.php   ← wrapper Google Ads API (PMAX)
│   │   └── meta.php         ← wrapper Meta Marketing API
│   └── endpoints/
│       ├── summary.php      ← GET /api/summary?period=30d
│       ├── tofu.php         ← GET /api/tofu?period=30d
│       ├── mofu.php         ← GET /api/mofu?period=30d (MeisterTask)
│       └── bofu.php         ← GET /api/bofu?period=30d
├── dashboard/
│   ├── index.html           ← SPA: 4 secciones + selector de período
│   └── assets/
│       ├── css/umoh.css     ← design system completo
│       └── js/
│           ├── mockdata.js  ← datos estáticos de ejemplo
│           ├── api.js       ← abstracción: mock ↔ PHP real
│           ├── charts.js    ← Chart.js + Leaflet, render por sección
│           └── filters.js   ← navegación + selector de período
└── deploy/
    └── hostinger-guide.md
```

## Flujo de datos
```
Browser → filters.js → api.js
                          ├─ USE_MOCK=true  → mockdata.js → charts.js
                          └─ USE_MOCK=false → PHP endpoint → API externa → charts.js
```

## Alta de cliente nuevo
1. Crear `clients/{slug}.json` con IDs y config.
2. Crear usuario en MySQL: `INSERT INTO users (slug, password_hash)`.
3. Apuntar subdominio en Hostinger a la misma carpeta raíz.
4. El dashboard detecta el subdominio y carga el JSON correspondiente.

## Autenticación (Fase 2)
Login por `api/auth/login.php` → session PHP o JWT almacenado en `sessionStorage`.  
Fase 1 no tiene auth: el dashboard es acceso directo.

## Convenciones
- IDs de elementos HTML: kebab-case con prefijo de sección (`tofu-clicks`, `bofu-revenue`).
- IDs de canvas Chart.js: `chart-{nombre}`.
- Períodos: `'7d'`, `'30d'`, `'90d'`, `'custom'`.
- Moneda: ARS, formato `$1.240.500` (sin decimales para valores grandes).
- Todos los endpoints PHP retornan `Content-Type: application/json`.

## Roadmap
| Fase | Estado | Descripción |
|---|---|---|
| 1 | ✅ | Dashboard completo con mock data |
| 2 | ⏳ | Conectar Google Ads API (TOFU real) |
| 3 | ⏳ | Conectar Meta API |
| 4 | ⏳ | Login + MySQL auth |
| 5 | ⏳ | MeisterTask webhook para MOFU |
