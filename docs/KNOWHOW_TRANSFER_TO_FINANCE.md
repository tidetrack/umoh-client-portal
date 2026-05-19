# UMOH Client Portal — Handoff & Restructuring Protocol

**Para Claude del repo de finanzas.** Este documento contiene (a) el protocolo accionable que debés ejecutar al cargar este archivo, (b) los patrones probados del UMOH Client Portal que podés trasladar, y (c) los anti-patrones que no debés repetir.

No es lectura pasiva. Tu tarea al recibirlo está definida en la sección "Protocolo de Entendimiento y Reestructuración" (Parte 2).

---

## 0. Bootstrap Prompt — pegá esto en la terminal de Claude Code del repo de finanzas

> Copiá literal el bloque entre las líneas `---PROMPT---` y pegalo como primer mensaje al Claude del otro repo. El resto del documento debe estar accesible en el repo de finanzas (ej: `docs/REFERENCE_UMOH.md`).

```
---PROMPT---
Acabás de recibir el archivo docs/REFERENCE_UMOH.md (originalmente
docs/KNOWHOW_TRANSFER_TO_FINANCE.md del repo umoh-client-portal). Este
archivo documenta patrones probados en producción de un sistema
multi-tenant + ETL + dashboard que sirve a clientes reales hoy.

Tu tarea ahora — y NO debés saltearte ningún paso:

PASO 1 — LEÉ el documento entero. No skim. Necesito que internalices el
contexto (Parte 1), los 9 patrones transferibles (Parte 3), lo que NO se
copia (Parte 4) y las 10 cicatrices (Parte 5).

PASO 2 — AUDITÁ este repo (el de finanzas) contra cada uno de los 9
patrones. Para cada patrón, respondé:
  - ¿Ya existe algo equivalente acá? Path.
  - ¿Está alineado con el patrón UMOH? Diferencias.
  - ¿Falta algo crítico?
Output: creá docs/AUDIT_UMOH_PATTERNS.md con una tabla.

PASO 3 — IDENTIFICÁ los 5 movimientos de reestructuración de mayor
impacto que surjan del audit. Para cada uno: título, qué está mal hoy,
qué patrón UMOH aplica, scope estimado (XS/S/M/L), riesgo (bajo/medio/
alto). Output: docs/RESTRUCTURE_PLAN.md.

PASO 4 — PRESENTÁ el plan al humano (Franco u otro). NO empieces a
codear. Esperá aprobación explícita: qué movimientos ejecutar y en qué
orden. Si el humano quiere refinar el plan, iterá antes de avanzar.

PASO 5 — EJECUTÁ una fase a la vez. Reglas:
  - Comentarios inline al adaptar:
        // [adaptado de UMOH: <sección>] — diferencia: <qué cambió>
  - Lint + tests antes de cada commit.
  - Reportá cada fase y esperá luz verde antes de la siguiente.

PASO 6 — BACKPORT. Si durante el trabajo encontrás un patrón mejor que
el de UMOH, anotalo en docs/PATTERNS_TO_BACKPORT.md (qué hace, por qué
es mejor, path). No lo apliques a UMOH — solo dejá rastro.

REGLAS OPERATIVAS PERMANENTES (mientras dure este proyecto):
  - Antes de proponer arquitectura nueva para multi-tenant / período
    temporal / ETL / dedup / endpoints / frontend vanilla, chequeá si
    Parte 3 del REFERENCE_UMOH ya cubre el patrón.
  - Cualquier decisión grande dejala como comentario inline:
        // decisión <usuario> YYYY-MM-DD: <razón breve>
  - No uses emojis ni en código ni en UI.
  - Si el humano te pide algo que contradice una de las 10 cicatrices
    (Parte 5), avisale antes de ejecutar.

Confirmame que leíste el doc y arrancá por el PASO 2.
---PROMPT---
```

---

## 1. Contexto — qué es el UMOH Client Portal

Sistema de dashboards multi-tenant que la agencia UMOH ofrece a sus clientes para ver performance de campañas en tiempo real. Cada cliente accede desde un subdominio propio (`{slug}.umohcrew.com`). El diferencial del producto es conectar el funnel **completo**: desde una impresión publicitaria hasta una venta cerrada — eso requiere unir silos de datos que normalmente viven separados (Google Ads, CRM, sistema de ventas).

Hoy hay **un cliente en producción**: Prevención Salud (`prepagas.umohcrew.com`). El cliente final del dashboard NO es técnico — es el dueño del negocio. Todas las decisiones de UX y copy reflejan eso (KPIs con explicación en lenguaje natural, períodos sencillos, moneda formateada al locale del cliente).

