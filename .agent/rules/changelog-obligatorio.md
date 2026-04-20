# Regla Obligatoria: Actualización de Changelog Iterativo

## Contexto
Por solicitud y diseño estricto del usuario, toda modificación o iteración realizada sobre los documentos del proyecto (particularmente código en `src/` o redacción de documentos principales) DEBE quedar registrada.

## Obligación Diaria de los Agentes
1. Al terminar de programar, editar o refactorizar los cambios de una iteración, el agente AI a cargo tiene el DEBER OBLIGATORIO de actualizar dos archivos simultáneamente:
   - `src/ZZ_Changelog.js` (registrando técnica y concisamente los cambios al tope de los comentarios, autoincrementando la versión usando reglas de SemVer para features o bugs, e iteraciones simples cuando sean ajustes menores).
   - `docs/permanente/HISTORIAL_DESARROLLO.md` (añadiendo el resumen cronológico global y extendido para su lectura rápida).

2. Esta actualización debe ocurrir PREVIO a cerrar el requerimiento o cederle el control final al usuario o al skill de Github para su despliegue.

3. Se debe recurrir internamente a las lógicas del skill `@auto-changelog` para respetar al 100% los formatos dictaminados. No se da por validada una respuesta final al usuario sin que los changelogs se encuentren modificados en la misma intervención.
