# Manual de Alta de Clientes — UMOH Dashboards

Este documento describe el proceso completo para incorporar un nuevo cliente al sistema de dashboards de UMOH. Está escrito para que cualquier persona del equipo pueda ejecutarlo sin conocimientos técnicos profundos, siguiendo los pasos en orden.

**Tiempo estimado total**: 2 a 4 horas (dependiendo de si el cliente ya tiene las cuentas publicitarias vinculadas al MCC de UMOH).

---

## Antes de empezar: qué necesitás tener

Antes de iniciar el proceso, confirmá que tenés acceso a lo siguiente:

- Acceso al **MCC de Google Ads de UMOH** (la cuenta paraguas que administra todas las cuentas de clientes).
- Acceso al **Business Manager de Meta de UMOH** (ídem, pero para Meta/Instagram).
- Acceso al repositorio de GitHub del proyecto (para agregar el archivo de configuración del cliente).
- La **Google Sheet canónica del cliente** creada (ver Paso 3).
- El **JSON de credenciales** de la Service Account de Google (ya está en GitHub Secrets — no hace falta tocarlo si el repo ya está configurado).

Si alguno de estos puntos no está disponible, detené el proceso y resolvelo primero. Agregar un cliente a medias genera datos corruptos o pipelines que fallan silenciosamente.

---

## Paso 1 — Relevamiento del cliente

Reunite con el cliente o con el responsable interno de UMOH y recopilá la siguiente información. Sin estos datos, el resto del proceso no puede completarse.

**Datos básicos:**
- Nombre completo del cliente (ej: "Prevención Salud Mendoza")
- Rubro / industria (ej: "Prepagas / Salud")
- Timezone donde opera el negocio (ej: "America/Argentina/Mendoza")
- Moneda en que se reportan las ventas (por defecto: ARS)

**Cuentas publicitarias:**
- ID de cuenta en Google Ads (se ve en la esquina superior derecha cuando entrás a la cuenta del cliente desde el MCC. Formato: 123-456-7890)
- ID de cuenta en Meta Ads (se ve en el Business Manager → Cuentas publicitarias. Formato: act_123456789)
- Si tiene LinkedIn activo: ID de cuenta de LinkedIn Ads

**Sistema de gestión de leads (CRM o herramienta equivalente):**
- ¿Qué herramienta usa el equipo de ventas para gestionar leads? (MeisterTask, HubSpot, planilla, otro)
- ¿Esa herramienta tiene API? (preguntale al equipo técnico del cliente si no lo sabés)
- Si no tiene API o es manual: el cliente va a cargar los datos en Google Sheets (ver Paso 4)

**Vocabulario de estados de leads:**
Este punto es crítico. El sistema solo acepta estados escritos exactamente como se definen acá. Pedile al equipo de ventas del cliente que liste cómo van a llamar a cada etapa de un lead. Ejemplos típicos:
- Contactado
- No Prospera
- A Futuro
- En Emisión
- Erróneo
- En Blanco

Una vez acordados, estos estados no pueden cambiarse sin actualizar el sistema. Documentalos en el YAML del cliente (ver Paso 2).

**Segmentos de audiencia:**
Si el cliente tiene distintos tipos de clientes/productos, definí los segmentos. Ejemplos del caso prepagas: Voluntario, Monotributista, Obligatorio. Estos segmentos aparecen en los gráficos de distribución del MOFU y BOFU.

---

## Paso 2 — Crear el archivo de configuración del cliente

Con los datos del Paso 1, creá el archivo YAML del cliente en el repositorio.

**Ubicación del archivo**: `config/clients/{client_id}.yaml`

El `client_id` es un identificador corto, en minúsculas, sin espacios ni caracteres especiales. Ejemplos: `prepagas`, `clinica-del-sol`, `farmacia-central`.

**Contenido del archivo** (completar con los datos reales del cliente):

```yaml
client_id: {client_id}
client_name: "{Nombre completo del cliente}"
dashboard_slug: {client_id}
active: false   # IMPORTANTE: dejar en false hasta completar todos los pasos

platforms:
  google_ads:
    enabled: true
    customer_id: "{ID de Google Ads}"
  meta:
    enabled: true
    ad_account_id: "{ID de Meta Ads}"
  linkedin:
    enabled: false   # cambiar a true si el cliente tiene LinkedIn activo

sheets:
  bofu_input_id: "{ID de la Google Sheet del cliente — completar en Paso 3}"
  output_id: "{ID de la Google Sheet del cliente — completar en Paso 3}"

reporting:
  timezone: "America/Argentina/Mendoza"
  currency: "ARS"
  segments:
    - {Segmento 1}
    - {Segmento 2}
    - {Segmento 3}
  lead_statuses:
    - {Estado 1}
    - {Estado 2}
    - {Estado 3}
    - {Estado 4}
    - {Estado 5}
```

