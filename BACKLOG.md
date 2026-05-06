# BACKLOG — UMOH Client Portal

**Última actualización:** 2026-05-05
**Cliente activo:** Prevención Salud (`prepagas.umohcrew.com`)
**Estado general:** Dashboard EN PRODUCCIÓN con TOFU/MOFU/BOFU/SUMMARY desde Supabase. Customer journey CRM de 13 etapas con motion. Pendiente: validar datos en vivo, mapa geo real, filtro de campaña, mobile responsive y entrega de credenciales al cliente.

---

## Cómo leer este documento

- **MVP** = lo que hay que terminar SÍ o SÍ antes de mostrarle el dashboard al cliente.
- **Post-MVP** = mejoras que agregan valor pero no bloquean el lanzamiento.
- **Complejidad** = estimación de esfuerzo: Baja (horas), Media (1-2 días), Alta (varios días).
- Los checkboxes `[x]` se marcan cuando la tarea está terminada.
- Las palabras técnicas entre paréntesis son explicaciones para que cualquiera entienda de qué estamos hablando.

---

## MVP — Lo que queda para cerrar el lanzamiento

Estas tareas bloquean el lanzamiento. Sin ellas el cliente no puede usar el producto.

---

### 1.1 — Publicar staging en producción

- [x] **1.1** Pasar el dashboard del entorno de prueba al servidor real donde el cliente va a acceder.
  **Hecho:** 2026-05-05 (commit merge `c55b46e` a main, deploy automático a `prepagas.umohcrew.com`).
  **Complejidad:** Baja
  **Qué es:** "Staging" es el entorno de prueba (como el backstage de un teatro). "Producción" es el entorno real donde el cliente entra. Hoy el dashboard funciona en staging; hay que hacer el deploy (publicación) al servidor de Hostinger para que quede en `prepagas.umohcrew.com`.
  **Por qué importa:** Sin esto, el cliente no puede ver nada. Es la tarea más simple y la primera que hay que hacer.

---

### 1.9 — Rediseñar el funnel del MOFU (forma de embudo real)

- [x] **1.9** Cambiar el diseño del bloque que tiene la clase `chart-card-body chart-body--tall` (el funnel del MOFU) para que tenga forma visual de embudo.
  **Hecho:** 2026-05-05 — iterado 5 veces hasta llegar a "Customer Journey CRM": 13 etapas literales de MeisterTask (sin Tareas Finalizadas), paleta cromática semántica por sub-fase, altura grande, motion (stagger entrance + hover + transición de período), banda de sub-fases.
  **Complejidad:** Baja-Media

---

### 1.2 — MOFU con datos reales

- [x] **1.2** Verificar y validar que la sección MOFU muestra datos reales del cliente.
  **Hecho:** 2026-05-05 — auditoría completa contra Supabase: 77 leads de campaña / $508k spend / CPL $6.6k correcto. Fixes aplicados: (1) tipification_rate ya no infla 10pts; (2) "Ventas Ganadas" tiene KPI propio. Deudas técnicas menores anotadas para post-MVP.
  **Complejidad:** Baja-Media

---

### 1.3 — BOFU con datos reales

- [ ] **1.3** Verificar y validar que la sección BOFU muestra datos reales del cliente.
  **Complejidad:** Baja-Media
  **Qué es:** BOFU (Bottom of Funnel) es la etapa de ventas cerradas — los clientes que sí compraron. Al igual que MOFU, el código ya lee de Supabase; hay que validar que los números están bien.
  **Por qué importa:** Es el número más importante para el cliente: cuánto vendieron y qué ticket promedio. Si falla, el dashboard no tiene valor.

---

### 1.4 — SUMMARY con datos reales

- [ ] **1.4** Verificar y validar que la vista "Resumen general" (Performance) muestra datos reales.
  **Complejidad:** Baja
  **Qué es:** La vista de Resumen muestra los KPIs principales del embudo completo: impresiones, leads, ventas, ROI. Es la primera pantalla que ve el cliente al entrar. Ya lee de Supabase.
  **Por qué importa:** Es la "portada" del dashboard. Si el cliente entra y ve números raros o cero, es la primera impresión.

---

### 1.5 — Mapa geográfico con datos reales

- [ ] **1.5** Conectar el mapa de provincias con los datos reales de Google Ads.
  **Complejidad:** Media
  **Qué es:** El dashboard tiene un mapa interactivo de Argentina que muestra de qué provincias vienen los clicks. Hoy tiene datos reales en Supabase, pero hay que validar que el extractor de Google Ads está cargando los datos geográficos correctamente (en la sesión anterior se detectó que podía estar en cero).
  **Por qué importa:** Es un elemento visual diferencial que muestra al cliente de dónde viene su audiencia. Si el mapa está vacío, se ve incompleto.

