# MeisterTask API

## Estado

Pendiente — Fase 5.

## Qué hará

Extraerá el estado de los leads desde MeisterTask para alimentar el módulo MOFU automáticamente, reemplazando la carga manual actual en Google Sheets.

## Archivo relevante

`extractors/meistertask.py` (esqueleto creado)

## Mapeo de estados

Los estados de las tarjetas en MeisterTask se mapean a los estados del schema MOFU:

| Estado en MeisterTask | Campo en schema |
|----------------------|-----------------|
| Contactado | `leads_contactado` |
| No Prospera | `leads_no_prospera` |
| A Futuro | `leads_a_futuro` |
| En Emisión | `leads_en_emision` |
| Erróneo | `leads_erroneo` |

Los leads "En Emisión" se cuentan como `leads_alta_intencion`.

## Config por cliente

En `config/clients/{slug}.yaml`:
```yaml
reporting:
  lead_statuses: [Contactado, No Prospera, A Futuro, En Emisión, Erróneo]
```

El `meistertask_project_id` se configura en `clients/{slug}.json`.
