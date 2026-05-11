# Estado del Proyecto — UMOH Client Portal

**Ultima actualizacion:** 2026-05-11
**Rama activa:** `staging` (produccion: `main`)
**Cliente activo:** Prevención Salud (`prepagas.umohcrew.com`)

---

## Que es este archivo

La "memoria viva" del proyecto. Responde tres preguntas en segundos:
- Que paso hasta hoy
- En que estamos ahora mismo
- Que viene

Se actualiza cada vez que cierra un sprint o cambia el estado de una fase importante.

---

## Estado actual por fase

### Fase 1 — MVP funcional (EN PRODUCCION con deuda tecnica)

**Estado real:** El MVP esta en produccion desde 2026-05-05, pero con varias secciones validadas parcialmente. La nomenclatura de "Fase 1 completa" en CLAUDE.md es imprecisa — hay tareas MVP sin cerrar.

**Que funciona en produccion hoy:**
- Dashboard SPA completo con sidebar lateral (Sprint UX 2.1), 5 secciones (Inicio, Performance, TOFU, MOFU, BOFU)
- Datos TOFU reales de Google Ads en Supabase. Pipeline corre cada 6h via GitHub Actions.
- MOFU con datos reales: 77 leads de campaña, CPL $6.6k, journey CRM de 13 etapas con motion.
- Seller ranking con datos reales desde `seller_facts`.
- Filtro global de campaña activa (sprint 1.8).
- Google Sheets espejo del cliente (3 facts tables: tofu/mofu/bofu).
- Customer Journey CRM: 13 etapas con paleta cromatica semantica + animaciones.

**Pendiente para cerrar el MVP (bloquea lanzamiento al cliente):**
- `1.3` BOFU con datos reales — validar numeros (baja complejidad).
- `1.4` SUMMARY con datos reales — validar portada del dashboard (baja complejidad).
- `1.5` Mapa geografico — conectar `tofu_geo` de Supabase (media complejidad).
- `1.6` Canal/dispositivo en cero — diagnosticar (puede ser limitacion de PMAX).
- `1.11` Estandarizacion schema Supabase + `campaign_id` en todas las tablas (alta complejidad).
- `3.1` Actualizar Node.js en GitHub Actions a Node 24 (deadline: junio 2026).

### Fase 2 — Meta Ads API (PENDIENTE)

- Extractor `data/extractors/meta_ads.py` creado, no integrado al pipeline.
- No hay credenciales de Meta configuradas en GitHub Secrets.

### Fase 3 — MeisterTask automatico (PENDIENTE, parcialmente cubierto)

- El pipeline de MeisterTask funciona via CSV manual (exportacion semanal).
- API directa de MeisterTask no implementada — flujo de export CSV es el definitivo por ahora.
- `scripts/sync_funnel_stages.py` existe para sincronizar YAML → tabla `funnel_stages` en Supabase.
- Email semanal a asesores (leads que requieren actualizacion): planificado, no implementado (SMTP pospuesto).

### Fase 4 — Login + MySQL auth (PENDIENTE)

- `auth_check.php` tiene `PHASE1_BYPASS = true` — cualquier usuario entra sin autenticarse.
- Login page existe con diseño finalizado (Sprint 1.3 del CHANGELOG).
- Base de datos MySQL existe en Hostinger pero sin usuarios configurados.

### Fase 5 — Capa de interpretacion IA (PARCIALMENTE)

- Tabla `ai_summaries` existe en Supabase (migracion 015).
- Sección "Inicio" del dashboard tiene resumen IA planificado (Sprint UX 2.0/2.1 — sidebar + inicio).
- Implementacion de la llamada a Claude API: pendiente.

---

## Stack tecnico real (actualizado)

```
Browser → sidebar.js + filters.js → api.js
                                        ├─ USE_MOCK=true  → mockdata.js → charts.js
                                        └─ USE_MOCK=false → PHP endpoints → Supabase → charts.js
                                                                          ↘ Google Sheets (espejo)
```

| Capa | Tecnologia | Notas |
|------|-----------|-------|
| Frontend | HTML + CSS + Vanilla JS | Sin frameworks. Hostinger shared hosting. |
| Backend | PHP 8.3 | Middleware entre frontend y Supabase |
| Base de datos | Supabase (Postgres) | 15 migraciones aplicadas. 8+ tablas. Multi-tenant. |
| Espejo del cliente | Google Sheets | 3 tabs: tofu_facts / mofu_facts / bofu_facts |
| Charts | Chart.js 4 (CDN) | |
| Mapas | Leaflet.js 1.9 (CDN) | |
| Pipeline | Python 3.11 + GitHub Actions | Cron cada 6h para TOFU; cron semanal para MOFU |
| MCC Google Ads | `865-936-8705` | |
| Service Account Sheets | `umoh-sheets-writer@eco-league-466000-d2.iam.gserviceaccount.com` | |
| Hosting | Hostinger shared | `/public_html/prepagas/` |
| Repo | github.com/tidetrack/umoh-client-portal | |

