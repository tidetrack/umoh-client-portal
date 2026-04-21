# Referencia de endpoints PHP

Todos los endpoints aceptan `GET`, retornan `Content-Type: application/json` y están en `api/endpoints/`.

---

## Parámetros comunes

| Parámetro | Tipo | Valores | Default |
|-----------|------|---------|---------|
| `period` | string | `7d`, `30d`, `90d`, `custom` | `30d` |
| `start` | string | `YYYY-MM-DD` | — (requerido si `period=custom`) |
| `end` | string | `YYYY-MM-DD` | — (requerido si `period=custom`) |

---

## GET /api/endpoints/summary.php

Métricas consolidadas del período para el widget de Performance.

**Respuesta:**
```json
{
  "period": "30d",
  "spend": 80000,
  "revenue": 250000,
  "roi": 212.5,
  "impressions": 15000,
  "leads": 80,
  "sales": 8,
  "trend": [
    { "label": "01 Ene", "spend": 2600, "revenue": 8300 }
  ]
}
```

---

## GET /api/endpoints/tofu.php

Datos de awareness — Google Ads (y Meta en Fase 3).

**Respuesta:**
```json
{
  "period": "30d",
  "impressions": 15000,
  "clicks": 750,
  "spend": 80000,
  "cpc": 106.67,
  "top_search_terms": [
    { "term": "seguro de salud", "clicks": 120 }
  ],
  "channel_breakdown": { "search": 65, "display": 35 },
  "device_breakdown": { "mobile": 58, "desktop": 42 },
  "trend": [
    { "label": "01 Ene", "impressions": 500, "clicks": 25 }
  ]
}
```

---

## GET /api/endpoints/mofu.php

Datos de leads — carga manual en Sheets (MeisterTask en Fase 5).

**Respuesta:**
```json
{
  "period": "30d",
  "total_leads": 80,
  "cost_per_lead": 1000,
  "typification_rate": 90,
  "leads_contactado": 45,
  "leads_no_prospera": 12,
  "leads_a_futuro": 8,
  "leads_en_emision": 15,
  "leads_erroneo": 0,
  "leads_alta_intencion": 15,
  "segment_voluntary": 40,
  "segment_monotributista": 25,
  "segment_obligatorio": 15,
  "trend": [
    { "label": "01 Ene", "leads": 3, "cpl": 950 }
  ]
}
```

---

## GET /api/endpoints/bofu.php

Datos de ventas cerradas — carga manual en Sheets.

**Respuesta:**
```json
{
  "period": "30d",
  "total_revenue": 250000,
  "closed_sales": 8,
  "avg_ticket": 31250,
  "conversion_rate": 10,
  "capitas_closed": 24,
  "avg_ticket_capita": 10416,
  "sales_voluntary": 4,
  "sales_monotributista": 2,
  "sales_obligatorio": 2,
  "trend": [
    { "label": "01 Ene", "revenue": 8300, "sales": 1 }
  ]
}
```

---

## Manejo de errores

```json
{ "error": "Período inválido" }          // HTTP 400
{ "error": "Sheet no encontrada" }       // HTTP 500
```

La autenticación es manejada por `auth_check.php` antes de que llegue a los endpoints.