---

### 1.6 — Investigar canal/dispositivo en cero

- [ ] **1.6** Diagnosticar por qué los gráficos de "canal" y "dispositivo" muestran cero.
  **Complejidad:** Media
  **Qué es:** El dashboard tiene gráficos que muestran desde qué canal (Search, Display, Video) y desde qué dispositivo (celular, computadora) vienen los clicks. Hoy todos esos valores están en cero. Puede ser un problema del extractor (el script que descarga datos de Google Ads) o que la cuenta de prepagas realmente no tiene esa información disponible.
  **Por qué importa:** Si son cero porque el extractor falla, hay que arreglarlo. Si son cero porque la cuenta no tiene ese dato, hay que ocultarlos del dashboard para que no confundan al cliente.

---

### 1.7 — Google Sheet espejo de Supabase (transparencia de datos)

- [ ] **1.7** Activar la escritura paralela en Google Sheets para que el cliente pueda auditar los datos crudos.
  **Complejidad:** Media
  **Qué es:** Hoy los datos viven en Supabase (la base de datos interna). El cliente solo ve el dashboard, no puede ver los números crudos. La idea es que en paralelo a guardar en Supabase, también se escriban en una Google Sheet (hoja de cálculo de Google) con las mismas tablas. El cliente puede abrir esa hoja y verificar los números por sí mismo.
  **Por qué importa:** Es una capa de transparencia — el cliente puede "auditar" los datos sin depender de nosotros. Esto construye confianza en el producto, que es el diferencial de UMOH. El código ya tiene parte de esta infraestructura (`data/loaders/sheets_writer.py`); hay que reactivarla y conectarla bien al pipeline actual.

---

### 1.8 — Filtro global de campaña activa

- [ ] **1.8** Agregar un selector de campaña visible en todas las pestañas, que filtre los datos del dashboard por la campaña elegida.
  **Complejidad:** Media-Alta
  **Qué es:** Hoy el dashboard muestra los datos de TODAS las campañas mezcladas. La idea es agregar un selector (un menú desplegable) en la parte superior del dashboard donde el usuario pueda elegir qué campaña ver. Una vez elegida, todos los gráficos, números y tablas (TOFU, MOFU, BOFU, SUMMARY) se actualizan para mostrar SOLO los datos de esa campaña.
  **Requisitos del selector:**
  - Visible en TODAS las vistas (TOFU, MOFU, BOFU, Performance) y en TODO momento — no se oculta cuando se cambia de pestaña.
  - Tiene que mostrar el **nombre** y el **ID** de la campaña seleccionada (ej: "Campaña Otoño 2026 — ID 21834719283").
  - Debe haber una opción para "Todas las campañas" (volver a la vista agregada).
  **Por qué importa:** Es lo que transforma el dashboard de un reporte general a una herramienta de análisis. El cliente puede comparar campañas, ver cuál performa mejor, decidir dónde invertir más. Sin esto, todos los datos quedan mezclados.
  **Impacto técnico:** Toca todos los endpoints PHP (que tienen que aceptar un parámetro `campaign_id`), todas las queries a Supabase, el frontend (estado global del filtro), y los datos del pipeline (asegurar que el `campaign_id` se está guardando en todas las tablas).

---

### 1.10 — Totales por sub-fase del journey *(pulida del journey)*

- [x] **1.10** Mostrar el total acumulado de leads por cada sub-fase del customer journey (Entrada, Seguimiento, Alta intención, Incubando, Resultado).
  **Hecho:** 2026-05-05 — agregado en la banda de la sub-fase, junto al label. Recalcula al cambiar período. Pendiente próximo deploy a producción.
  **Complejidad:** Baja

---

### 1.11 — Estandarización del schema Supabase + campaign_id en todas las tablas *(prerequisito de 1.7 y 1.8)*