**Stack:**

| Capa | Stack |
|---|---|
| Frontend | HTML + CSS + Vanilla JS (sin frameworks — Hostinger shared hosting). Chart.js 4 y Leaflet 1.9 via CDN. |
| Backend | PHP 8.3. Cliente Supabase REST minimal con cURL nativo (sin Composer). |
| Base de datos | Supabase (Postgres). 15+ migraciones, RLS habilitado, multi-tenant via `client_slug`. |
| Pipeline de datos | Python 3.11 + GitHub Actions cron (cada 6h). Extractor/normalizer/loader desacoplados. |
| Hosting | Hostinger Shared. Sin Docker, sin Node en servidor. Deploy via GitHub Actions con rsync/SSH. |
| Espejo de datos | Google Sheets (Service Account) — el cliente puede auditar la fuente. |

Para profundidad adicional sobre la organización del repo UMOH: ver `README.md`, `ARCHITECTURE.md`, `CLAUDE.md` del repo original.

---

## 2. Protocolo de Entendimiento y Reestructuración

**Vos, Claude del repo de finanzas, ejecutás esto secuencialmente.** No saltees pasos. No empieces a codear hasta el Paso 5.

### PASO 1 — Leer e Internalizar

1.1. Leé este documento entero, en orden. No skim.

1.2. Leé tu propio repo:
- Punto de entrada principal (`index.html`, `main.py`, `app.ts`, lo que aplique).
- Estructura de carpetas (top-level: ¿qué hay?).
- README + CLAUDE.md (si existe).
- Variables de entorno (`.env.example`).
- Dependencias (`package.json`, `requirements.txt`, `composer.json`).

1.3. Resumí en 5 bullets en un scratchpad mental: "qué hace este repo hoy, qué tecnología usa, qué falta evidentemente".

### PASO 2 — Auditar el Repo Actual contra los Patrones Transferibles

Para cada patrón 3.1 a 3.9 de este documento, completá una fila de la tabla. Output: `docs/AUDIT_UMOH_PATTERNS.md` en el repo de finanzas.

| Patrón UMOH | ¿Existe equivalente acá? | Path (si existe) | Diferencias vs UMOH | Brecha (qué falta) | Prioridad (1–5) |
|---|---|---|---|---|---|
| 3.1 Multi-tenant | | | | | |
| 3.2 Período unificado | | | | | |
| 3.3 ETL desacoplado | | | | | |
| 3.4 Dedup canónico | | | | | |
| 3.5 Endpoints HTTP | | | | | |
| 3.6 USE_MOCK toggle | | | | | |
| 3.7 UX no-técnico | | | | | |
| 3.8 Deploy y operación | | | | | |
| 3.9 Convenciones | | | | | |

**Reglas para la auditoría:**
- Sé honesto. Si no existe el patrón, ponelo "NO existe". Inflar nubla el plan.
- Prioridad 1 = crítico (rompe algo o bloquea features); 5 = nice-to-have.
- Si el patrón no aplica al dominio (ej: tu sistema no es multi-tenant), poné "N/A" y explicá por qué.

### PASO 3 — Identificar Movimientos de Reestructuración

De la tabla de Paso 2, sacá los 5 movimientos de mayor impacto. Output: `docs/RESTRUCTURE_PLAN.md`.

Para cada movimiento:

```markdown
## M1 — [Título corto y accionable]

**Estado actual:** [1 párrafo]
**Patrón UMOH que aplica:** [sección de REFERENCE_UMOH]
**Outcome esperado:** [1-2 líneas, mensurable]
**Scope:** [XS = <2h | S = medio día | M = 1-2 días | L = semana]
**Riesgo:** [bajo | medio | alto] — [una línea de qué puede romper]
**Dependencias:** [si requiere otro movimiento antes]
```

**No incluyas movimientos que sean "nice to have"** salvo que el humano explícitamente diga que quiere optimización menor. Esto es para reestructuración, no para limpieza estética.

### PASO 4 — Presentar el Plan y Esperar Aprobación

4.1. Mostrale al humano:
- La tabla de auditoría (resumen, no full).
- Los 5 movimientos con el formato de arriba.
- Una pregunta explícita: "¿Cuál arrancamos primero? ¿Aprobás el orden propuesto o cambiás?"

4.2. NO ejecutes nada hasta tener un OK explícito sobre **qué movimiento y en qué scope**.

