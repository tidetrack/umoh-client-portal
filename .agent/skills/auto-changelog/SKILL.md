---
name: auto-changelog
description: Agente autónomo de versionado. Al finalizar cualquier feature o fix, actualiza automáticamente ZZ_Changelog.js con una entrada versionada y HISTORIAL_DESARROLLO.md con la entrada cronológica. No requiere instrucción explícita; es parte del pipeline estándar de cierre.
---

# Auto-Changelog — Agente de Versionado Automático

## Cuando usar este skill
- Siempre que se finalice una feature, fix, o mejora que involucre codigo en el directorio `src/`.
- Cuando el usuario diga "actualiza el changelog" o "registra los cambios".
- Al cerrar un sprint o hito importante de desarrollo.
- IMPORTANTE: Si los cambios ocurrieron EXCLUSIVAMENTE fuera de `src/` (ej: modificaciones a agentes, reglas, documentacion markdown, etc.), **NO** se debe actualizar `ZZ_Changelog.js`. El changelog en JS pertenece estrictamente al entorno de Apps Script.

## Inputs necesarios
1. **Descripción de lo que se hizo**: Recibida como contexto de la tarea finalizada.
2. **Última versión registrada**: La leerás del propio `ZZ_Changelog.js`.
3. **Fecha actual**: `2026-03-20` (o la que corresponda al momento de ejecución).

## Workflow

### Paso 1: Leer la versión actual
1. Abrir `src/ZZ_Changelog.js`.
2. Leer la primera entrada (la más reciente). Extraer el número de versión (ej: `v0.4.9`).
3. Calcular la siguiente versión: incrementar el **patch** (`v0.4.9` → `v0.5.0` si es feature, `v0.4.10` si es fix).

**Reglas de Versionado (SemVer con Iteraciones):**
- **Iteracion** (`vX.Y.Z-IteracionNN`): Cambios menores dentro de una versión activa (ej. documentacion, refactors chicos). Incrementar el número final.
- **Patch** (`vX.Y.Z+1`): bugfix, ajuste visual, limpieza.
- **Minor** (`vX.Y+1.0`): nueva funcionalidad completa (nuevo módulo, nueva pantalla).
- **Major** (`vX+1.0.0`): cambio arquitectónico de gran escala (rarísimo).

### Paso 2: Redactar la entrada de Changelog
Formato obligatorio para `ZZ_Changelog.js`:
```javascript
 * [YYYY-MM-DD] vX.Y.Z - [Título conciso de la feature/fix]:
 * - [Cambio 1: qué se hizo y por qué importa]
 * - [Cambio 2]
 * - [Cambio 3 si aplica]
 *
 * ---
```

### Paso 3: Insertar al tope de ZZ_Changelog.js
- Insertar la nueva entrada INMEDIATAMENTE después del bloque de apertura `/**` y antes de la primera entrada existente.
- Nunca borrar entradas viejas.

### Paso 4: Actualizar HISTORIAL_DESARROLLO.md
- Abrir `docs/permanente/HISTORIAL_DESARROLLO.md`.
- Agregar una entrada al tope (después del separador `---` más reciente) con este formato:
```markdown
## YYYY-MM-DD - [Título de la feature] (vX.Y.Z)

### Evento
[Descripción de qué se implementó y por qué]

### Cambios Implementados
- [Lista de cambios]

### Resultado
- [Resultado 1]
```

## Instrucciones
- Cero Emojis: Aplica la regla estricta `.agent/rules/no-emojis.md`. NO uses emojis bajo nigun concepto ni en el changelog ni en el historial.
- EXCLUSIVIDAD SRC: El archivo `ZZ_Changelog.js` vive en `src/` y se pushea a Google Apps Script. Solo debe recibir versiones si hubo alteraciones reales en el codigo fuente. Cambios en README, docs o scripts locales NO entran al Changelog.
- Se preciso en la version: Leer siempre la version real del archivo, no adivinarla. Evaluar si corresponde un salto de version o solo una iteracion (`-IteracionNN`).
- **Formato estricto**: El `ZZ_Changelog.js` tiene un formato exacto que debe mantenerse (es un comentario JS de bloque, no markdown).
- **No omitas el Historial**: Ambos archivos deben actualizarse en el mismo paso.
- Si no tenés suficiente contexto sobre qué cambió, preguntá al usuario UNA sola vez antes de proceder.

## Output (formato exacto)
```markdown
## Changelog Actualizado

- **Nueva versión**: vX.Y.Z
- **Fecha**: YYYY-MM-DD
- **Archivos actualizados**:
 - `src/ZZ_Changelog.js` — Entrada agregada al tope
 - `docs/permanente/HISTORIAL_DESARROLLO.md` — Entrada de hito agregada
```