- [ ] **1.11** Diseñar y aplicar un schema estandarizado en Supabase con una tabla "facts" por fase del funnel (TOFU/MOFU/BOFU), todas con la misma estructura base e incluyendo `campaign_id` en cada fila.
  **Complejidad:** Alta
  **Qué es:** Hoy las tablas de Supabase tienen formas diferentes según la fase del funnel: `tofu_ads_daily` (granularidad diaria), `leads` (un registro por lead individual), `lead_monetary` (datos de venta). Hay que crear una tabla "facts" por fase con un schema estándar: `client_slug`, `date`, `campaign_id`, `campaign_name` y las métricas propias de la fase.
  **Decisión sobre campaign_id (2026-05-05):**
  - **Modelo definitivo:** `campaign_id` se obtiene del **tag de MeisterTask** del lead. A futuro, cada lead lleva un tag con el ID de la campaña que lo originó.
  - **Para Prepagas hoy:** tiene UNA sola campaña activa (PMAX). Todos los leads existentes y nuevos se asocian al `campaign_id` de PMAX hasta que el cliente sume otra campaña. La extracción de Google Ads tiene que empezar a traer `campaign.id` y `campaign.name` (hoy no lo hace).
  - **Cuando se sume una segunda campaña:** activamos el flujo de tags de MeisterTask. Esto requiere acordar con el cliente que tagee los leads.
  **Por qué importa (no técnico):** Hace los datos predecibles y replicables. El cliente abre la hoja, ve 3 tablas con la misma estructura: cliente, fecha, campaña, números. Es transparencia + escalabilidad. Y el filtro de campaña (1.8) necesita campaign_id en TODAS las tablas para funcionar.
  **Bloquea:** las tareas 1.7 (sheets espejo) y 1.8 (filtro de campaña).

---


---

### 3.1 — Actualizar Node.js en GitHub Actions (deadline: junio 2026)

- [ ] **3.1** Actualizar la versión de Node.js que usan las automatizaciones del pipeline antes de que GitHub las fuerce.
  **Complejidad:** Baja
  **Qué es:** GitHub Actions (el sistema que ejecuta el pipeline automático cada 6 horas) usa internamente Node.js 20, que será obsoleto en junio 2026. GitHub va a forzar la actualización a Node 24. Si no lo hacemos antes, el pipeline puede romperse o mostrar advertencias que causen ruido.
  **Por qué importa:** Tiene un deadline duro: junio 2026. Si se lanza el MVP en mayo, hay que resolverlo inmediatamente después — no puede quedar para "algún día".

---

### 6.1 — Diseño responsivo (mobile) — *anteúltimo paso del MVP*

- [ ] **6.1** Adaptar todo el dashboard para que se vea y funcione bien en celulares y tablets.
  **Complejidad:** Media
  **Qué es:** Hoy el dashboard está optimizado para pantallas grandes (computadora). En un celular se ve mal: los gráficos se cortan, los menús no caben, los números se solapan. "Responsivo" significa que el diseño se adapta automáticamente al tamaño de la pantalla — en celular se reorganiza para que sea cómodo de leer y usar con el dedo.
  **Por qué importa:** Los clientes van a abrir el dashboard desde el celular muchas veces (en una reunión, en un viaje, etc.). Si se ve roto, el producto pierde credibilidad inmediatamente.

---

### 5.1 — Login del cliente — *último paso, justo antes de entregar*

- [ ] **5.1** Generar la contraseña real para el usuario `prepagas`, cargarla en `UMOH_PREPAGAS_HASH` (GitHub Secret) y entregársela al cliente con sus credenciales.
  **Complejidad:** Baja
  **Qué es:** El sistema de login ya está activo en producción (sin bypass). Hoy hay un hash placeholder cargado. Cuando esté todo listo para entregar, generamos una contraseña real, la cargamos en el secret, redeployamos, y compartimos las credenciales con el cliente.
  **Por qué importa:** Es el paso final antes de que el cliente entre. Si se hace antes y se filtra la URL, podrían acceder con la contraseña temporal.
  **Por qué es el último paso:** Franco prefiere dejarlo cerrado al final del MVP, una vez que todo el resto esté validado y el dashboard listo para mostrar.

---

## Post-MVP — Mejoras planificadas

Estas tareas mejoran el producto pero no bloquean el lanzamiento. Se trabajan después de que el cliente esté activo.

---

### 5.2 — Email semanal automático *(primera mejora post-MVP)*

- [ ] **5.2** Enviar automáticamente un resumen semanal por email al cliente con los KPIs de la semana.
  **Complejidad:** Media
  **Qué es:** Cada semana, el sistema enviaría un email a `prevencionsalud.ventasmendoza@gmail.com` con un resumen de impresiones, leads y ventas. El cliente recibiría un "reporte en bandeja de entrada" sin tener que entrar al dashboard.
  **Por qué importa:** Agrega valor pasivo — el cliente recibe información sin esfuerzo de su parte. Está marcado como la primera mejora a hacer después del MVP porque ya hay infraestructura pensada para esto y la demanda es clara.