4.3. Si el humano quiere modificar el plan (cambiar orden, dividir un movimiento, agregar uno nuevo), iterá hasta que esté firmado.

### PASO 5 — Ejecutar Fase por Fase

Para cada movimiento aprobado:

5.1. Implementá **solo ese movimiento**. No aproveches para refactorizar otras cosas — eso ensucia el diff.

5.2. Cada cambio que adapte un patrón UMOH lleva comentario inline:

```
// [adaptado de UMOH: 3.2 período unificado] — diferencia: usamos
// timezone por cliente en vez de APP_TZ global porque tenemos
// cuentas en US/AR/MX.
```

5.3. Cada commit:
- Descripción que cite el movimiento (`feat(M1): ...`).
- Decisiones grandes inline con prefijo `// decisión <usuario> YYYY-MM-DD: ...`.
- Lint + tests verdes antes de pushear.

5.4. Al terminar el movimiento, reportá:
- Qué se cambió (1 párrafo).
- Qué tests/lints pasaron.
- Qué quedó pendiente (si dividiste el scope).
- Pregunta: "¿Avanzo al siguiente movimiento o frenamos para validar?"

5.5. **Esperá luz verde antes de avanzar al próximo.**

### PASO 6 — Backport

Mientras ejecutás, si encontrás un patrón en tu repo que es **mejor** que el equivalente de UMOH, no lo apliques a UMOH desde acá. En cambio, agregá una entrada a `docs/PATTERNS_TO_BACKPORT.md`:

```markdown
## YYYY-MM-DD — [Patrón]
**Path en este repo:** ...
**Por qué es mejor que UMOH 3.x:** ...
**Esfuerzo estimado de backport:** XS/S/M/L
```

Eso queda como deuda para sincronizar más adelante.

---

## 3. Patrones Transferibles `[TRANSFERIBLE]`

### 3.1 Multi-tenant pattern (`client_slug`)

Toda tabla del esquema lleva `client_slug TEXT NOT NULL` como primera columna de la PK compuesta. Todos los índices secundarios priorizan `client_slug` adelante (el query planner lo usa).

**Reglas inflexibles:**
1. PK compuesta: `(client_slug, external_id, ...)`.
2. Índices secundarios: `(client_slug, foo)` — nunca solo `(foo)`.
3. RLS habilitado desde la migración 001. Dos roles: `service_role` (full) para el pipeline, `anon` (read filtered by JWT slug) para el frontend cuando se active auth (`supabase/migrations/005_rls_policies.sql`).
4. **Config por cliente vive en dos archivos paralelos**:
   - `clients/{slug}.json` — consumido por el frontend (PHP lee este archivo para renderizar el dashboard del cliente: nombre, IDs externos, currency, timezone).
   - `clients/{slug}.yaml` — consumido por el pipeline Python (plataformas activas, IDs de fuentes externas, vocabulario de estados, segments).
5. Onboarding de cliente nuevo está protocolizado en `docs/manual-alta-clientes.md`. ~7 pasos, ~1 hora.

**Paths de referencia:**
- `supabase/migrations/001_initial.sql` — multi-tenant PK pattern, tablas core.
- `supabase/migrations/005_rls_policies.sql` — RLS policies template.
- `clients/prepagas.json` + `clients/prepagas.yaml` — config real en producción.
- `docs/manual-alta-clientes.md` — protocolo de onboarding.

**Adaptación a finanzas:** Reemplazá `client_slug` por la dimensión equivalente (`account_id`, `tenant_id`, `org_id`). El patrón se mantiene 1:1.

---

### 3.2 Período unificado — single source of truth temporal

Anti-patrón evitado: tener cada endpoint calculando su propia ventana `[start, end]`. Resultado: KPI "ventas del último mes" daba números distintos en cada vista. Auditoría documentada inline en `product/api/lib/config.php`.

**El patrón:**

```php
// product/api/lib/config.php
const APP_TZ = 'America/Argentina/Mendoza';

function app_today(): string { /* devuelve YYYY-MM-DD en APP_TZ */ }

function to_app_date(?string $iso): ?string {
    // Convierte timestamp UTC a YYYY-MM-DD en APP_TZ.
    // Evita off-by-one en tareas creadas cerca de medianoche.
}

function global_period_dates(string $period, ?string $fallback_first = null): array {
    // ÚNICA fuente de verdad del rango temporal.
    // Ancla en HOY (APP_TZ), no en "último dato disponible".
    // 7d/30d/90d/custom/historical.
    // TODOS los endpoints lo usan.
}
```

