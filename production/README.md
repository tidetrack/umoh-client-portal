# Producción — UMOH Client Portal

Guía completa para deploy, configuración y mantenimiento del ambiente de producción.

---

## Ambientes

| Ambiente | URL | Hosting | Estado |
|----------|-----|---------|--------|
| Producción (prepagas) | `prepagas.umohcrew.com` | Hostinger FTP `147.93.37.161` | Activo |
| Local (mock) | `localhost` o Live Server | — | `USE_MOCK=true` |

---

## Deploy manual (FTP)

### Prerequisitos
- Credenciales FTP: usuario `u475803516.umohdasboards`, contraseña en `.env` local
- `USE_MOCK = false` en `dashboard/assets/js/api.js`
- `PHASE1_BYPASS = false` en `dashboard/auth_check.php` (cuando Fase 4 esté activa)

### Subir archivos modificados

```bash
# Un archivo
curl -T dashboard/login.php \
  ftp://147.93.37.161/prepagas/login.php \
  --user "u475803516.umohdasboards:PASSWORD"

# Crear directorios automáticamente
curl --ftp-create-dirs \
  -T dashboard/assets/img/nuevo.png \
  ftp://147.93.37.161/prepagas/assets/img/nuevo.png \
  --user "u475803516.umohdasboards:PASSWORD"
```

HTTP 226 = subida exitosa.

### Archivos que NO van al FTP
- `.env` — configurar directamente en Hostinger panel
- `credentials.php` — configurar directamente en Hostinger panel
- Archivos de Python (`extractors/`, `normalizers/`, `loaders/`) — corren en GitHub Actions, no en el servidor

### Estructura en el servidor

```
public_html/prepagas/
├── index.html
├── login.php
├── auth_check.php
├── logout.php
├── assets/
│   ├── css/umoh.css
│   ├── js/
│   │   ├── api.js          ← versión con USE_MOCK=false
│   │   ├── charts.js
│   │   ├── filters.js
│   │   └── mockdata.js
│   └── img/
├── api/
│   ├── config/
│   │   ├── database.php
│   │   ├── env.php
│   │   └── .htaccess
│   ├── lib/
│   │   ├── config.php
│   │   └── sheets.php
│   └── endpoints/
│       ├── summary.php
│       ├── tofu.php
│       ├── mofu.php
│       └── bofu.php
└── config/
    └── credentials.php     ← NO en repo, configurar manualmente
```

---

## Variables de entorno

Archivo `.env` en la raíz del proyecto en el servidor. Nunca commitear.

```env
# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=

# Meta
META_SYSTEM_USER_TOKEN=

# Google Sheets (Service Account JSON en base64 o path)
GOOGLE_SHEETS_SA_JSON=

# MySQL
DB_HOST=localhost
DB_NAME=
DB_USER=
DB_PASS=
```

---

## GitHub Actions (pipeline Python)

El pipeline corre automáticamente cada 6 horas. Ver `.github/workflows/extract_all.yml`.

Para forzar una ejecución manual:
1. Ir a GitHub → Actions → `Extract All Data`
2. Click en "Run workflow"

Los secrets de GitHub deben estar configurados. Ver [`connections/`](../connections/README.md).

---

## Checklist de deploy

Antes de hacer push y subir a producción:

- [ ] `USE_MOCK = false` en `api.js`
- [ ] `PHASE1_BYPASS = false` en `auth_check.php` (cuando Fase 4 esté activa)
- [ ] Sin `console.log` de debug en JS
- [ ] Sin credenciales en código fuente
- [ ] `CHANGELOG.md` actualizado
- [ ] Commit creado con mensaje descriptivo
- [ ] Push a `main`
- [ ] Archivos subidos por FTP y verificados (HTTP 226)
- [ ] Verificar en browser que el dashboard carga correctamente
