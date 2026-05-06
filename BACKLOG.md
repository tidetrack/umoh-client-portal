# BACKLOG — UMOH Client Portal

**Última actualización:** 2026-05-05
**Cliente activo:** Prevención Salud (`prepagas.umohcrew.com`)
**Estado general:** Dashboard en staging con datos reales de TOFU (Google Ads). MOFU, BOFU y SUMMARY conectados a Supabase. Pendiente publicar en producción, validar datos en vivo, agregar filtro global de campaña y dejar el dashboard responsivo en mobile.

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

- [ ] **1.1** Pasar el dashboard del entorno de prueba al servidor real donde el cliente va a acceder.
  **Complejidad:** Baja
  **Qué es:** "Staging" es el entorno de prueba (como el backstage de un teatro). "Producción" es el entorno real donde el cliente entra. Hoy el dashboard funciona en staging; hay que hacer el deploy (publicación) al servidor de Hostinger para que quede en `prepagas.umohcrew.com`.
  **Por qué importa:** Sin esto, el cliente no puede ver nada. Es la tarea más simple y la primera que hay que hacer.
  **Recomendación: arrancar por acá.**

---

### 5.1 — Login por cliente (autenticación)

- [ ] **5.1** Activar el sistema de login para que solo el cliente autorizado pueda ver su dashboard.
  **Complejidad:** Media
  **Qué es:** Hoy el dashboard tiene el login desactivado intencionalmente (`PHASE1_BYPASS = true`) para poder probar sin contraseña. Antes de publicar al cliente, hay que activar el login real con usuario y contraseña guardados en la base de datos.
  **Por qué importa:** Sin login, cualquier persona con la URL puede ver los datos del cliente. No es aceptable para un dashboard comercial.

---

### 1.2 — MOFU con datos reales

- [ ] **1.2** Verificar y validar que la sección MOFU muestra datos reales del cliente.
  **Complejidad:** Baja-Media
  **Qué es:** MOFU (Middle of Funnel) es la etapa de leads — personas que contactaron al cliente pero todavía no compraron. El código ya está escrito para leer de la base de datos real (Supabase), pero hay que validar que los números que se muestran son correctos y no tienen errores.
  **Por qué importa:** Es uno de los tres bloques principales del dashboard. Si muestra mal los leads, el cliente pierde confianza en todo el sistema.

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

### 3.1 — Actualizar Node.js en GitHub Actions (deadline: junio 2026)

- [ ] **3.1** Actualizar la versión de Node.js que usan las automatizaciones del pipeline antes de que GitHub las fuerce.
  **Complejidad:** Baja
  **Qué es:** GitHub Actions (el sistema que ejecuta el pipeline automático cada 6 horas) usa internamente Node.js 20, que será obsoleto en junio 2026. GitHub va a forzar la actualización a Node 24. Si no lo hacemos antes, el pipeline puede romperse o mostrar advertencias que causen ruido.
  **Por qué importa:** Tiene un deadline duro: junio 2026. Si se lanza el MVP en mayo, hay que resolverlo inmediatamente después — no puede quedar para "algún día".

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

### 1.9 — Rediseñar el funnel del MOFU (forma de embudo real) — *bloquea el deploy de 1.1*

- [ ] **1.9** Cambiar el diseño del bloque que tiene la clase `chart-card-body chart-body--tall` (el funnel del MOFU) para que tenga forma visual de embudo.
  **Complejidad:** Baja-Media
  **Qué es:** Hoy el funnel del MOFU se renderiza dentro de un contenedor `chart-body--tall` que no se lee como embudo — las fases del lead (Contactado, En Emisión, etc.) se muestran de una forma que no tiene la silueta cónica clásica de un embudo de ventas.
  **Por qué importa:** El concepto del producto es "ver el funnel completo del cliente". Si el gráfico que más representa esa idea no parece un funnel, se pierde el mensaje visual. Antes de mostrarle el dashboard al cliente, este elemento tiene que comunicar correctamente la metáfora del embudo.
  **Bloquea:** la tarea 1.1 (deploy a producción). No queremos publicar un funnel que visualmente confunde al cliente.

---

### 6.1 — Diseño responsivo (mobile) — *último paso del MVP*

- [ ] **6.1** Adaptar todo el dashboard para que se vea y funcione bien en celulares y tablets.
  **Complejidad:** Media
  **Qué es:** Hoy el dashboard está optimizado para pantallas grandes (computadora). En un celular se ve mal: los gráficos se cortan, los menús no caben, los números se solapan. "Responsivo" significa que el diseño se adapta automáticamente al tamaño de la pantalla — en celular se reorganiza para que sea cómodo de leer y usar con el dedo.
  **Por qué importa:** Los clientes van a abrir el dashboard desde el celular muchas veces (en una reunión, en un viaje, etc.). Si se ve roto, el producto pierde credibilidad inmediatamente.
  **Por qué es el último paso:** Una vez que el contenido (datos reales, filtros, todo) está estable, ahí tiene sentido hacer el ajuste de layout mobile. Hacerlo antes implica rehacerlo si después cambia algo del contenido.

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

## Decisiones pendientes

Estas son preguntas abiertas que requieren input de Franco:

| # | Pregunta | Estado |
|---|----------|--------|
| A | ¿Arrancamos por la tarea 1.1 (publicar en producción) como primera acción? | ✅ Confirmado 2026-05-05 |
| B | ¿La 5.1 (login) tiene que estar resuelta ANTES de compartir la URL pública con el cliente? | Pendiente confirmación |

---

## Bitácora — Hitos completados

| Fecha | Hito |
|-------|------|
| 2026-04-29 | MVP TOFU cerrado en staging: datos reales de Google Ads → Supabase → PHP → dashboard |
| 2026-04-29 | Supabase con 8 tablas aplicadas en producción (migraciones 001-006) |
| 2026-04-29 | GitHub Actions pipeline cada 6h funcionando: extrae Google Ads, escribe en Supabase |
| 2026-04-23 | Diseño del funnel MOFU con escala cromática por fase del ciclo de vida |
| 2026-04-21 | Login page rediseñada con identidad visual UMOH |
| 2026-04-21 | KPI cards con modales explicativos (nombre, fórmula, descripción, ejemplo) |
| 2026-04-20 | Dashboard SPA completo con 4 vistas y Chart.js 4 |
