# Alta de nuevo cliente

## Resumen del proceso

1. Crear archivos de configuración del cliente
2. Crear Google Sheet canónica
3. Configurar GitHub Secrets (si es nueva cuenta publicitaria)
4. Crear subdominio en Hostinger
5. Subir los archivos del dashboard al subdominio
6. Verificar el pipeline

---

## Paso 1 — Archivos de configuración

**`clients/{slug}.json`** — usado por PHP para saber qué Sheet leer:
```json
{
  "slug": "nuevo-cliente",
  "name": "Nombre del Cliente",
  "google_customer_id": "123-456-7890",
  "meta_account_id": "act_123456789",
  "mofu_source": "manual",
  "meistertask_project_id": "",
  "currency": "ARS",
  "timezone": "America/Argentina/Buenos_Aires",
  "sheets": {
    "output_id": "ID_DE_LA_GOOGLE_SHEET"
  }
}
```

**`config/clients/{slug}.yaml`** — usado por el pipeline Python:
```yaml
client_id: nuevo-cliente
active: true
platforms:
  google_ads:
    enabled: true
    customer_id: "123-456-7890"
  meta:
    enabled: false
    ad_account_id: ""
sheets:
  output_id: "ID_DE_LA_GOOGLE_SHEET"
reporting:
  timezone: "America/Argentina/Buenos_Aires"
  currency: "ARS"
  lead_statuses: [Contactado, No Prospera, A Futuro, En Emisión, Erróneo]
  segments: [Voluntario, Monotributista, Obligatorio]
```

---

## Paso 2 — Google Sheet canónica

1. Crear una Google Sheet nueva
2. Compartirla con el email de la Service Account
3. El loader crea automáticamente las pestañas `tofu_raw`, `mofu_input`, `bofu_input`
4. Copiar el Sheet ID en ambos archivos de configuración

---

## Paso 3 — Subdominio en Hostinger

1. Panel de Hostinger → Dominios → Subdominios
2. Crear `{slug}.umohcrew.com` apuntando a `public_html/{slug}/`
3. Subir los archivos del dashboard a esa carpeta por FTP

---

## Paso 4 — Credenciales de acceso

Crear el archivo `dashboard/config/credentials.php` en el servidor (nunca en el repo):
```php
<?php
define('UMOH_USERS', [
    'cliente_usuario' => [
        'password_hash' => password_hash('contraseña_segura', PASSWORD_DEFAULT),
        'role'    => 'client',
        'name'    => 'Nombre Contacto',
        'clients' => ['nuevo-cliente'],
    ],
]);
```

---

## Paso 5 — Verificar

1. Forzar ejecución del pipeline en GitHub Actions
2. Verificar que la Sheet se pobló con datos
3. Ingresar al subdominio y confirmar que el dashboard muestra datos reales
