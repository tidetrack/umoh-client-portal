# Meta Marketing API

## Estado

Pendiente — Fase 3.

## Qué hará

Extraerá datos de campañas de Meta (Facebook + Instagram Ads) para complementar el módulo TOFU con datos de redes sociales.

## Archivo relevante

`extractors/meta_ads.py` (esqueleto creado)

## Credencial necesaria

| Secret | Descripción |
|--------|-------------|
| `META_SYSTEM_USER_TOKEN` | Token permanente del System User en Business Manager |

## Cómo obtener el token

1. En Meta Business Manager → Configuración → Usuarios del sistema
2. Crear un System User con rol Administrador
3. Asignar la cuenta publicitaria del cliente al System User
4. Generar un token permanente con permisos `ads_read`, `ads_management`

El token de System User no expira (a diferencia de los tokens de usuario normal).

## Datos que extraerá

```
date, platform, impressions, clicks, spend, cpc (calculado),
reach, frequency, placements_breakdown
```
