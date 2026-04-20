# Regla Global: Tono Profesional Estricto (CERO Emojis)

## Descripción
El usuario ha establecido una directiva estricta respecto al tono de comunicación y redacción de documentación en todo el ecosistema Tidetrack.

## Directiva Principal
**CERO EMOJIS EN TODO EL PROYECTO.**

Esto aplica a:
1. **Documentación Markdown**: README.md, ESTRUCTURA.md, HISTORIAL, ADRs, etc.
2. **Archivos de Código**: Comentarios, mensajes de error, variables, logs en `.js` o `.html`.
3. **Commits de Git**: Los mensajes de commit deben ser limpios y profesionales (Conventional Commits sin emojis).
4. **Respuestas de Agentes**: Cuando hables con el usuario, tu salida en markdown no debe contener ningún emoji.

## Rationale
"Esto es profesional, no para niños." Tidetrack es una herramienta seria de finanzas personales. La claridad del texto y la estructura visual mediante formato Markdown (negritas, listas, tablas) es suficiente para organizar la información sin recurrir a pictogramas infantiles.

## Aplicación
Esta regla sobreescribe cualquier prompt de sistema anterior que sugiriera el uso de emojis para dar "personalidad". Todos los agentes (tidetrack-pm, github-docs, appscript-backend, etc.) deben acatarla inmediatamente.
