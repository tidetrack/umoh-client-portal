# Pipeline de datos — end to end

## Cuándo corre

GitHub Actions ejecuta el pipeline cada 6 horas: `0 */6 * * *`.
También puede ejecutarse manualmente desde GitHub → Actions → "Run workflow".

## Flujo completo

```
1. EXTRACCIÓN
   extractors/google_ads.py    → últimos 7 días de Google Ads API
   extractors/meta_ads.py      → últimos 7 días de Meta (Fase 3)
   extractors/meistertask.py   → estado actual de leads (Fase 5)

2. NORMALIZACIÓN
   normalizers/canonical.py   → transforma datos crudos al schema TOFU/MOFU/BOFU

3. CARGA
   loaders/sheets_writer.py   → upsert en Google Sheets (crea pestañas si no existen)

4. LECTURA (on-demand desde el browser)
   api/lib/sheets.php         → PHP lee la Sheet cuando el dashboard hace una request
   api/endpoints/*.php        → filtra por período y retorna JSON
```

## Dedup / Upsert

El loader no hace append simple. Antes de escribir una fila verifica si ya existe una entrada con la misma `date + platform`. Si existe, la actualiza. Si no, la inserta.

Esto significa que:
- El pipeline puede fallar y reejecutarse sin duplicar datos
- Los datos de Google Ads (que tienen lag de ~3h) se corrigen automáticamente en la siguiente ejecución
- No hay riesgo de inflación de métricas por múltiples runs

## Frecuencia y lag de datos

| Plataforma | Lag típico | Frecuencia pipeline |
|-----------|-----------|---------------------|
| Google Ads | ~3 horas | 6 horas |
| Meta Ads | hasta 24h | 6 horas |
| MeisterTask | tiempo real | 6 horas |

Ejecutar más frecuentemente no agrega valor dado el lag de las plataformas.

## Rango extraído

Siempre los últimos 7 días. Esto cubre:
- El lag de plataformas (datos que llegaron tarde)
- Gaps por fallos del pipeline
- Retroactive updates de conversiones (Meta puede actualizar hasta 28 días atrás, pero 7 días cubre el 99% de los casos)

## Logs

Los logs de cada ejecución están en GitHub → Actions → nombre del run. En caso de fallo, revisar el paso que falló y los logs de error.
