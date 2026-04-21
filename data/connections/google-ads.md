# Google Ads API

## Qué hace

Extrae datos de campañas (impresiones, clicks, gasto, CPC, términos de búsqueda, canal, dispositivo) para el módulo TOFU del dashboard. Corre en GitHub Actions cada 6 horas.

## Archivo relevante

`extractors/google_ads.py`

## Credenciales necesarias

| Secret GitHub | Descripción |
|--------------|-------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Solicitado desde MCC → Herramientas → API Center |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ID de la cuenta MCC de UMOH (sin guiones) |
| `GOOGLE_ADS_CLIENT_ID` | OAuth2 Client ID desde Google Cloud Console |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 Client Secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | Generado una vez con el script de autenticación |

## Flujo de autenticación

1. Crear proyecto en Google Cloud Console
2. Habilitar Google Ads API
3. Crear credencial OAuth2 tipo "Desktop app" — descargar `client_secret.json`
4. Correr el script de auth una vez: genera el `refresh_token` (proceso manual, una sola vez)
5. Guardar todos los valores como GitHub Secrets

El `refresh_token` no expira mientras la aplicación esté activa. No necesita renovarse.

## Rango de fechas extraído

Siempre últimos 7 días. El loader hace dedup por `date + platform` antes de escribir en Sheets — si una fila ya existe la actualiza, si no existe la inserta.

## Datos que extrae

```
date, platform, impressions, clicks, spend, cpc (calculado),
top_search_terms, channel_breakdown, device_breakdown
```

## Nota sobre aprobación

El Developer Token requiere aprobación manual de Google. Puede tardar hasta 5 días hábiles. Solicitar antes de empezar la Fase 2.
