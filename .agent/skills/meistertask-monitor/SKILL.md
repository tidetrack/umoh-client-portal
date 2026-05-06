---
name: meistertask-monitor
description: Monitor semanal del pipeline MeisterTask. Valida que el cron de GitHub Actions haya corrido correctamente leyendo `import_runs` en Supabase. Si detecta problemas, abre issue en GitHub. Operacional, no constructor.
---

# Monitor del Pipeline MeisterTask

## Cuándo usar este skill

Una vez por semana, idealmente martes 12:00 UTC (3 horas después del cron real del lunes 09:00 UTC). También se puede invocar bajo demanda cuando Franco sospecha de un problema en el dashboard MOFU/BOFU.

Triggers:
- Schedule semanal (vía `/schedule` skill o cron de Hostinger)
- "Chequeá el último run de MeisterTask"
- "Validá el import de esta semana"
- "El dashboard se ve raro, fijate si el pipeline corrió"

## Inputs necesarios

Ninguno explícito — el agente sabe que el cliente activo es `prepagas` y que la tabla a consultar es `import_runs`. Si en el futuro hay más clientes, el agente itera por todos los clientes activos.

Variables de entorno requeridas (ya configuradas en `.env`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

## Workflow

1. **Localizar el último run** de `client_slug='prepagas'` en `import_runs` (últimos 8 días).
2. **Aplicar 5 checks de salud**:
   - Run reciente (≤8 días)
   - `errors` vacío
   - `total_tasks > 0`
   - Suma `new + updated + skipped = total`
   - Tabla `leads` no vacía
3. **Decidir**:
   - Todo OK → reportar status al usuario, **cero ruido**, no abrir issue.
   - Falla crítica → abrir issue con `gh issue create` (mention a `@pipeline-engineer`).
   - Solo warnings → reportar pero no abrir issue.
4. **Reportar al usuario** con el formato estándar (status + checks + acción).

## Instrucciones

- Usar el **MCP de Supabase** si está activo (preferido). Si no, usar `data/connections/supabase_client.py` desde Python.
- Antes de abrir un issue, **buscar issues abiertos similares** con `gh issue list --label monitor --state open` y comentar el existente en lugar de duplicar.
- **NO modificar código del pipeline** — escalar a `pipeline-engineer`.
- **NO ejecutar DDL** — escalar a `supabase-architect` si el problema es de schema.
- Tono: ejecutivo, español rioplatense, sin emoji.

## Output

```markdown
## Monitor MeisterTask — {fecha}

**Status**: OK | WARNING | CRITICAL

**Último run**: {run_at} ({hace cuánto})
**Tareas procesadas**: total={N} new={N} updated={N} skipped={N}
**Errores reportados**: {N o "ninguno"}

**Checks**:
- [x|✗] Run reciente (≤8 días)
- [x|✗] Sin errores en import_runs.errors
- [x|✗] Total de tareas > 0
- [x|✗] Suma de counts cuadra
- [x|✗] Tabla leads no vacía

**Acción tomada**: {ninguna | issue #N abierto}

**Próxima corrida programada**: {martes que viene 12:00 UTC}
```

## Integración con el equipo

- **Antes**: `pipeline-engineer` construyó el workflow `meistertask_weekly.yml` y `scripts/run_meistertask_pipeline.py`. El monitor depende de que ese workflow corra y escriba en `import_runs`.
- **Después**: si detecta problema, abre issue → `pipeline-engineer` actúa.
- **Paralelo**: `supabase-architect` mantiene la tabla `import_runs`. Si el monitor encuentra discrepancias estructurales (ej: columna faltante), escala.