---

## Tablas en Supabase (15 migraciones aplicadas)

| Tabla | Descripcion |
|-------|-------------|
| `tofu_ads_daily` | Metricas diarias de Google Ads por `(client_slug, date, campaign_id)` |
| `tofu_geo` | Datos geograficos por provincia |
| `tofu_search_terms` | Terminos de busqueda (incluye PMAX via `campaign_search_term_insight`) |
| `leads` | Un registro por lead de MeisterTask |
| `lead_monetary` | Montos de venta por lead |
| `funnel_stages` | Configuracion del funnel por cliente (sincronizado desde YAML) |
| `leads_with_stage` | Vista derivada: leads + etapa del funnel via JOIN |
| `seller_facts` | Metricas de rendimiento por vendedor |
| `ai_summaries` | Cache de interpretaciones IA por cliente/periodo |

---

## Decisiones tecnicas clave (irreversibles o costosas de cambiar)

1. **Multi-tenant con `client_slug` en todas las tablas**: PKs compuestas. Nuevo cliente = nuevo `client_slug`, no nueva tabla.
2. **MeisterTask via CSV, no API**: el flujo de exportacion manual es el definitivo. La API de MeisterTask es compleja y el CSV es suficiente para el volumen actual.
3. **`campaign_id` viene del tag de MeisterTask**: para asociar leads a campañas. Prepagas tiene una sola campana (PMAX) → todos los leads van a ese campaign_id hasta que se sume una segunda.
4. **Supabase como unica fuente de verdad**: PHP no lee de Google Sheets, lee de Supabase. Google Sheets es espejo de auditoria para el cliente.
5. **`funnel_stages` es la tabla de configuracion del funnel**: no hardcodeada en codigo. Sincronizada desde YAML via `sync_funnel_stages.py`.
6. **Moneda ARS, sin decimales para valores grandes**: formato `$1.240.500`.

---

## Linea de tiempo

| Fecha | Hito |
|-------|------|
| 2025-04 | Fase 1 inicial: dashboard SPA con mock data, PHP skeleton |
| 2026-04-20 | v1.0.0 — Dashboard completo con Chart.js (con mock data) |
| 2026-04-21 | v1.1.0 — Fix PHP endpoints para periodos multiples |
| 2026-04-21 | v1.2.0 — KPI cards clickeables + modal explicativo |
| 2026-04-21 | v1.3.0 — Login page con identidad visual UMOH |
| 2026-04-23 | v1.4.0 — MOFU funnel con cromatica semantica |
| 2026-04-27 | Brief tecnico v2 de MeisterTask pipeline (decisiones arquitecturales clave) |
| 2026-04-29 | MVP TOFU cerrado en staging |
| 2026-05-05 | Deploy a produccion (`prepagas.umohcrew.com`). Sprint 1.7: Sheets espejo. Sprint 1.8: Filtro campana. |
| 2026-05-05 | Supabase: 4 tablas facts (TOFU/MOFU/BOFU/SELLER). seller_facts. Pipeline mirrors. |
| 2026-05-07 | Sprint UX 2.0: sidebar lateral + seccion Inicio + Sprint 1.8 finalizado |
| 2026-05-07 | BACKLOG actualizado: 4 tareas MVP abiertas (1.3, 1.4, 1.5, 1.6), 1 tecnica (1.11, 3.1) |
| 2026-05-11 | Sprint UX 2.1: sidebar dropdowns + motion + theme + resumen heuristico |

---

## Proximos pasos sugeridos (en orden de prioridad)

1. **Validar BOFU y SUMMARY con datos reales** (tareas 1.3 y 1.4) — bloqueantes para lanzamiento.
2. **Investigar canal/dispositivo en cero** (tarea 1.6) — puede ser limitacion de PMAX o bug del extractor.
3. **Validar mapa geografico** (tarea 1.5) — el dato esta en Supabase, es cuestion de conectarlo.
4. **Node.js 24 en GitHub Actions** (tarea 3.1) — tiene deadline junio 2026.
5. **Entregar credenciales de acceso al cliente** (Prevención Salud) — lanzamiento.

---

## Como actualizar este archivo

Al cerrar un sprint o tarea MVP:
1. Cambiar el estado de la tarea en la seccion "Estado actual por fase".
2. Agregar una fila en la "Linea de tiempo".
3. Actualizar los "Proximos pasos" si el orden cambio.
4. Commitear: `docs(estado): actualizar estado post-sprint {numero}`.

No duplicar informacion que ya esta en BACKLOG.md — linkear desde ahi.