**Reglas:**
1. **Anclar en HOY, no en max(data dates)**. Si anclás en el último dato, dos endpoints con datasets distintos calculan ventanas distintas. Si anclás en hoy, todos coinciden.
2. **Siempre usar `to_app_date()` para extraer YYYY-MM-DD de un timestamp**. Nunca `substr($iso, 0, 10)` — esto produce el día UTC, no el local. Tarea creada a las 22:00 hs Argentina (= 01:00 UTC del día siguiente) cae un día tarde.
3. **El helper conoce su propio fallback**: si el período es `'custom'` lee `$_GET['start']` y `$_GET['end']`; si es `'historical'` usa `$fallback_first` o `2020-01-01`.

**Path:** `product/api/lib/config.php`.

**Adaptación a finanzas:** Cambiá `APP_TZ` al timezone del negocio. Si soportás multi-tenant con tz por cliente, el helper recibe `tz` como param. El resto del patrón es idéntico.

---

### 3.3 Pipeline ETL desacoplado (extractor → normalizador → loader)

Tres carpetas hermanas, una responsabilidad cada una. Cero acoplamiento entre fuentes.

```
data/
├── extractors/          # 1 archivo por fuente externa
│   ├── google_ads.py    # API → JSON crudo
│   ├── meta_ads.py
│   └── meistertask_csv.py
├── normalizers/         # Crudo → schema canónico
│   ├── canonical.py     # Schema TOFU/MOFU/BOFU (ver 3.4)
│   └── meistertask.py   # Parser específico de CRM
└── loaders/             # Schema canónico → destino
    ├── supabase_writer.py
    ├── supabase_tofu_writer.py
    └── sheets_writer.py # Espejo opcional para auditoría
```

**Orquestación:** `.github/workflows/extract_all.yml` corre cron cada 6h. Permite trigger manual con `days_back` y `client_filter` como inputs.

**Reglas:**
1. **Cada extractor es stateless** — toma `client_id` + `date_range` y devuelve dicts.
2. **El normalizador es el contrato canónico**. Si una fuente cambia su formato, solo cambia su normalizador.
3. **Loaders deduplican**: el dedup vive ahí, no en el extractor (los extractores pueden traer overlapping window). Ver dedup en 3.4.
4. **Rango de extracción**: últimos N días (default 7 en UMOH) — overlap intencional para cubrir gaps si un run falla.
5. **Frecuencia atada al lag de la fuente**: Google Ads consolida a las ~3h, Meta a las ~24h. Más frecuente no aporta — solo carga la API.

**Adaptación a finanzas:** El patrón es agnóstico a la fuente. Reemplazá los extractores por API de banco / exchange / ledger contable / scraping de portal. Mantené las 3 carpetas separadas.

---

### 3.4 Dedup canónico de hechos

Dos capas de dedup: una en la DB (constraint UNIQUE), otra en la aplicación. Las dos son necesarias.

**En la DB:**

```sql
-- supabase/migrations/001_initial.sql
ALTER TABLE lead_monetary
  ADD CONSTRAINT uq_monetary
  UNIQUE (client_slug, meistertask_id, plan_code, capitas);
```

**Por qué la dedup en aplicación también:** Postgres trata `NULL != NULL` en UNIQUE constraints. Si una corrida del pipeline ve `plan_code=NULL` y `capitas=NULL`, inserta una fila nueva sin colisionar con la fila existente con esos mismos campos en NULL. Resultado: 84 filas para 33 ventas reales. KPIs inflados.

**Fix:** dedup en PHP por la entidad real (`meistertask_id`), eligiendo la fila más completa.

```php
// product/api/endpoints/bofu.php (líneas ~65-87)
$closed_by_mid = [];
foreach ($closed_raw as $row) {
    $mid = $row['meistertask_id'] ?? null;
    if ($mid === null) continue;
    $cur = $closed_by_mid[$mid] ?? null;
    if (!$cur) { $closed_by_mid[$mid] = $row; continue; }
    // 1. Preferir fila con precio_final > 0
    $cur_p = (float)($cur['precio_final'] ?? 0);
    $new_p = (float)($row['precio_final'] ?? 0);
    if ($new_p > 0 && $cur_p <= 0) { $closed_by_mid[$mid] = $row; continue; }
    if ($new_p <= 0 && $cur_p > 0) continue;
    // 2. Desempate: updated_at más reciente
    if (strcmp((string)$row['updated_at'], (string)$cur['updated_at']) > 0) {
        $closed_by_mid[$mid] = $row;
    }
}
```