---

### 2.1 — MeisterTask automático (carga de leads sin CSV)

- [ ] **2.1** Conectar directamente con MeisterTask para traer los leads automáticamente en lugar de subir un CSV manual.
  **Complejidad:** Alta
  **Qué es:** Hoy los leads (personas interesadas que hay que gestionar) se cargan al sistema subiendo un archivo CSV (una planilla) manualmente. La mejora sería conectar directamente a la API de MeisterTask (el sistema de gestión de leads que usa el cliente) para que los datos se actualicen solos sin intervención humana.
  **Por qué no es MVP:** El flujo manual con CSV funciona bien para este cliente hoy. La automatización es una mejora de eficiencia, no un requisito de lanzamiento.

---

### 2.2 — Meta Ads (Facebook/Instagram)

- [ ] **2.2** Conectar el pipeline con la API de Meta para traer datos de campañas de Facebook e Instagram.
  **Complejidad:** Alta
  **Qué es:** Así como hoy traemos datos de Google Ads, también podríamos traer datos de campañas en Facebook e Instagram (Meta). Eso requiere conectar la API de Meta Ads y extender el dashboard para mostrar los datos por plataforma.
  **Por qué no es MVP:** El cliente activo (Prevención Salud) no tiene campañas activas en Meta. No aplica ahora. Se hace cuando haya un cliente que lo necesite.

---

### 4.1 — Diseño liquid glass

- [ ] **4.1** Aplicar el estilo visual "liquid glass" a los elementos del dashboard.
  **Complejidad:** Media
  **Qué es:** "Liquid glass" es un efecto visual moderno con bordes brillantes y fondos traslúcidos que hace que los paneles del dashboard se vean más premium y pulidos.
  **Por qué no es MVP:** Es una mejora estética pura. El dashboard ya se ve bien; esto es "nice to have".

---

### 4.2 — Líneas de tendencia en gráficos

- [ ] **4.2** Agregar líneas de tendencia a los gráficos de evolución temporal.
  **Complejidad:** Baja
  **Qué es:** Una línea de tendencia (o "línea de regresión") se superpone sobre un gráfico de barras o líneas para mostrar la dirección general del crecimiento o caída, independientemente de las fluctuaciones diarias. Permite ver de un vistazo si los resultados van "para arriba" o "para abajo".
  **Por qué no es MVP:** Es una mejora de visualización que agrega valor analítico rápido. Tarea chica, ideal para la primera iteración post-lanzamiento junto con el email semanal.

---

### 1.12 — Calidad de atribución: gap entre conversiones de Google y leads del CRM *(control de calidad)*

- [ ] **1.12** Comparar las conversiones que Google Ads reporta contra los leads efectivamente cargados al CRM (MeisterTask), y exponer el gap como una métrica visible.
  **Complejidad:** Media-Alta
  **Qué es:** Google Ads cuenta una "conversión" cada vez que alguien completa el formulario o llama al click-to-call. Pero entre ese evento y un lead efectivo en MeisterTask hay pérdidas: bots, leads duplicados, formularios completados que el vendedor no carga al CRM, errores de tracking. Esta tarea cruza ambas fuentes y muestra:
  - Conversiones reportadas por Google Ads (período X): N
  - Leads cargados en MeisterTask del mismo período: M
  - Match: cuántos coinciden (criterio: timestamp + canal o gclid si está disponible)
  - Gap: |N - M|, expresado como % de pérdida o de exceso
  **Por qué importa:** Es la métrica de **salud del pipeline de atribución**. Si el gap es del 5% el sistema funciona; si es del 30% hay un problema (formulario roto, vendedor que no carga, doble conteo de Google). Convierte el dashboard en una herramienta de diagnóstico, no solo de reporting.
  **Implementación:** Requiere que el extractor de Google Ads traiga el conteo de conversiones por campaña/día (no solo clicks/impresiones). Idealmente usar `gclid` para matching exacto, pero como el formulario del cliente todavía no captura gclid, arrancamos por matching aproximado (timestamp + canal).
  **Por qué no es MVP:** Marcado Post-MVP por decisión de Franco (2026-05-05) — el MVP cierra mostrando datos correctos; la calidad de atribución es una mejora analítica posterior al lanzamiento.

---

### 2.3 — Google Analytics

