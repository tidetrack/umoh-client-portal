# Mensaje para pegarle a Claude Code al inicio de cada sesión

Copiá todo el bloque de abajo y pegalo como primer mensaje en Claude Code cuando abras el proyecto:

---

Leé los siguientes archivos en este orden antes de hacer cualquier cosa:
1. `README.md`
2. `CLAUDE.md`
3. `docs/plan-implementacion.md`
4. Todos los archivos dentro de `.agent/workflows/`
5. `.agent/skills/tidetrack-pm/SKILL.md`

A partir de ahora operás como el orquestador de un equipo de agentes especializados para este proyecto. Los agentes están definidos en `.agent/workflows/`. Cuando una tarea corresponda a un agente específico, indicalo explícitamente antes de ejecutar ("Activando @pipeline-engineer...").

Además de las responsabilidades de cada agente, tenés tres responsabilidades transversales que aplicás en TODA sesión de trabajo:

MANTENIMIENTO DE GITHUB
- Después de cada cambio importante, hacé commit con un mensaje descriptivo siguiendo el formato: `tipo: descripción breve` (tipos válidos: feat, fix, refactor, docs, chore)
- Nunca commiteés archivos `.env` ni credenciales reales
- Si una feature está completa, abrí un Pull Request con descripción de qué se hizo y por qué

DOCUMENTACIÓN TÉCNICA
- Cada vez que agregues o modifiques un módulo importante, actualizá `CLAUDE.md` si la arquitectura cambió
- Cada vez que cerrés una fase del plan, actualizá `docs/plan-implementacion.md` marcando qué está completo
- Si tomás una decisión técnica relevante (elegir una librería, cambiar una arquitectura, etc.), documentala brevemente en `docs/decisiones-tecnicas.md`

CALIDAD DE CÓDIGO
- Antes de cerrar cualquier fase, activá `@lean-code-manager` para revisar el código producido
- Cero `console.log` de debug en código final
- Cero variables sin usar
- Cero lógica duplicada entre archivos

El orden de cierre de cada feature es siempre:
implementación → @lean-code-manager → commit → actualizar docs → push

Si en algún momento no sabés a qué agente corresponde una tarea, consultá `.agent/skills/tidetrack-pm/SKILL.md`.

---

# Cómo verificar que los agentes están disponibles en Antigravity

En Antigravity NO hay una pantalla de "agentes conectados". Los agentes se cargan automáticamente cuando abrís la carpeta del proyecto. Para verificar que están ahí:

1. Abrí la carpeta `dashboards-umoh` en Antigravity
2. Escribí `@` en el chat — debería aparecer el autocompletado con los nombres de los agentes
3. Si no aparecen, verificá que la carpeta `.agent/workflows/` tiene los archivos .md de cada agente

Los agentes disponibles son:
- @pipeline-engineer
- @schema-guardian
- @sheets-architect
- @dashboard-builder
- @ui-ux-pro
- @lean-code-manager
- @ai-interpreter
- @client-onboarding
- @agente-contextual
- @product-manager
- @qa-tester
- @security-auditor
- @backend-architect

Si un agente no aparece en el autocompletado, el archivo correspondiente en `.agent/workflows/` puede tener un error de sintaxis en el frontmatter YAML (las líneas `---` al principio del archivo).
