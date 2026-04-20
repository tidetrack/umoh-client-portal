# Plan de Implementación — UMOH Dashboards

## Visión general

El objetivo es construir un sistema de dashboards de performance que UMOH pueda ofrecer a sus clientes como parte de su propuesta de valor diferencial. Los clientes acceden desde umohcrew.com, se loguean, y ven sus campañas activas organizadas por etapa del funnel (TOFU / MOFU / BOFU) con datos actualizados automáticamente y una interpretación de IA básica de los KPIs.

El sistema se construye por fases. La Fase 1 es un MVP completamente funcional con un solo cliente (prepagas) y una sola plataforma (Google Ads). Cada fase agrega plataformas, fuentes de datos o capacidades del dashboard.

---

## Fase 1 — MVP funcional con Google Ads + Sheets

**Objetivo**: Tener el pipeline completo funcionando de punta a punta para el cliente de prepagas, con datos reales de Google Ads en TOFU y carga manual de MOFU/BOFU en Google Sheets.

**Duración estimada**: 2-3 semanas

### 1.1 — Configurar credenciales de Google Ads API

Qué hay que hacer:
- Desde la cuenta MCC de UMOH en Google Ads, ir a Herramientas → Centro de API y solicitar un Developer Token (puede tardar algunos días en aprobarse si la cuenta es nueva en la API).
- Crear un proyecto en Google Cloud Console y habilitar la Google Ads API.
- Crear credenciales OAuth2 (tipo "Desktop app") y descargar el `client_secret.json`.
- Correr el script de autenticación una vez para generar el `refresh_token` (este proceso es manual y se hace una sola vez).
- Guardar `developer_token`, `client_id`, `client_secret` y `refresh_token` como GitHub Secrets en el repositorio.

Dependencia crítica: el Developer Token debe estar aprobado antes de poder hacer llamadas reales a la API. Solicitar esto primero.

### 1.2 — Crear Service Account para Google Sheets

Qué hay que hacer:
- En Google Cloud Console (mismo proyecto), crear una Service Account.
- Descargar el JSON de credenciales.
- Compartir la Google Sheet del cliente (la de BOFU y la de salida de datos) con el email de la Service Account.
- Guardar el JSON como el secret `GOOGLE_SHEETS_SA_JSON` en GitHub.

### 1.3 — Crear la Google Sheet canónica del cliente

Qué hay que hacer:
- Crear una Google Sheet nueva para el cliente de prepagas.
- Crear las siguientes pestañas con columnas exactas definidas en `config/schema.yaml`:
  - `tofu_raw` — datos diarios de Google Ads (impresiones, clicks, CPC, gasto, términos, canal, dispositivo)
  - `mofu_input` — carga manual de leads (columnas: fecha, total_leads, costo_lead, leads_contactados, leads_no_prospera, leads_alta_intencion, tasa_tipificacion, segmento_voluntario, segmento_monotributista, segmento_obligatorio)
  - `bofu_input` — carga manual de ventas (columnas: fecha, ingresos_totales, ventas_cerradas, ticket_promedio, capitas_cerradas, ticket_promedio_capita, ventas_voluntario, ventas_monotributista, ventas_obligatorio)
  - `dashboard_data` — pestaña calculada que combina todo (la lee el dashboard)

Advertencia: la estructura de columnas de `mofu_input` y `bofu_input` es el contrato con el equipo de ventas del cliente. No puede cambiarse después sin actualizar el pipeline. Comunicarlo al cliente en el onboarding.

### 1.4 — Escribir el extractor de Google Ads

Archivo: `extractors/google_ads.py`

Qué debe hacer:
- Autenticarse con las credenciales del MCC usando la librería `google-ads`.
- Recibir un `customer_id` como parámetro (leído desde el YAML del cliente).
- Ejecutar una query GAQL (Google Ads Query Language) para extraer métricas del período indicado: impresiones, clicks, costo, términos de búsqueda, canal de tráfico, dispositivo, datos geográficos.
- Devolver un objeto normalizado que cumpla el schema TOFU definido en `config/schema.yaml`.

Librerías necesarias: `google-ads` (librería oficial de Python), `pandas`, `pyyaml`.

### 1.5 — Escribir el normalizador canónico

Archivo: `normalizers/canonical.py`

Qué debe hacer:
- Recibir datos crudos de cualquier plataforma.
- Mapear los nombres de campos de cada plataforma al nombre canónico de UMOH (por ejemplo: `cost_micros` de Google → `spend` en canónico; `impressions` de Meta → `impressions` en canónico).
- Calcular los campos derivados: CPC = spend / clicks, CPL = spend / leads, tasa de conversión = ventas / impresiones.
- Devolver un DataFrame con el schema exacto esperado por el loader.

### 1.6 — Escribir el loader de Sheets

Archivo: `loaders/sheets_writer.py`

