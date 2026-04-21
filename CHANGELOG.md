# Changelog — UMOH Client Portal

Todas las modificaciones relevantes al código madre se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

- Fase 2: conexión de datos reales al dashboard (PHP → Google Sheets → charts)
- Fase 3: integración Meta Ads API
- Fase 4: login real con MySQL por subdominio
- Fase 5: MeisterTask API para MOFU automático

---

## [1.3.0] — 2025-04-21

### Added
- Login page rediseñada con identidad visual umohcrew.com (Outfit font, navy `#212A38`, rojo `#FF003B`)
- 5 planetas decorativos definitivos en login (planet-3, 7, 9, 12, 13) con animaciones flotantes independientes
- Tagline "DIGITAL ECOSYSTEM CREATORS" con "CREATORS" en rojo en el footer del login
- Favicon asterisco de la marca en pestaña del browser
- Imágenes de planetas recortadas al contenido real (`p02/p03/p04-cropped.png`) para evitar canvas transparente
- Responsive fix: planetas 9 y 13 separados en viewport mobile (≤768px) para evitar superposición en iPhone 14 Pro Max

### Changed
- `auth_check.php`: Phase 1 bypass (`PHASE1_BYPASS = true`) — retorna 200 inmediatamente sin verificar sesión
- Footer del login: texto blanco puro, "CREATORS" en `#FF003B`

---

## [1.2.0] — 2025-04-21

### Added
- KPI cards clickeables: cada tarjeta abre un modal explicativo con nombre, fórmula, descripción y ejemplo aplicado
- 13 entradas en `KPI_INFO`: revenue, spend, roi, impressions, leads, sales, tofu-impressions, tofu-cpc, mofu-cpl, mofu-tipif, mofu-highintent, bofu-ticket, bofu-conversion
- Modal con cierre por ✕, click en overlay y tecla Escape
- CSS: modal glassmorphism con `backdrop-filter: blur(20px)`, responsive bottom-sheet en mobile
- User menu: fix de hover — pseudo-elemento `::before` como bridge para cubrir el gap de 8px entre trigger y dropdown

### Changed
- KPI labels: eliminados los `<span class="kpi-info">ⓘ</span>` — reemplazados por click directo en la card
- User menu dropdown: migrado de `hidden` + `display:none/block` a `visibility/opacity/pointer-events` para transiciones suaves
- Footer badge del dashboard: "MOCK DATA" → "LIVE DATA"
- `filters.js` v2: agrega `initKpiModals()`, `_openKpiModal()`, `_closeKpiModal()`

### Fixed
- TOFU trend chart: colores de líneas demasiado similares — `impressions` → azul indigo `#2563EB`, `clicks` → ámbar `#F59E0B`

---

## [1.1.0] — 2025-04-21

### Fixed
- Todos los endpoints PHP retornaban solo la última fila para períodos 7d/30d/90d
- Reemplazado el patrón `($period === '90d') ? all : [$last]` por los helpers `period_dates()` + `filter_range()` + `build_trend()` en los 4 endpoints (summary, tofu, mofu, bofu)
- `strftime()` deprecated en PHP 8.1+ — removido y reemplazado por `date()` + constante `ES_MONTHS`
- Renombrado `by_date()` → `by_date_idx()` en `summary.php` para evitar conflicto de declaración duplicada

### Added
- `api/lib/config.php`: helpers `period_dates()`, `filter_range()`, `build_trend()` como librería centralizada
- `api/config/.htaccess`: restricción de acceso directo a archivos de configuración

---

## [1.0.0] — 2025-04-20

### Added
- Dashboard SPA completo: 4 vistas (Performance, TOFU, MOFU, BOFU) con Chart.js 4
- Design system `umoh.css`: variables CSS, componentes, dark mode, responsive
- `mockdata.js`: datos de prueba realistas para las 4 vistas y 3 períodos (7d/30d/90d)
- `api.js`: abstracción `USE_MOCK` — mismo contrato de datos para mock y PHP real
- `charts.js`: render de todos los gráficos (trend, barras, doughnut, mapa de Argentina con Leaflet)
- `filters.js`: navegación por secciones, selector de período, date picker custom, theme toggle
- 4 endpoints PHP esqueleto: `summary.php`, `tofu.php`, `mofu.php`, `bofu.php`
- Login PHP con sesiones cross-subdominio (`.umohcrew.com`)
- Pipeline Google Ads completo: `extractors/google_ads.py` + `normalizers/canonical.py` + `loaders/sheets_writer.py`
- GitHub Actions workflow (`extract_all.yml`): cron cada 6h para extracción automática
- Config cliente Prepagas: `clients/prepagas.json` + `config/clients/prepagas.yaml`
- `deploy/api.production.js`: versión de `api.js` con `USE_MOCK=false` para producción

### Infrastructure
- Repositorio inicializado con `CLAUDE.md`, `ARCHITECTURE.md`, `README.md`
- `.gitignore`: excluye `.env`, credenciales, `marca/`, `scripts/`, `__pycache__/`
- GitHub Secrets configurados para pipeline Python

---

[Unreleased]: https://github.com/tidetrack/umoh-client-portal/compare/HEAD...main
[1.3.0]: https://github.com/tidetrack/umoh-client-portal/compare/1b36f49...ece14a8
[1.2.0]: https://github.com/tidetrack/umoh-client-portal/compare/617b521...1b36f49
[1.1.0]: https://github.com/tidetrack/umoh-client-portal/compare/e8ae7ca...617b521
[1.0.0]: https://github.com/tidetrack/umoh-client-portal/compare/9a83d0a...e8ae7ca
