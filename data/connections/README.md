# Conexiones — UMOH Client Portal

Documentación de todas las integraciones externas del sistema.

---

## Mapa de conexiones

```
Dashboard (PHP)
    └── Google Sheets API ←── Pipeline Python
                                    ├── Google Ads API
                                    ├── Meta Marketing API (Fase 3)
                                    └── MeisterTask API (Fase 5)

Auth (PHP)
    └── MySQL — Hostinger (Fase 4)
```

---

## Estado de integraciones

| Servicio | Tipo | Estado | Docs |
|---------|------|--------|------|
| Google Ads API | Extracción de datos TOFU | Activo | [google-ads.md](./google-ads.md) |
| Google Sheets API | Almacenamiento intermedio | Activo | [google-sheets.md](./google-sheets.md) |
| Meta Marketing API | Extracción de datos TOFU | Pendiente (Fase 3) | [meta-ads.md](./meta-ads.md) |
| MeisterTask API | Extracción de leads MOFU | Pendiente (Fase 5) | [meistertask.md](./meistertask.md) |
| MySQL Hostinger | Auth de usuarios | Pendiente (Fase 4) | — |

---

## Credenciales

Todas las credenciales viven en dos lugares:

1. **GitHub Secrets** — para el pipeline Python en GitHub Actions
2. **`.env` en el servidor** — para los endpoints PHP en Hostinger

Nunca en el repositorio. Ver `.gitignore`.

| Secret | Dónde se usa | Descripción |
|--------|-------------|-------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | GitHub + .env | Token de la cuenta MCC |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | GitHub + .env | ID del MCC paraguas |
| `GOOGLE_ADS_CLIENT_ID` | GitHub + .env | OAuth2 Client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | GitHub + .env | OAuth2 Client Secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | GitHub + .env | Refresh token OAuth |
| `META_SYSTEM_USER_TOKEN` | GitHub + .env | Token System User Meta |
| `GOOGLE_SHEETS_SA_JSON` | GitHub + .env | JSON Service Account |