**Regla general:** la dedup elige por (a) completitud de campos críticos y (b) recency. El criterio se documenta inline en cada endpoint que lo aplica.

**Paths:** `supabase/migrations/001_initial.sql`, `product/api/endpoints/bofu.php`.

**Adaptación a finanzas:** Si un hecho financiero puede llegar duplicado (ej: mismo movimiento bancario reportado por dos endpoints), aplicá el mismo patrón. La dimensión de dedup es la entidad real (transaction_id) — no la combinación de atributos opcionales.

---

### 3.5 Patrón de endpoints HTTP (PHP en UMOH; equivalente en tu stack)

Cada endpoint es un archivo PHP único en `product/api/endpoints/`. Sigue la misma estructura:

```
1. require lib (config + supabase)
2. api_headers()  -- CORS, Content-Type: application/json
3. session_start + auth gate (401 si no hay sesión)
4. const CLIENT_SLUG = 'prepagas'  -- hoy hardcoded, futuro: derivar de sesión
5. try {
     leer parámetros ($_GET['period'], 'canal', etc.)
     supabase_query(...) para traer raw
     dedup en aplicación (ver 3.4)
     global_period_dates() para [start, end]
     to_app_date() para extraer fechas
     filter + aggregate
     echo json_encode([...])
   } catch (Throwable $e) {
     api_error($e->getMessage())
   }
```

**Convenciones:**
- Todos responden `Content-Type: application/json; charset=utf-8`.
- Errores: `{"error": "msg"}` + HTTP status code apropiado.
- Sin frameworks (no Slim, no Laravel). Hostinger shared no permite Composer en producción.
- `api_headers()` y `api_error()` viven en `product/api/lib/config.php`.
- `supabase_query($table, $params)` vive en `product/api/lib/supabase.php`. Cliente REST minimal con cURL nativo. Soporta operadores PostgREST: `eq, neq, gt, gte, lt, lte, like, ilike, in, is`.
- `env($key)` lee del `.env` via loader propio en `product/api/config/env.php` (no usa Composer ni vlucas/phpdotenv).

**Paths:**
- `product/api/lib/config.php` — helpers de período, formato, headers.
- `product/api/lib/supabase.php` — cliente REST.
- `product/api/config/env.php` — loader `.env`.
- `product/api/endpoints/bofu.php` — ejemplo complejo (dedup, canal filter, sales_list, activity join).
- `product/api/endpoints/mofu.php` — ejemplo con cohort/event semantic split.

**Adaptación a finanzas:** Si tu stack es PHP, copiá el patrón literal. Si es Node/Python/Go, mantené la estructura "1 archivo por endpoint, sin frameworks pesados, helpers compartidos en `lib/`".

---

### 3.6 Frontend vanilla con USE_MOCK toggle

HTML único, secciones SPA conmutadas con CSS. Chart.js + Leaflet via CDN. Estado de UI en `localStorage` (`umoh:period`, `umoh-theme`, `umoh:bofu_canal`, etc.).

**El toggle de mock**: cada endpoint puede estar en mock o real independientemente. Misma signature en JS.

```js
// product/dashboard/assets/js/api.js
const USE_MOCK = {
  summary: false,
  tofu:    false,
  mofu:    false,
  bofu:    false,
  // ...
};

async function fetchData(endpoint, params = {}) {
  if (USE_MOCK[endpoint] !== false) {
    return getMockData(endpoint, params);
  }
  const url = new URL(`${API_BASE}/${endpoint}.php`, window.location.href);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { credentials: 'same-origin' });
  if (res.status === 401) {
    try { return await getMockData(endpoint, params); } catch (_) {}
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
```

**Reglas:**
1. **Same API signature** en mock y real. El componente que consume no sabe la diferencia.
2. **Fallback a mock en 401**: si el usuario no tiene sesión, el dashboard sigue rindiendo (pantalla blanca = peor UX que datos demo).
3. **Cache-busting**: assets se cargan con `?v=<filemtime>` para que el navegador no sirva versiones viejas tras un deploy. Inyectado en `index.php` antes de cada `<script>` y `<link>`.

**Paths:** `product/dashboard/assets/js/api.js`, `product/dashboard/assets/js/mockdata.js`, `product/dashboard/assets/js/filters.js`, `product/dashboard/index.php` (asset versioning).