**Cómo agregar el archivo al repositorio:**
1. Abrí el repositorio en GitHub o en tu editor local.
2. Navegá a `config/clients/`.
3. Creá un nuevo archivo con el nombre `{client_id}.yaml`.
4. Pegá el contenido de arriba con los datos reales del cliente.
5. Guardá y commiteá el archivo con el mensaje: `feat: alta cliente {client_name}`.

---

## Paso 3 — Crear la Google Sheet canónica del cliente

Cada cliente tiene su propia Google Sheet donde se almacenan los datos del pipeline y donde el equipo de ventas carga los datos de MOFU y BOFU.

**Cómo crearla:**
1. Creá una Google Sheet nueva desde tu cuenta de Google vinculada a UMOH.
2. Nombrala: `UMOH Dashboards — {Nombre del cliente}`.
3. Creá las siguientes pestañas con estos nombres exactos (sin variaciones de mayúsculas o espacios):

| Pestaña | Para qué sirve | Quién escribe |
|---------|---------------|---------------|
| `tofu_raw` | Datos diarios de publicidad (Google, Meta, LinkedIn) | El pipeline automático |
| `mofu_input` | Datos de leads: estados, segmentos, tipificación | El equipo de ventas del cliente (carga manual) |
| `bofu_input` | Datos de ventas: ingresos, tickets, cápitas | El equipo de ventas del cliente (carga manual) |
| `dashboard_data` | Datos consolidados que lee el dashboard | El pipeline automático |

4. En la pestaña `mofu_input`, creá las siguientes columnas en la fila 1 (exactamente con estos nombres):

```
fecha | total_leads | leads_contactado | leads_no_prospera | leads_a_futuro | leads_en_emision | leads_erroneo | leads_alta_intencion | segment_voluntary | segment_monotributista | segment_obligatorio
```

5. En la pestaña `bofu_input`, creá las siguientes columnas en la fila 1:

```
fecha | total_revenue | closed_sales | capitas_closed | sales_voluntary | sales_monotributista | sales_obligatorio
```

6. Compartí la Sheet con el email de la Service Account de UMOH (pedíselo al responsable técnico — es un email que termina en `@...iam.gserviceaccount.com`) con permisos de **Editor**.

7. Copiá el ID de la Sheet (está en la URL: `docs.google.com/spreadsheets/d/{ESTE_ES_EL_ID}/edit`) y pegalo en el YAML del cliente en los campos `bofu_input_id` y `output_id`.

---

## Paso 4 — Capacitar al equipo de ventas del cliente

El equipo de ventas del cliente necesita saber cómo cargar datos en las pestañas `mofu_input` y `bofu_input`. Esto es crítico: si cargan los datos mal, el dashboard muestra información incorrecta o directamente no muestra nada.

**Qué comunicarles:**

Mandales un documento o una reunión breve explicando:

- La pestaña `mofu_input` se actualiza semanalmente (o con la frecuencia que se acuerde). Cada fila es un período de fechas.
- El campo `fecha` siempre va en formato `AAAA-MM-DD` (ej: `2026-04-20`). No usar barras, no usar formato argentino.
- Los estados de leads (`leads_contactado`, `leads_no_prospera`, etc.) son cantidades numéricas, no textos. Si ese día tuvieron 12 leads contactados, ponen `12` en esa columna.
- Los campos de segmento (`segment_voluntary`, etc.) son porcentajes expresados como números decimales. Si el 44.7% fueron voluntarios, ponen `44.7` (no `44,7` ni `44.7%`).
- Si una celda no tiene dato, dejarla en blanco. No poner cero, no poner guión.
- **Los estados deben escribirse exactamente como están definidos en el acuerdo del Paso 1.** Si acordaron "No Prospera", no puede aparecer "no prospera" ni "NO PROSPERA". El sistema es sensible a mayúsculas.

**Validación de datos en la Sheet:**
Configurá validación de datos en las columnas de texto de `mofu_input` para que solo acepten los valores acordados. En Google Sheets: seleccioná la columna → Datos → Validación de datos → Lista de elementos → pegá los estados válidos separados por coma.

