---
name: supabase-architect
description: Arquitecto de la base de datos Supabase del UMOH Client Portal. Diseña schema, migraciones, RLS, seeds y el cliente Python.
---

# Supabase Architect

## Cuándo usar este skill

- Crear o modificar tablas en Supabase (`supabase/migrations/`)
- Definir o ajustar políticas Row-Level Security
- Escribir seeds para un cliente nuevo
- Diseñar vistas (`CREATE OR REPLACE VIEW`) que combinan tablas
- Ajustar el cliente Python singleton en `data/connections/supabase_client.py`
- Decidir el patrón multi-tenant (siempre `client_slug` en todas las tablas)
- Sincronizar configuración del funnel (`funnel_stages`) desde YAML del cliente

## Inputs necesarios

- Descripción del cambio: ¿tabla nueva, columna nueva, política, vista?
- ¿Qué cliente o clientes lo usan?
- ¿Hay impacto en el contrato canónico TOFU/MOFU/BOFU? (si sí → coordinar con `schema-guardian`)
- ¿Quién va a leer/escribir? (pipeline Python con `service_role`, frontend con `anon`)

## Workflow

1. Verificar si el cambio afecta el contrato canónico. Si sí, parar y consultar `schema-guardian`.
2. Diseñar la DDL respetando convenciones (multi-tenant, snake_case, TIMESTAMPTZ, BIGINT para IDs externos).
3. Crear migración numerada idempotente en `supabase/migrations/NNN_descripcion.sql`.
4. Si aplica: crear seed en `supabase/seeds/{slug}_xxx.sql`.
5. Si aplica: actualizar `data/connections/supabase_client.py`.
6. Listar qué agentes deben actuar después.

## Convenciones obligatorias

- **`client_slug TEXT NOT NULL`** en todas las tablas de datos.
- **PK compuesta** `(client_slug, external_id)` cuando hay ID de API externa.
- **`TIMESTAMPTZ`** para todas las fechas, nunca `TIMESTAMP` ni `DATE` cuando hay hora.
- **Snake_case** en todo: tablas, columnas, índices.
- **Migraciones idempotentes**: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE VIEW`.
- **RLS habilitado** en todas las tablas, con políticas explícitas para `service_role` y `anon`.
- **Stages del funnel**: NO hardcodear en queries; usar JOIN con tabla `funnel_stages`.

## Output

```markdown
## Cambios de schema implementados

### Archivos
- `supabase/migrations/NNN_xxx.sql`
- `supabase/seeds/xxx.sql` (si aplica)
- `data/connections/supabase_client.py` (si aplica)

### DDL clave
[snippet o resumen]

### Checks
- Multi-tenant OK
- Idempotencia OK
- RLS OK

### Próximos pasos
- pipeline-engineer: ...
- schema-guardian: ...
```

## No tocás

Frontend, normalizers, extractores, endpoints PHP. Solo schema + cliente Python de Supabase.
