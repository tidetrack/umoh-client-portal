# PROMPT MAESTRO — UMOH Client Portal
# Pegar este bloque completo al inicio de cada sesion de Claude Code

---

## Al iniciar esta sesion, leer primero

1. `CLAUDE.md` — contexto del proyecto, stack, convenciones de codigo
2. `docs/estado-del-proyecto.md` — estado real por fase, linea de tiempo, proximos pasos
3. `BACKLOG.md` — tareas detalladas con estado [x] / [ ]

Los demas archivos (`docs/plan-implementacion.md`, `.agent/workflows/`) son referencia historica — consultarlos si hay duda sobre una decision de diseno.

---

## Estado actual (al 2026-05-11)

**Dashboard en produccion:** `https://prepagas.umohcrew.com`
**Branch activa:** `staging` (produccion: `main`)
**Cliente:** Prevención Salud — prepagas

**Que funciona:**
- Dashboard SPA con sidebar lateral (Sprint UX 2.1), 5 secciones: Inicio / Performance / TOFU / MOFU / BOFU
- Datos reales de Google Ads en TOFU (Supabase, pipeline cada 6h)
- MOFU validado: 77 leads, CPL $6.6k, customer journey CRM 13 etapas
- Filtro global de campana activa
- Google Sheets espejo del cliente (3 tabs: tofu/mofu/bofu facts)
- Seller ranking con datos reales

**Pendiente MVP (bloquea lanzamiento al cliente):**
- `1.3` Validar BOFU con datos reales
- `1.4` Validar SUMMARY/Performance con datos reales
- `1.5` Mapa geografico — datos en Supabase, falta conectar al frontend
- `1.6` Canal/dispositivo en cero — diagnosticar (puede ser limitacion PMAX)
- `3.1` Node.js 24 en GitHub Actions — deadline junio 2026

---

## Stack real

| Capa | Tecnologia |
|------|-----------|
| Frontend | HTML + CSS + Vanilla JS (sin frameworks) |
| Backend | PHP 8.3 — Hostinger shared hosting |
| Base de datos | Supabase (Postgres) — 15 migraciones, 8+ tablas, multi-tenant |
| Pipeline | Python 3.11 + GitHub Actions — cron 6h (TOFU), cron semanal (MOFU) |
| Charts | Chart.js 4 (CDN) |
| Mapas | Leaflet.js 1.9 (CDN) |
| Espejo cliente | Google Sheets via Service Account |
| CRM leads | MeisterTask via CSV manual export |

---

## Arquitectura en una linea

```
Browser → sidebar.js + filters.js → api.js → PHP endpoints → Supabase → charts.js
                                                           ↘ Google Sheets (espejo)
```

`USE_MOCK = false` en produccion. `USE_MOCK = true` para desarrollo local.

---

## Convencion de ramas y commits

- Trabajar siempre en `staging`
- Merge a `main` solo con OK explicito de Franco
- Commits: `tipo(scope): descripcion` — tipos: `feat / fix / refactor / docs / chore`
- NO hacer commits ni push sin que Franco lo pida explicitamente

---

## Responsabilidades permanentes

- Si la arquitectura o el stack cambian: actualizar `CLAUDE.md`
- Al cerrar una tarea MVP: marcar `[x]` en `BACKLOG.md` y actualizar `docs/estado-del-proyecto.md`
- Sin `console.log` de debug en codigo final
- Sin credenciales en codigo — siempre en `.env`
- Mobile: verificar en 390px (iPhone 14 Pro Max) cualquier cambio visual

---

## Decisiones tecnicas ya tomadas (no reabrir)

- **Base de datos principal:** Supabase (no MySQL de Hostinger — ese es solo para auth futura)
- **MeisterTask:** via CSV manual, no API directa
- **Multi-tenant:** `client_slug` en todas las tablas de Supabase
- **campaign_id:** viene del tag de MeisterTask; prepagas tiene 1 campana (PMAX) → todos los leads van a ese ID
- **Moneda:** ARS, formato `$1.240.500` (sin decimales para valores grandes)
- **Dedup pipeline:** `(client_slug, date, campaign_id)` en TOFU; `(client_slug, meistertask_id)` en MOFU
- **Rango de extraccion:** siempre ultimos 7 dias, el dedup garantiza que re-runs no generan duplicados
- **`funnel_stages`:** tabla en Supabase sincronizada desde YAML via `sync_funnel_stages.py`

---

## Links utiles

- Repo: https://github.com/tidetrack/umoh-client-portal
- Dashboard prepagas: https://prepagas.umohcrew.com
- GitHub Actions: https://github.com/tidetrack/umoh-client-portal/actions
- Supabase: https://supabase.com/dashboard (ver `.env` para el project ref)
- Hostinger hPanel: https://hpanel.hostinger.com