**Adaptación a finanzas:** Idéntico. El toggle USE_MOCK acelera muchísimo el desarrollo cuando el pipeline no está listo o cuando estás testeando UI.

---

### 3.7 UX para usuario final no-técnico

El dashboard sirve a dueños de negocio. Decisiones de UX que vienen de esa restricción:

1. **KPI cards son clickeables**. Abren modal con: fórmula simple, descripción en lenguaje natural, ejemplo con números reales del período. Ver `product/dashboard/assets/js/filters.js` (objeto `KPI_DETAILS`).
2. **Períodos sencillos**: "últimos 30 días", "últimos 7 días". No timestamps Unix, no fechas SQL.
3. **Moneda formateada al locale del cliente**. `clients/{slug}.json` define `currency` y `timezone`. PHP/JS leen de ahí. Formato grande sin decimales (`$1.240.500`), no `1240500`.
4. **Mapas geográficos**: si el cliente tiene foco local (Prepagas = Mendoza), Leaflet con choropleth por ciudad. Path: `product/dashboard/assets/js/charts.js`, funciones de `geo`.
5. **Modal de detalle del lead** (`_openLeadDetailModal` en `charts.js`): header con badges (estado: Completo / Sin contabilizar / Sin precio), datos comerciales, datos del lead, acciones rápidas (Copiar ID, filtrar por asesor), historial de etapas, actividad/comentarios del CRM. Scroll del modal con scrollbar custom (thin, rounded, light+dark mode).
6. **Sin emojis en UI** (decisión Franco, 2026-05-19).
7. **Auditabilidad**: el cliente puede pedir el Sheet espejo que tiene la misma data raw que el dashboard. Genera confianza.

**Paths:** `product/dashboard/assets/js/charts.js`, `product/dashboard/assets/css/umoh.css` (sección `.kpi-modal` para scrollbar y `.lead-modal-*` para estructura).

**Adaptación a finanzas:** Mantené las 7 reglas, ajustá el copy y los KPIs al dominio. Si el usuario final es analista financiero (más técnico que dueño de prepagas), podés ser un poco más denso — pero no copies dashboards estilo Bloomberg sin filtrar.

---

### 3.8 Deploy y operación

**Pipeline de datos:** GitHub Actions cron (`.github/workflows/extract_all.yml`). Cada 6h corre extract → normalize → load. Inputs manuales: `days_back`, `client_filter`.

**Deploy del frontend:** GitHub Actions con rsync/SSH a Hostinger. Cache-busting automático (re-genera `ASSET_VERSION` por filemtime).

**Secrets de GitHub** (replicalos en el otro repo con sus equivalentes):

| Secret | Función |
|---|---|
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Backend escribe + frontend lee |
| `GOOGLE_SHEETS_SA_JSON` | Service Account para escribir en Sheets espejo |
| `HOSTINGER_SSH_*` | Deploy via rsync |
| `[fuente externa]_*` | Credenciales de cada extractor |

**Paths:** `.github/workflows/extract_all.yml`, `.github/workflows/deploy.yml`, `deploy/hostinger-guide.md`.

**Adaptación a finanzas:** Si usás Hostinger u hosting similar (shared, sin Docker), copiá el patrón rsync. Si usás Vercel/Cloudflare/Supabase Edge, el cron de Actions sigue funcionando pero el deploy del frontend cambia. La separación pipeline-vs-frontend deploy se mantiene.

---

### 3.9 Convenciones de proyecto

**HTML/CSS/JS:**
- IDs HTML kebab-case con prefijo de sección: `tofu-clicks`, `bofu-revenue`, `mofu-leads`.
- Canvas IDs: `chart-{nombre}` (ej: `chart-status`, `chart-mofu-cpl`).
- localStorage namespacing: `umoh:*` (ej: `umoh:period`, `umoh:bofu_canal`).
- Light + dark mode obligatorio. Usar tokens del design system, no colores hardcoded.

**PHP:**
- Sin frameworks. Funciones globales en `product/api/lib/`.
- Errores: `api_error(msg, code)` que hace `http_response_code()` + `echo json_encode(['error'=>...])` + `exit`.
- Auth gate al inicio de cada endpoint, no en middleware.

**Python:**
- Type hints en TODAS las funciones.
- Docstrings que explican el mapeo de campos source → canonical.
- Singleton para clientes externos (`data/connections/supabase_client.py`).
- Logging estructurado (no `print`).

