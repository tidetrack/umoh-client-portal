# Manual de Alta de Clientes — UMOH Client Portal

Protocolo paso a paso para incorporar un cliente nuevo al sistema de dashboards.
Seguir este orden exacto. Cada paso tiene una dependencia con el anterior.

---

## Prerequisitos

Antes de empezar, tener a mano:
- El **customer_id de Google Ads** del cliente (formato `123-456-7890`)
- El **ad_account_id de Meta** del cliente (formato `act_123456789`), si aplica
- El **slug** del cliente: identificador corto, sin espacios, sin tildes (ej: `prepagas`, `grupo-norte`, `clinica-sol`)
- Confirmación de que la cuenta de Google Ads del cliente está **vinculada al MCC de UMOH** (`865-936-8705`)
- Confirmación de que la cuenta de Meta del cliente está vinculada al **Business Manager de UMOH**

---

## Paso 1 — Crear la Google Sheet canónica

La Sheet es el almacén central de datos. El pipeline escribe ahí, el dashboard lee de ahí.

1. Crear una Google Sheet nueva desde la cuenta `umohcrew@gmail.com`
2. Copiar el **Sheet ID** de la URL: `docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
3. Actualizar el Sheet ID en el script `scripts/setup_prepagas_sheet.py`:
   - Cambiar `SHEET_ID` al ID de la nueva Sheet
   - Cambiar `SHARE_WITH_EMAIL` al email del responsable del cliente (opcional)
4. Correr el script:
   ```bash
   python3 scripts/setup_prepagas_sheet.py
   ```
   Esto crea automáticamente las 4 pestañas con sus headers:
   - `tofu_raw` — datos diarios de Google Ads (escritura automática del pipeline)
   - `mofu_input` — carga manual de leads por el equipo del cliente
   - `bofu_input` — carga manual de ventas por el equipo del cliente
   - `dashboard_data` — reservada para agregaciones futuras

---

## Paso 2 — Crear el archivo de configuración del cliente

Crear `config/clients/{slug}.yaml` con este template:

```yaml
client_id: {slug}
client_name: "{Nombre completo del cliente}"
dashboard_slug: {slug}
active: true

platforms:
  google_ads:
    enabled: true
    customer_id: "{customer_id}"        # Formato: "123-456-7890"
  meta:
    enabled: false                       # Activar cuando se integre Meta
    ad_account_id: "{ad_account_id}"    # Formato: "act_123456789"
  linkedin:
    enabled: false

sheets:
  bofu_input_id: "{SHEET_ID}"
  output_id: "{SHEET_ID}"

reporting:
  timezone: "America/Argentina/Mendoza"
  currency: "ARS"
  segments:
    - Voluntario
    - Monotributista
    - Obligatorio
  lead_statuses:
    - Contactado
    - No Prospera
    - A Futuro
    - En Emision
    - Erroneo
    - En Blanco
```

Commitear y pushear:
```bash
git add config/clients/{slug}.yaml
git commit -m "config: alta cliente {slug}"
git push origin main
```

---

## Paso 3 — Crear el subdominio en Hostinger

El dashboard de cada cliente vive en `{slug}.umohcrew.com`.

1. Entrar a [hPanel → umohcrew.com → Domains → Subdomains](https://hpanel.hostinger.com/websites/umohcrew.com/domains/subdomains)
2. En el formulario "Create a New Subdomain":
   - **Subdomain**: `{slug}` (ej: `prepagas`)
   - **Domain**: `umohcrew.com`
   - **Custom folder**: activar y escribir `public_html/{slug}` (ej: `public_html/prepagas`)
3. Click **Create**
4. Esperar ~1 minuto para que propague

El subdominio queda en: `https://{slug}.umohcrew.com`

---

## Paso 4 — Desplegar el dashboard

Los archivos del dashboard viven en `dashboard/` dentro del repo.