Qué debe hacer:
- Autenticarse con la Service Account.
- Recibir un DataFrame normalizado y el ID de la Sheet del cliente.
- Verificar si el dato del día ya existe (para no duplicar en re-ejecuciones).
- Escribir los datos en la pestaña `tofu_raw` o `dashboard_data` según corresponda.

### 1.7 — Configurar el workflow de GitHub Actions

Archivo: `.github/workflows/extract_all.yml`

Qué debe hacer:
- Correr en un cron programado (sugerido: cada 6 horas, `0 */6 * * *`).
- Leer todos los archivos YAML dentro de `config/clients/`.
- Para cada cliente activo, correr el extractor correspondiente según las plataformas habilitadas.
- Si un paso falla, enviar una notificación por email al equipo de UMOH (configurar con GitHub Actions email notifications).
- Loguear el resultado de cada ejecución para auditoría.

### 1.8 — Construir el dashboard MVP

Archivo: `dashboard/index.html`

Qué debe hacer:
- Leer datos desde la pestaña `dashboard_data` de la Sheet del cliente via Sheets API (con una API key pública de solo lectura, no la Service Account).
- Renderizar las 4 vistas del PDF: General, TOFU, MOFU, BOFU.
- Incluir selector de período (últimos 7 días, 30 días, rango personalizado).
- Incluir una sección de "Interpretación IA" por cada vista: un texto generado por llamada a la API de Claude que describa los KPIs más relevantes del período seleccionado.
- Estar diseñado para embeberse en umohcrew.com.

### 1.9 — Prueba end-to-end con datos reales de prepagas

- Correr el extractor manualmente con los datos reales de la cuenta de prepagas.
- Verificar que los datos en la Sheet coincidan con los reportes de la plataforma.
- Cargar manualmente datos de MOFU y BOFU en las pestañas correspondientes.
- Verificar que el dashboard los renderice correctamente.
- Activar el workflow programado y esperar dos ejecuciones para confirmar que no hay duplicados ni errores.

---

## Fase 2 — Integración Meta Ads + LinkedIn

**Objetivo**: Agregar extracción automática desde Meta y LinkedIn para que el TOFU muestre datos multi-plataforma consolidados.

**Duración estimada**: 1-2 semanas (dependiendo del acceso a credenciales)

### 2.1 — Configurar credenciales Meta

- En Meta Business Manager de UMOH, ir a Configuración → Usuarios del sistema.
- Crear un System User de tipo "Admin".
- Asignarle acceso a las Ad Accounts de los clientes activos.
- Generar un token de acceso permanente con los scopes `ads_read` y `ads_management`.
- Guardar el token como `META_SYSTEM_USER_TOKEN` en GitHub Secrets.

### 2.2 — Escribir el extractor de Meta Ads

Archivo: `extractors/meta_ads.py`

- Usar la librería `facebook-business` (SDK oficial de Meta).
- Autenticarse con el System User token.
- Extraer insights por `ad_account_id` del cliente: impresiones, clicks, CPC, gasto, desglose por placement (Feed, Stories, Reels), desglose por dispositivo.
- Normalizar al mismo schema TOFU canónico.

### 2.3 — Actualizar el normalizador para Meta

- Agregar el mapeo de campos de Meta al schema canónico.
- Meta usa nombres como `reach` (≠ impressions), `inline_link_clicks` (vs `clicks`), `spend` en USD — hay que manejar la conversión de moneda si los clientes operan en ARS.

### 2.4 — LinkedIn (opcional en esta fase)

- LinkedIn Marketing API tiene un proceso de aprobación más restrictivo.
- Si el cliente tiene campañas activas en LinkedIn, iniciar el proceso de acceso a la API en paralelo mientras se trabaja en Meta.
- El extractor de LinkedIn sigue la misma estructura que Google y Meta.

### 2.5 — Actualizar el dashboard para multi-plataforma

- Agregar un filtro de plataforma en el TOFU: "Todas", "Google", "Meta", "LinkedIn".
- Cuando se selecciona "Todas", los datos se suman o promedian según la métrica (impresiones y clicks se suman; CPC se promedia ponderado por clicks).

---

## Fase 3 — Integración MOFU automática (CRM/MeisterTask)

**Objetivo**: Eliminar la carga manual del MOFU conectando directamente a las herramientas de gestión de leads de cada cliente.

**Duración estimada**: Variable por cliente (depende de qué sistema use cada uno)

### 3.1 — Integración MeisterTask (cliente prepagas)

- MeisterTask tiene una API REST documentada.
- Los leads en MeisterTask son "tasks" organizadas por sección (estado del lead).
- El extractor debe leer las tareas del proyecto correspondiente, agruparlas por estado (sección) y calcular los mismos campos del schema MOFU.
- Esto convierte una "tarea programada" de MeisterTask en métricas de MOFU automáticas.

### 3.2 — Protocolo de onboarding de CRM para nuevos clientes