**SQL:**
- Migraciones **idempotentes**: `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ADD COLUMN IF NOT EXISTS`.
- FK con `ON DELETE CASCADE` cuando la entidad hija no tiene vida propia.
- Constraints UNIQUE para dedup desde el día 1.

**Comentarios in-code:**
- Decisiones grandes documentadas inline con prefijo `decisión Franco YYYY-MM-DD:` o `audit YYYY-MM-DD:`. Estos comentarios son el changelog real.
- Si un patrón es contraintuitivo, explicar el porqué en 2-3 líneas, no solo el qué.

---

## 4. Patrones UMOH-específicos `[UMOH-SPECIFIC — DESCARTAR]`

Lo siguiente NO se copia. Marcalo en tu repo como "esto era UMOH, mi equivalente es X" antes de avanzar.

| UMOH-specific | Equivalente probable en finanzas |
|---|---|
| **Pipeline de Google Ads / Meta Ads** | API del banco/broker, scraping de portal, exports manuales CSV, ledger contable, exchange API |
| **Modelo TOFU/MOFU/BOFU del funnel comercial** | Definí tu propio funnel: ej. Captura → KYC → Activación → Inversión Activa; o Ingreso → Asignación → Performance → Retiro |
| **MeisterTask como CRM (con CSV semanal)** | Notion DB, Linear, Airtable, o tabla propia. El patrón "exportar a CSV, parsear, normalizar" se transfiere; la fuente no |
| **Schema canónico `tofu_ads_daily / leads / lead_monetary`** | Reemplazá con tu schema canónico propio. El PATRÓN de tener UN schema canónico al que normalizar todo es lo que se traslada |
| **Vocabulario "campaña vs vendedor" para canal de leads** | En finanzas equivalente: "adquirido vs orgánico", "self-service vs advisor", según tu modelo |
| **Métrica ROAS** | En finanzas equivalente: ROI sobre fee, NIM (Net Interest Margin), Sharpe ratio, etc. Pero **elegí UNA métrica de rentabilidad** y aplicala en todas las vistas (ver 5) |
| **Identidad visual UMOH** (paleta `--umoh-accent`) | Tu identidad de marca |

**Importante:** los archivos `data/extractors/`, `data/normalizers/canonical.py` y `data/normalizers/meistertask.py` son UMOH-specific en su contenido pero TRANSFERIBLES en su estructura. Usalos como template, no como código a copiar literal.

---

## 5. Decisiones-cicatriz (anti-patrones aprendidos)

Bugs reales que se cometieron y curaron. Si tu repo arranca evitándolos, ahorrás semanas.

1. **Cada endpoint con su propio cálculo de período.** Resultado: el mismo "últimos 30 días" daba 4 ventanas distintas (`inicio`, `tofu`, `mofu`, `bofu`, `summary`). Curado con `global_period_dates()` centralizado. **Regla: el período es UN solo helper, llamado por TODOS los endpoints.**

2. **`substr($iso, 0, 10)` para extraer YYYY-MM-DD.** Funciona en UTC, falla en cualquier otra timezone. Tarea creada a las 22:00 hs Argentina queda contada un día tarde. **Regla: siempre `to_app_date(iso)`** (TZ-aware).

3. **Tablas precomputadas `*_facts` desincronizadas con tablas raw.** El endpoint `inicio.php` leía de `tofu_facts/mofu_facts/bofu_facts` mientras el resto leía raw. KPIs divergían. **Regla: o todo raw, o todo facts. Si tenés ambas, marcá explícitamente qué endpoint usa cuál y por qué.**

4. **ROI y ROAS conviviendo en distintas vistas.** Misma información (revenue vs spend), distinta unidad (porcentaje vs multiplicador). Confundía. **Regla: elegí UNA métrica de rentabilidad y aplicala en TODAS las vistas. Si necesitás dos, deben tener nombres claramente distintos y propósito claramente distinto.**

5. **Dedup solo en la DB.** Postgres trata `NULL != NULL` en UNIQUE → filas duplicadas que pasan el constraint. **Regla: dedup en la DB Y en la aplicación. La aplicación elige por completitud + recency.**

6. **Frecuencia de pipeline mayor al lag de la fuente.** Extraer cada hora cuando Google Ads tarda 3h en consolidar = solo cargás la API sin ganar nada. **Regla: ajustá frecuencia al lag de la fuente más lenta.**

7. **Cohort view vs event view del mismo concepto.** MOFU contaba "Ventas Ganadas" como "leads creados en período que hoy están ganados" (cohort). BOFU contaba "Ventas Cerradas" como "ventas que se cerraron en período" (event). Daban números distintos. **Regla: para el MISMO concepto, una semántica única. Si el dominio exige dos vistas, nombralas distinto (`leads_ganados_del_cohort` vs `ventas_cerradas_en_periodo`).**