- [ ] **2.3** Conectar Google Analytics para traer datos de tráfico web orgánico.
  **Complejidad:** Alta
  **Qué es:** Google Analytics registra todo el tráfico que llega al sitio web del cliente — no solo los que vienen de anuncios pagos, sino también los que llegan de forma orgánica (búsquedas sin pagar). Conectar esta fuente permitiría ver el funnel completo incluyendo tráfico gratuito.
  **Por qué no es MVP:** El cliente actual no la pidió explícitamente. La tabla `ga_traffic_daily` ya existe en Supabase (estructura preparada), pero el extractor necesita construirse. Se hace cuando el cliente lo pida o cuando avancemos en la propuesta de valor diferencial.

---

### 7.1 — Panel admin para regeneración de contraseñas

- [ ] **7.1** Construir un panel de administrador donde se pueda regenerar la contraseña de cualquier cliente con flujo UX simple.
  **Complejidad:** Media-Alta
  **Qué es:** Hoy las contraseñas viven como hashes (versión "encriptada" de la contraseña) cargados manualmente en GitHub Secrets. Si un cliente olvida la contraseña, hay que generar el hash a mano, cargarlo en GitHub y redeployar — proceso lento y técnico. La idea es construir un panel web donde el admin (vos) entre, elija un cliente y genere una contraseña nueva en dos clicks: el sistema actualiza el hash en la base de datos y el cliente recibe la nueva contraseña por email.
  **Por qué no es MVP:** Para el primer cliente alcanza con que vos gestiones la contraseña una vez. Cuando se sumen 3+ clientes o cuando alguno necesite resetear, este panel se vuelve crítico.
  **Por qué importa post-MVP:** Es un trabajo de plataforma — desbloquea el escalamiento a más clientes sin que cada cambio de contraseña sea un evento técnico.

---

## Decisiones tomadas

| # | Pregunta | Resolución |
|---|----------|------------|
| A | ¿Arrancamos por la tarea 1.1 (publicar en producción)? | Sí — 2026-05-05 |
| B | ¿La 5.1 (login del cliente) va antes de compartir URL? | Se hace al final, una vez que todo el MVP esté validado — 2026-05-05 |
| C | ¿Forzamos orden decreciente del journey? | No, respetar datos reales — 2026-05-05 |
| D | ¿Mostramos las 14 etapas literales o agrupamos en buckets? | 14 etapas literales (luego se ocultó "Tareas Finalizadas" → 13 visibles) — 2026-05-05 |
| E | ¿De dónde sale el `campaign_id` de los leads? | Tag de MeisterTask a futuro. Hoy Prepagas tiene UNA sola campaña (PMAX) — todos los leads se asocian al mismo ID — 2026-05-05 |
| F | Desglose por segmento BOFU: ¿usar campo `operatoria` o `tipification`? | `tipification` (Voluntario / Monotributista / Obligatorio). `operatoria` no es indicador relevante — 2026-05-05 |
| G | Conversion rate: ¿qué denominador? | Las 3 versiones (acumulado, mes mismo, 30d móviles). La principal es **B (mes mismo)** para comparar mes a mes — 2026-05-05 |
| H | Tarea 1.12 (calidad de atribución): ¿MVP o Post-MVP? | Post-MVP — 2026-05-05 |

---

## Bitácora — Hitos completados

| Fecha | Hito |
|-------|------|
| 2026-05-05 | **Tarea 1.1 cerrada:** deploy a producción exitoso (`prepagas.umohcrew.com`). MVP TOFU/MOFU/BOFU/SUMMARY desde Supabase visible al público (con login activo) |
| 2026-05-05 | **Tarea 1.9 cerrada:** customer journey del MOFU rediseñado con 13 etapas literales del CRM, paleta cromática semántica, motion y banda de sub-fases agrupadora |
| 2026-05-05 | BACKLOG.md vivo creado con 14 tareas categorizadas MVP / Post-MVP y trazabilidad de decisiones |
| 2026-04-29 | MVP TOFU cerrado en staging: datos reales de Google Ads → Supabase → PHP → dashboard |
| 2026-04-29 | Supabase con 8 tablas aplicadas en producción (migraciones 001-006) |
| 2026-04-29 | GitHub Actions pipeline cada 6h funcionando: extrae Google Ads, escribe en Supabase |
| 2026-04-23 | Diseño del funnel MOFU con escala cromática por fase del ciclo de vida |
| 2026-04-21 | Login page rediseñada con identidad visual UMOH |
| 2026-04-21 | KPI cards con modales explicativos (nombre, fórmula, descripción, ejemplo) |
| 2026-04-20 | Dashboard SPA completo con 4 vistas y Chart.js 4 |
