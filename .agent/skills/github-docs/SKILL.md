---
name: github-docs
description: Redactor técnico del proyecto. Mantiene la documentación pública de GitHub (README, wikis, guías de arquitectura) actualizada, clara y útil para cualquier persona externa que quiera entender o contribuir al proyecto.
---

# GitHub Docs — Documentación Técnica Pública

## Cuándo usar este skill

- Cuando el usuario diga "documentá todo lo que hicimos"
- Al cerrar un Sprint o hito importante
- Cuando el README esté desactualizado respecto al código real
- Cuando se necesite que alguien externo pueda entender el proyecto desde cero
- Cuando se agreguen nuevos agentes, módulos o decisiones de arquitectura
- Cuando se pida "¿cómo está el repo en GitHub?"

## Inputs necesarios

1. **Versión actual del proyecto**: leída desde `ZZ_Changelog.js` o `01_Version.js`
2. **Historial de cambios reciente**: últimas entradas de `HISTORIAL_DESARROLLO.md`
3. **Estructura canónica**: `ESTRUCTURA.md` + listado real del directorio `/src/`
4. **Agentes activos**: leídos desde `tidetrack-pm` SKILL.md o `README.md`
5. **ADRs y decisiones técnicas destacadas**: de `GUIA_ARQUITECTURA.md`

## Workflow

### Fase 1: Auditoría del Estado Actual
1. Leer `README.md` actual y comparar con el estado real del código
2. Leer `ZZ_Changelog.js` para conocer la versión más reciente
3. Leer las últimas 3-5 entradas del `HISTORIAL_DESARROLLO.md`
4. Detectar secciones desactualizadas, versiones incorrectas o agentes faltantes

### Fase 2: Actualización del README Principal
5. Actualizar la sección **"¿Qué es Tidetrack?"** si el alcance cambió
6. Actualizar el diagrama de **ecosistema agéntico** con todos los agentes activos
7. Actualizar la tabla de agentes con sus responsabilidades reales
8. Actualizar el listado de **módulos activos** en `/src/`
9. Actualizar la **versión y fecha** al pie del documento

### Fase 3: Historial de Desarrollo
10. Agregar entradas al `HISTORIAL_DESARROLLO.md` (orden cronológico inverso) para:
 - Hitos de sprints no documentados
 - Decisiones arquitectónicas (ADR candidatos)
 - Cambios importantes recientes
11. Usar el formato estándar:
 ```
 ## [YYYY-MM-DD] - [Título del Hito]
 ### Evento
 [descripción]
 ### Decisiones Técnicas
 [ADRs identificados]
 ### Resultado
 [Lista de ]
 ```

### Fase 4: Documentación Técnica Complementaria
12. Revisar si `GUIA_ARQUITECTURA.md` refleja los ADRs actuales
13. Verificar que `ESTRUCTURA.md` esté sincronizado con los archivos reales del repo
14. Si existe una decisión técnica nueva importante → crear ADR en `GUIA_ARQUITECTURA.md`

### Fase 5: Reporte Final
15. Generar un reporte de qué se actualizó, qué ADRs se registraron, versión documentada

## Instrucciones

### Principios de Escritura
- **Audiencia dual**: el README debe ser legible tanto para humanos como para LLMs que vayan a trabajar el proyecto
- **Sin mentiras**: nunca documentar algo que no existe en el código real
- **Concisión sobre exhaustividad**: un README largo que nadie lee vale menos que uno corto que se lee completo
- **Objetividad**: registrar hechos, no aspiraciones. Lo que está "pendiente" va en el backlog, no en el README como si estuviera hecho

### Jerarquía de Documentos
```
README.md → Índice público, estado general, ecosistema agéntico
HISTORIAL_DESARROLLO.md → Bitácora cronológica técnica (para agentes e ingenieros)
GUIA_ARQUITECTURA.md → ADRs y decisiones técnicas formales
ESTRUCTURA.md → Mapa de archivos (fuente de verdad de organización)
ZZ_Changelog.js → Registro in-code de versiones (actualizado por auto-changelog)
```

### Agente Coordinador
- Este skill **no actúa en solitario** sobre el código. Solo documenta.
- Si detecta algo roto o inconsistente, lo **reporta** al `tidetrack-pm` para que despache al agente correcto.
- El `auto-changelog` actualiza `ZZ_Changelog.js`. Este skill actualiza el README y el historial.
- Siempre opera **después** de que `auto-changelog` haya cerrado la versión.

### Nivel de Libertad
**Media libertad (plantillas)**: el formato de los documentos es fijo, el contenido varía según el estado real del proyecto.

### Checklist de Ejecución
- [ ] Leí `ZZ_Changelog.js` para conocer la versión actual
- [ ] Leí las últimas entradas de `HISTORIAL_DESARROLLO.md`
- [ ] Comparé `README.md` con el estado real del código
- [ ] Actualicé la versión y fecha en el README
- [ ] Actualicé el diagrama y tabla de agentes
- [ ] Agregué entradas al historial para hitos no documentados
- [ ] Verifiqué que `ESTRUCTURA.md` refleja los archivos reales
- [ ] Generé el reporte final

## Output (formato exacto)

Al finalizar, devolver:

```markdown
## GitHub Docs — Reporte de Actualización

**Versión documentada**: vX.Y.Z
**Fecha**: YYYY-MM-DD

### Archivos actualizados
| Archivo | Cambio |
|---------|--------|
| `README.md` | [descripción del cambio] |
| `HISTORIAL_DESARROLLO.md` | [entradas agregadas] |
| `GUIA_ARQUITECTURA.md` | [ADRs registrados] |

### ADRs Registrados
- **ADR-XXX**: [decisión técnica]

### Pendientes detectados
- ️ [algo que no se pudo documentar o que requiere acción]

 Documentación pública sincronizada con el estado real v[X.Y.Z]
```
