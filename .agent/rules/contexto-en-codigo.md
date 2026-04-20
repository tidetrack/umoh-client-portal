# Regla: Inserción de Contexto Estratégico en el Código (`src/`)

## Objetivo
Por instrucción directa, el ecosistema de código no debe ser puramente técnico. El código fuente (`src/`) DEBE portar consigo su propia "razón de ser" dentro del organigrama de la PyME. Esto garantiza que cualquier modelo de lenguaje o IA (como NotebookLM) que analice los archivos `.js` entienda inmediatamente el contexto de negocio sin necesitar inferirlo.

## A quién aplica
Aplica irrestrictamente a cualquier agente desarrollador (ej. `@appscript-backend`, `@appscript-ui`, `@lean-code-expert`) que intervenga el código en `src/`.

## Instrucción de Formato
Todo archivo script o HTML dentro del sistema debe comenzar con un bloque de documentación estructurado en tres micro-bloques:

1. **[CONCEPTO DE NEGOCIO]:** Qué objetivo empresarial cumple este script a la hora de gestionar la administración (Ej: "Previene la pérdida de tickets", "Calcula la deuda neta", "Estandariza altas contables").
2. **[FUNDAMENTO TEÓRICO / ADMINISTRATIVO]:** La regla directiva teórica subyacente (Ej: "Respeta el esquema devengado", "Obliga a la doble imputación").
3. **@see**: Vínculo al documento de despliegue conceptual detallado que resida en `docs/permanente/notebookLM/`.

## Restricción de Despliegue
Al igual que el auto-changelog, no se autoriza considerar un script "Terminado" hasta que dichas firmas teóricas existan en su cabecera.