Cuando se incorpora un cliente nuevo, el protocolo debe incluir:
- Relevamiento de qué sistema usa para gestión de leads.
- Verificación de si ese sistema tiene API disponible.
- Si tiene API: construir el extractor correspondiente y agregarlo al config del cliente.
- Si no tiene API: definir el template de carga manual en Google Sheets y capacitar al equipo del cliente para usarlo.
- En ambos casos: definir y documentar los estados válidos de leads (el vocabulario controlado que el pipeline espera).

---

## Fase 4 — Autenticación de clientes + embed en umohcrew.com

**Objetivo**: Que los clientes puedan acceder a su dashboard desde umohcrew.com con login propio.

**Duración estimada**: Coordinación con el equipo de desarrollo de la web (no estimable sin más contexto del stack actual)

### 4.1 — Definir el modelo de autenticación

Opciones:
- Auth0 o similar (gestión de identidad como servicio) — recomendado para simplicidad.
- Login con Google (los clientes probablemente ya tienen cuenta de Google si usan Sheets).
- Magic link por email — sin contraseñas, baja fricción.

### 4.2 — Proteger el acceso a la Sheet por cliente

- Actualmente el dashboard lee de Sheets con una API key pública. En producción esto expone los datos de todos los clientes.
- Alternativa 1: El backend de umohcrew.com actúa como proxy — el cliente se autentica, el servidor sabe a qué Sheet leer, y el dashboard nunca expone el Sheet ID directamente.
- Alternativa 2: Cada cliente tiene su propia URL con un token firmado y de tiempo limitado.

### 4.3 — Embed en umohcrew.com

- El dashboard puede embeberse como iframe en una sección protegida de la web.
- O puede integrarse como componente React si la web está en React/Next.js.
- Coordinar con quien desarrolla la web de UMOH para definir el método de integración.

---

## Fase 5 — Capa de interpretación IA

**Objetivo**: Que el dashboard genere automáticamente textos explicativos de los KPIs más relevantes por vista, usando Claude API.

**Duración estimada**: 1 semana una vez que el dashboard esté funcionando

### 5.1 — Definir qué se interpreta y cómo

Por cada vista (General, TOFU, MOFU, BOFU), el sistema debe generar un párrafo de 2-3 oraciones que explique:
- Cuál es el KPI más destacado del período (positivo o negativo).
- Qué podría estar causándolo (si el contexto lo permite).
- Qué acción sugiere (optimizar puja, revisar creatividades, mejorar tipificación, etc.).

### 5.2 — Llamada a Claude API desde el dashboard

- Al cargar el dashboard, hacer un POST a la API de Claude con los datos del período seleccionado.
- Usar un prompt estructurado que incluya los KPIs del período, los del período anterior (para comparación), y el contexto del cliente (industria, objetivo de campaña).
- Mostrar la respuesta en la sección "Interpretación" de cada vista.
- Cachear la respuesta en la Sheet para no hacer una llamada por cada refresh del dashboard.

---

## Checklist de onboarding para nuevo cliente

Cuando se incorpora un cliente nuevo al sistema, el protocolo es:

- [ ] Crear `config/clients/{client_id}.yaml` con todos los IDs de plataforma
- [ ] Verificar que las cuentas del cliente estén vinculadas al MCC de Google y al Business Manager de Meta
- [ ] Crear la Google Sheet canónica con las pestañas y columnas exactas del schema
- [ ] Compartir la Sheet con el email de la Service Account
- [ ] Definir y documentar los estados válidos de leads con el equipo del cliente
- [ ] Capacitar al equipo del cliente en la carga manual de MOFU/BOFU (si aplica)
- [ ] Correr el extractor manualmente y verificar datos
- [ ] Activar el cliente en el workflow de GitHub Actions
- [ ] Verificar dos ciclos de ejecución automática sin errores
- [ ] Compartir el link del dashboard al cliente

---

## Dependencias críticas y riesgos

**Developer Token de Google Ads**: El proceso de aprobación puede demorar. Solicitarlo primero, antes de tocar nada de código. Sin esto, la Fase 1 no puede completarse.

**Vocabulario controlado de estados de leads**: Si el equipo del cliente no estandariza cómo carga los estados (Contactado, No Prospera, etc.), los gráficos del MOFU van a estar rotos. Este es el riesgo operativo más alto del proyecto, y se resuelve con un documento de onboarding claro, no con código.

**Cambios en las APIs**: Las APIs de Meta y LinkedIn tienen historial de cambios de versión sin aviso suficiente. Hay que suscribirse a los changelogs oficiales y planificar actualizaciones periódicas de los extractores.

**Límites de GitHub Actions (plan gratuito)**: 2.000 minutos/mes en repos privados. Con ejecuciones cada 6 horas y 3 plataformas, el consumo mensual por cliente activo es de aproximadamente 360 minutos. Con 5 clientes activos se supera el límite. El plan Pro cuesta $4/mes y sube a 3.000 minutos, que alcanza para ~8 clientes. Monitorear esto a medida que escale.
