---
name: creador-de-skills
description: Genera skills reutilizables para Antigravity con estructura estandarizada (YAML, inputs, workflow, checklist y output). Úsalo cuando necesites crear un procedimiento repetible o convertir un prompt largo en un skill operativo.
---

# Creador de Skills para Antigravity

## Cuándo usar este skill

- Cuando el usuario pida "créame una skill para X"
- Cuando se identifique un proceso que se repite frecuentemente
- Cuando haya que convertir un prompt largo en un procedimiento reutilizable
- Cuando se necesite un estándar de formato para una tarea específica
- Cuando se requiera documentar un flujo de trabajo repetible

## Inputs necesarios

1. **Nombre del skill**: corto, en minúsculas, con guiones (ej: `planificar-video`, `auditar-landing`)
2. **Propósito**: qué hace el skill y cuándo se usa
3. **Nivel de libertad**:
 - Alta: brainstorming, ideas, alternativas
 - Media: documentos, copys, estructuras
 - Baja: operaciones frágiles, scripts, cambios técnicos
4. **Inputs que requiere**: datos necesarios para ejecutar el skill
5. **Output esperado**: formato exacto de salida (lista, tabla, JSON, markdown, etc.)
6. **Recursos adicionales** (opcional): scripts, plantillas, ejemplos

## Workflow

### Fase 1: Planificación
1. **Validar triggers claros**: definir cuándo se activa el skill
2. **Determinar nivel de complejidad**: simple (3-6 pasos) vs complejo (fases)
3. **Identificar inputs críticos**: qué datos son imprescindibles
4. **Definir output estandarizado**: formato exacto de respuesta

### Fase 2: Estructura
5. **Crear carpeta**: `agent/skills/<nombre-del-skill>/`
6. **Generar SKILL.md** con frontmatter YAML:
 ```yaml
 ---
 name: <nombre-del-skill>
 description: <descripción breve en tercera persona, máx 220 chars>
 ---
 ```
7. **Evaluar recursos adicionales**:
 - `recursos/`: solo si hay guías, plantillas o tokens necesarios
 - `scripts/`: solo si hay utilidades ejecutables
 - `ejemplos/`: solo si aportan valor las implementaciones de referencia

### Fase 3: Documentación
8. **Escribir secciones obligatorias**:
 - Cuándo usar este skill (triggers concretos)
 - Inputs necesarios (lista clara)
 - Workflow (pasos numerados o fases)
 - Instrucciones (reglas de ejecución)
 - Output (formato exacto)
9. **Agregar manejo de errores**:
 - Qué hacer si el output no cumple el formato
 - Cómo pedir feedback al usuario
 - Cómo iterar sin romper el estándar

### Fase 4: Validación
10. **Revisar coherencia**: el skill debe ser autosuficiente
11. **Verificar claridad**: eliminar relleno, mantener lo operativo
12. **Confirmar salida**: el formato de output debe estar perfectamente definido

## Instrucciones

### Principios de escritura
- **Claridad sobre longitud**: mejor pocas reglas, pero muy claras
- **No relleno**: evita explicaciones tipo blog. El skill es un manual de ejecución
- **Separación de responsabilidades**: si hay "estilo", va a un recurso. Si hay "pasos", van al workflow
- **Pedir datos cuando falten**: si un input es crítico, el skill debe preguntar
- **Salida estandarizada**: define exactamente qué formato devuelves

### Reglas de nombre y YAML
- **name**: corto, minúsculas, guiones. Máximo 40 caracteres
- **description**: español, tercera persona, máximo 220 caracteres. Debe decir qué hace y cuándo usarlo
- No uses nombres de herramientas salvo que sea imprescindible
- No metas "marketing" en el YAML: que sea operativo

### Niveles de libertad
1. **Alta libertad (heurísticas)**: para brainstorming, ideas, alternativas
2. **Media libertad (plantillas)**: para documentos, copys, estructuras
3. **Baja libertad (pasos exactos)**: para operaciones frágiles, scripts, cambios técnicos

**Regla**: cuanto más riesgo, más específico debe ser el skill

### Estructura mínima obligatoria
```
agent/skills/<nombre-del-skill>/
├── SKILL.md (obligatorio)
├── recursos/ (opcional)
├── scripts/ (opcional)
└── ejemplos/ (opcional)
```

### Checklist de validación
- [ ] Entendí el objetivo final
- [ ] Tengo inputs necesarios
- [ ] Definí output exacto
- [ ] Apliqué restricciones de nivel de libertad
- [ ] Revisé coherencia y errores
- [ ] Eliminé archivos innecesarios

### Manejo de errores
Si el resultado no cumple el formato:
1. Vuelve al paso de definición de output
2. Ajusta restricciones y restricciones de nivel
3. Re-genera el skill
4. Si hay ambigüedad, pregunta antes de asumir

## Output (formato exacto)

Cuando crees un skill, devuelve:

```markdown
## Carpeta creada
`agent/skills/<nombre-del-skill>/`

## SKILL.md
---
name: <nombre-del-skill>
description: <descripción breve>
---

# <Título del skill>

## Cuándo usar este skill
- Trigger 1
- Trigger 2
- ...

## Inputs necesarios
- Input 1
- Input 2
- ...

## Workflow
1. Paso 1
2. Paso 2
3. ...

## Instrucciones
[Reglas de ejecución claras y concisas]

## Output (formato exacto)
[Definición precisa del formato de salida]
```

### Recursos opcionales (solo si aportan valor)
- `recursos/<archivo>.md`: guías, plantillas, tokens
- `scripts/<archivo>.sh`: utilidades ejecutables
- `ejemplos/<archivo>.md`: implementaciones de referencia

## Ejemplos de skills útiles

Si el contexto lo requiere, sugiere crear estos skills:
- **estilo-y-marca**: mantener tono y voz consistente
- **planificar-videos**: estructura para contenido audiovisual
- **auditar-landing**: checklist de conversión y UX
- **debug-app**: proceso estandarizado de troubleshooting
- **responder-emails**: templates con tono profesional
- **documentar-api**: estructura para endpoints y ejemplos
- **revisar-codigo**: checklist de code review
- **crear-changelog**: formato estandarizado de versiones

## Notas adicionales

- Mantén la estructura lo más simple posible
- No crees archivos innecesarios
- El skill debe ser autosuficiente y operativo
- Prioriza la ejecución sobre la explicación
- Cada skill debe poder usarse de forma independiente
