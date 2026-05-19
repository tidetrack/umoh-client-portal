# Changelog — UMOH Client Portal

Todas las modificaciones relevantes al código madre se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

### Backlog (post-MVP)
- Fase 2: integración Meta Ads API (extractor creado, falta wiring + credenciales)
- Fase 3: MeisterTask API directa (hoy via CSV manual)
- Fase 4: login real con MySQL por subdominio (hoy `PHASE1_BYPASS = true`)
- Fase 5: capa IA — llamada a Claude API para resúmenes ejecutivos en sección Inicio
- Liquid glass formato para "elementos" (idea en `notasFran.md`)
- Líneas de tendencia para todos los gráficos de evolución
- Sidebar tablet (640-1023px) auto-colapsable
- `sellers-table` mobile: vista de cards apiladas en lugar de scroll horizontal

---

## [1.5.0] — 2026-05-19 — **MVP cerrado**

Cierre formal del MVP. Dashboard en producción en `prepagas.umohcrew.com` con TOFU/MOFU/BOFU funcionando con datos reales, responsive en desktop/tablet/celular, autenticación bypass (PHASE1) para entregar al cliente, y pipeline Python corriendo cada 6h.

### Added
- Customer Journey: dropdown propio de canal en MOFU (sincronizado con BOFU)
- Journey modal: bloque "Origen de los leads" con desglose campaña / vendedor (% + valor absoluto)
- Journey tooltip: desglose campaña / vendedor en hover
- Mobile fixes quirúrgicos (<640px): bloque `@media` aditivo al final del CSS que ataca KPI grids (5/6/4/3 cols → 2 cols), tablas anchas (scroll horizontal con touch nativo iOS), modales bottom-sheet, charts grids a 1 col, customer journey adaptado, filtros canal apilados, section header compactado

### Fixed
- Customer Journey: dropdown de canal (MOFU + BOFU) ahora actualiza ambas secciones — `_applyCanalFilter` esperaba secuencialmente los refreshes (antes el guard `_loading` descartaba la 2da llamada y dejaba la sección no-activa stale)
- Customer Journey: la sección SALES vuelve a respetar el filtro de canal del journey al cambiarlo (consecuencia del fix anterior)
- MOFU + BOFU: coherencia de "Ventas Ganadas" entre ambas secciones, fix de timezone, canal en journey
- BOFU: alineación de ventana de período con `summary.php` para que totales matcheen
- BOFU + summary: ranking de vendedores con mismo criterio que `closed_sales`

### Changed
- Customer Journey: removidas las micro-etiquetas `journey-col-breakdown` ("X camp · Y vend") debajo de cada columna — ruido visual redundante con el dropdown de canal
- BOFU modal: actividad real desde `lead_activity` + UX cleanup
- BOFU modal de ventas: badges, datos comerciales y acciones contextuales
- BOFU: columna Segmento + flag de ventas no contabilizadas + unificación ROAS
- API: rango temporal unificado en todos los endpoints (auditoría)
- Deploy: canary + verificación post-deploy en staging

### Docs
- v2 handoff doc con bootstrap prompt + protocolo accionable
- Knowhow transfer document UMOH → repo de finanzas

### Tech debt asumida en MVP (documentada en `docs/estado-del-proyecto.md`)
- `PHASE1_BYPASS = true` (auth no activada)
- Meta Ads no integrada al pipeline
- MeisterTask sigue via CSV manual
- IA en sección Inicio: tabla `ai_summaries` creada, llamada a Claude pendiente
- Node 24 en GitHub Actions: deadline junio 2026

---

## [1.4.0] — 2026-04-23

### Changed
- MOFU: funnel de estado de leads ahora usa escala cromática agrupada por fase del ciclo de vida — Contacto inicial (azul), Intención real (ámbar), Ganado (verde) — antes eran 7 colores sin relación semántica entre sí
- MOFU: leyenda de referencia con 3 chips (uno por fase cromática) debajo del funnel chart, con limpieza previa para evitar duplicación al cambiar período
- CSS: 5 reglas nuevas para `.funnel-phase-legend` + override dark mode en `umoh.css`

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
[1.4.0]: https://github.com/tidetrack/umoh-client-portal/compare/ece14a8...HEAD
[1.3.0]: https://github.com/tidetrack/umoh-client-portal/compare/1b36f49...ece14a8
[1.2.0]: https://github.com/tidetrack/umoh-client-portal/compare/617b521...1b36f49
[1.1.0]: https://github.com/tidetrack/umoh-client-portal/compare/e8ae7ca...617b521
[1.0.0]: https://github.com/tidetrack/umoh-client-portal/compare/9a83d0a...e8ae7ca
