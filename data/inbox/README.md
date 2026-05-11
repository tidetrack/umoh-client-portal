# Inbox de ingesta manual

Carpeta donde Franco deja archivos para que Claude los procese en la próxima sesión.

## Cómo usar

1. **Dejá el CSV** en la subcarpeta correspondiente (ver tabla abajo).
2. Respetá la **convención de nombre** del archivo.
3. En la próxima sesión, escribí a Claude: **"procesá inbox"** (o el nombre específico del archivo).
4. Claude valida → ejecuta el pipeline → mueve el archivo a `data/inbox/processed/{YYYY-MM-DD}/` con un log.

## Tipos de ingesta soportados

| Tipo | Carpeta | Convención de nombre | Pipeline que dispara |
|---|---|---|---|
| Search terms (Awareness/TOFU) | `data/inbox/search-terms/` | `{slug}-search-terms-{YYYYMMDD}.csv` | `scripts/run_search_terms_ingest.py` |
| MeisterTask export (MOFU + BOFU) | `data/inbox/meistertask/` | `{slug}-meistertask-{YYYYMMDD}.csv` | `scripts/run_meistertask_pipeline.py` |

Ejemplo de nombre válido:
- `prepagas-search-terms-20260511.csv`
- `prepagas-meistertask-20260511.csv`

## Qué nunca subir al repo

Los CSV de cliente NO van a git. La carpeta `data/inbox/` está en `.gitignore` (excepto este README y la subestructura de carpetas vacías).

## Qué hace Claude al procesar

1. Detecta el archivo en `data/inbox/{tipo}/`.
2. Valida el nombre y el slug contra `clients/{slug}.json`.
3. Carga las credenciales desde `.env` (Supabase, etc).
4. Ejecuta el pipeline correspondiente con `--input <ruta-del-csv>`.
5. Confirma que las tablas destino se actualizaron (count de filas insertadas / upserted).
6. Mueve el CSV a `data/inbox/processed/{YYYY-MM-DD}/` con timestamp en el nombre.
7. Reporta: filas procesadas, errores, próximo paso.

## Si hay un error

El archivo NO se mueve a `processed/`. Queda en su carpeta original y Claude reporta el motivo.

## Roadmap

- Hoy: Search terms y MeisterTask requieren ingesta manual (no hay API automatizada).
- Próximo: Agregar job MeisterTask al workflow `extract_all.yml` con `workflow_dispatch` para que Franco pueda dispararlo desde GH Actions sin descargar el CSV localmente (Fase 5).