8. **MeisterTask URL deep-link sin verificar.** Pusimos botón "Abrir en MeisterTask" → no funcionaba con todas las cuentas → mejor sin botón. **Regla: cualquier link externo que dependa de cuenta del usuario, validalo o no lo pongas.**

9. **Modal sin scroll bonito y sin `overscroll-behavior: contain`.** Cuando el modal scrollea, sin contención el body de la página también scrollea. UX rota. **Regla: modals con `overscroll-behavior: contain` + scrollbar custom (thin, rounded). Ver `.kpi-modal` en `product/dashboard/assets/css/umoh.css`.**

10. **CLAUDE.md desincronizado con la realidad.** El CLAUDE.md decía `config/clients/{slug}.yaml` pero el archivo vive en `clients/{slug}.yaml`. **Regla: si renombrás archivos, actualizá CLAUDE.md en el mismo commit.**

---

## 6. Apéndice — paths del repo UMOH para inspirarse

Tabla de archivos del repo UMOH que vale la pena tener abiertos cuando estás auditando o adaptando un patrón. **No los copies literal**; usalos como referencia.

| Path UMOH | Para inspirarse en |
|---|---|
| `product/api/lib/config.php` | Helper de período, formato, headers (sección 3.2) |
| `product/api/lib/supabase.php` | Cliente REST minimal sin Composer (sección 3.5) |
| `product/api/config/env.php` | Loader `.env` sin Composer (sección 3.5) |
| `product/api/endpoints/bofu.php` | Endpoint complejo: dedup, filter, JOIN-like en PHP (sección 3.4, 3.5) |
| `product/api/endpoints/mofu.php` | Endpoint con cohort/event split (sección 5 cicatriz #7) |
| `supabase/migrations/001_initial.sql` | Multi-tenant PK + tablas core (sección 3.1) |
| `supabase/migrations/005_rls_policies.sql` | RLS policies template (sección 3.1) |
| `data/normalizers/canonical.py` | Schema canónico como contrato (sección 3.3, 3.4) |
| `data/normalizers/meistertask.py` | Parser robusto con type hints + docstrings (sección 3.3, 3.9) |
| `data/loaders/sheets_writer.py` | Loader con dedup + espejo opcional (sección 3.3) |
| `.github/workflows/extract_all.yml` | Pipeline cron + manual trigger (sección 3.8) |
| `clients/prepagas.json` + `clients/prepagas.yaml` | Multi-tenant config (sección 3.1) |
| `product/dashboard/assets/js/api.js` | USE_MOCK toggle pattern (sección 3.6) |
| `product/dashboard/assets/js/charts.js` (`_openLeadDetailModal`) | Modal con badges + acciones (sección 3.7) |
| `product/dashboard/assets/css/umoh.css` (`.kpi-modal`) | Scrollbar custom light+dark (sección 3.7, cicatriz #9) |
| `README.md` + `ARCHITECTURE.md` + `CLAUDE.md` | Contexto general |

---

## 7. Próximos pasos (deuda detectada al escribir este doc)

Cosas que UMOH también tiene que curar — útil saber por si las copiás sin querer:

1. **CLAUDE.md de UMOH dice `config/clients/{slug}.yaml`** pero el archivo vive en `clients/{slug}.yaml`. UMOH lo va a sincronizar.
2. **El patrón ETL** carece de un test de smoke (ej: corrido en CI cada PR). En tu repo, arrancá con tests desde el día 1.
3. **El cliente Supabase REST** (`product/api/lib/supabase.php`) no expone helpers de paginación. Para datasets > 5000 filas hay que paginar manualmente. Si tu volumen lo justifica, arrancá con wrapper paginado.
4. **El loader de Sheets** es opcional pero no está documentado claramente cuándo conviene usarlo. Para finanzas, donde la auditabilidad puede ser regulatoria, probablemente convenga sí o sí desde el día 1.
5. **No hay `PATTERNS_TO_BACKPORT.md` aún en UMOH.** Si tu repo descubre patrones mejores, faltaría el canal de regreso. Por ahora, anótalos en tu repo y los integramos manualmente.

---

**Versión:** 2.0 — 2026-05-19. Si UMOH o el repo de finanzas evolucionan y los patrones cambian, actualizar este doc en ambos lados.