---

## Paso 5 — Verificación técnica antes de activar

Antes de cambiar `active: false` a `active: true` en el YAML, ejecutá el pipeline manualmente para este cliente y verificá que todo funciona.

**Cómo ejecutar el pipeline manualmente:**
En el repositorio de GitHub, andá a Actions → `extract_all.yml` → Run workflow. Si el workflow no tiene opción de ejecución manual, pedíselo al responsable técnico o ejecutá el script Python localmente con el YAML del nuevo cliente.

**Qué verificar después de correr el pipeline:**
- Que la pestaña `tofu_raw` de la Sheet del cliente tenga datos del día de hoy con las columnas correctas.
- Que los datos coincidan (aproximadamente) con lo que se ve en la plataforma de ads del cliente. No tienen que ser idénticos al centavo, pero deben estar en el mismo orden de magnitud.
- Que no haya filas duplicadas (misma fecha + plataforma dos veces).
- Que la pestaña `dashboard_data` tenga datos consolidados.

Si algo falla, no activés el cliente. Documentá el error y pasalo al responsable técnico antes de continuar.

---

## Paso 6 — Activación y verificación post-activación

Si el Paso 5 fue exitoso:

1. Abrí el YAML del cliente y cambiá `active: false` por `active: true`.
2. Commiteá el cambio con el mensaje: `feat: activar cliente {client_id} en pipeline`.
3. Esperá que corran dos ciclos automáticos del pipeline (cada 6 horas). Verificá que ambos corrieron sin errores en el tab de Actions de GitHub.
4. Abrí el dashboard del cliente y verificá que los datos se ven correctamente en las 4 vistas.
5. Enviá el link del dashboard al cliente y pedile que confirme que la información tiene sentido.

---

## Checklist de alta (para marcar a medida que avanzás)

```
RELEVAMIENTO
[ ] Nombre del cliente confirmado
[ ] ID de Google Ads obtenido
[ ] ID de Meta Ads obtenido
[ ] LinkedIn: activo o no (documentado)
[ ] Herramienta de CRM identificada
[ ] Vocabulario de estados de leads acordado y documentado
[ ] Segmentos de audiencia definidos

CONFIGURACIÓN TÉCNICA
[ ] Archivo YAML creado en config/clients/{client_id}.yaml
[ ] Google Sheet creada con las 4 pestañas
[ ] Columnas de mofu_input configuradas correctamente
[ ] Columnas de bofu_input configuradas correctamente
[ ] Sheet compartida con la Service Account
[ ] ID de Sheet copiado en el YAML

CAPACITACIÓN
[ ] Equipo de ventas del cliente capacitado en carga de datos
[ ] Validación de datos configurada en la Sheet
[ ] Documento de instrucciones enviado al cliente

VERIFICACIÓN
[ ] Pipeline ejecutado manualmente sin errores
[ ] Datos en tofu_raw coinciden con las plataformas
[ ] Sin duplicados en tofu_raw
[ ] dashboard_data consolidado correctamente
[ ] active: true en el YAML
[ ] Dos ciclos automáticos corridos sin errores
[ ] Dashboard verificado por el equipo de UMOH
[ ] Dashboard enviado y confirmado por el cliente
```

---

## Preguntas frecuentes

**¿Qué pasa si el cliente tiene una cuenta de Google Ads que no está vinculada al MCC de UMOH?**
El pipeline no puede acceder a ella. Hay que pedirle al cliente que invite a la cuenta MCC de UMOH como administrador antes de continuar con el Paso 2.

**¿Y si el cliente usa un CRM que no es MeisterTask ni una planilla?**
Por ahora, el proceso estándar es carga manual en la Sheet. En el futuro, cada CRM con API puede tener su propio extractor. Documentá qué CRM usa el cliente en el YAML bajo el campo `crm.type` para que quede registrado para cuando se implemente esa integración.

**¿Se puede agregar un cliente nuevo sin Google Ads?**
Sí. En el YAML, poné `google_ads.enabled: false` y `meta.enabled: true` (o viceversa). El pipeline extrae solo las plataformas habilitadas.

**¿Qué pasa si el cliente cambia los estados de leads a mitad del proceso?**
Hay que actualizar el YAML (`lead_statuses`), re-capacitar al equipo, y limpiar las filas de `mofu_input` que tengan estados viejos. No es un cambio menor — implica una reunión de realineamiento y puede requerir corrección de datos históricos.