**Opción A — File Manager de Hostinger (recomendado para primer deploy):**
1. Entrar a hPanel → Files → File Manager
2. Navegar a `public_html/{slug}/`
3. Subir todos los archivos de la carpeta `dashboard/` del repo:
   - `index.html`
   - `assets/css/umoh.css`
   - `assets/js/mockdata.js`
   - `assets/js/api.js`
   - `assets/js/charts.js`
   - `assets/js/filters.js`

**Opción B — FTP (para deploys frecuentes):**
1. Obtener credenciales FTP en hPanel → Files → FTP Accounts
2. Conectar con FileZilla o similar
3. Subir archivos a `/public_html/{slug}/`

**Configurar el cliente en el dashboard:**
En `dashboard/assets/js/api.js`, verificar que `USE_MOCK = true` para testeo inicial.

---

## Paso 5 — Testear el dashboard

1. Abrir `https://{slug}.umohcrew.com` en el browser
2. Verificar que carga sin errores de consola
3. Verificar que los gráficos renderizan con datos mock
4. Verificar que el selector de período funciona (7d, 30d, 90d)
5. Verificar que las 4 vistas navegan correctamente (General, TOFU, MOFU, BOFU)

---

## Paso 6 — Activar el pipeline real

Una vez que el Developer Token de Google Ads tiene **acceso básico aprobado**:

1. Verificar que el `customer_id` del cliente está vinculado al MCC en [Google Ads → Cuentas](https://ads.google.com/aw/accounts)
2. Hacer un run manual desde GitHub Actions:
   - Ir a [Actions → Extract & Load](https://github.com/tidetrack/umoh-client-portal/actions/workflows/extract_all.yml)
   - Click **Run workflow**
   - Opcionalmente filtrar por `client_filter = {slug}`
3. Verificar que el workflow completa sin errores
4. Abrir la Sheet del cliente y confirmar que `tofu_raw` tiene datos
5. Actualizar `USE_MOCK = false` en `api.js`, redesplegar el dashboard
6. Verificar en `https://{slug}.umohcrew.com` que aparecen datos reales

---

## Paso 7 — Onboarding del equipo del cliente

1. Compartirles el link a la Google Sheet
2. Explicar que deben cargar datos en `mofu_input` y `bofu_input` semanalmente
3. Entregarles el diccionario de estados válidos para leads:
   - `Contactado` — recibió llamada o email
   - `No Prospera` — descartado
   - `A Futuro` — interesado sin fecha definida
   - `En Emision` — en proceso de emisión
   - `Erroneo` — dato incorrecto o duplicado
   - `Alta Intencion` — alta probabilidad de cierre
4. Aclarar que **no pueden modificar los nombres de columnas** — rompe el pipeline

---

## Checklist de alta completa

```
[ ] Sheet canónica creada con 4 pestañas y headers correctos
[ ] Sheet compartida con umoh-sheets-writer@eco-league-466000-d2.iam.gserviceaccount.com
[ ] config/clients/{slug}.yaml creado con IDs reales y pusheado
[ ] Cuenta de Google Ads vinculada al MCC 865-936-8705
[ ] Subdominio {slug}.umohcrew.com creado en Hostinger → public_html/{slug}/
[ ] Archivos del dashboard deployados
[ ] Dashboard accesible en https://{slug}.umohcrew.com (con mock data)
[ ] Pipeline corrido manualmente y Sheet con datos reales
[ ] USE_MOCK=false en api.js, dashboard redesplegado con datos reales
[ ] Equipo del cliente capacitado en carga de MOFU/BOFU
```

---

## Tiempos estimados

| Tarea | Tiempo |
|-------|--------|
| Crear Sheet + correr script | 5 min |
| Crear YAML + push | 5 min |
| Crear subdominio en Hostinger | 2 min |
| Desplegar dashboard | 10 min |
| Testeo frontend | 10 min |
| Primer run del pipeline | 5 min |
| Onboarding cliente | 30 min |
| **Total** | **~1 hora** |
