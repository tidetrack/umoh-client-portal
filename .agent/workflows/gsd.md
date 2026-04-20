---
description: GSD (Get Shit Done) - Sistema completo de gestión de proyectos con agentes. Comandos disponibles: new-project, plan-phase [N], execute-phase [N], progress, debug [issue], quick, discuss-phase [N], verify-work [N], map-codebase, pause-work, resume-work, add-todo, check-todos, add-phase, insert-phase, remove-phase, new-milestone, complete-milestone, audit-milestone, settings.
---

# GSD — Get Shit Done

Este workflow actúa como **punto de entrada unificado** para el sistema GSD 1.0.1.

## Cómo usar

Al recibir un comando `/gsd [subcomando]`, el agente debe:

1. **Leer el SKILL.md** ubicado en `.agent/skills/gsd/SKILL.md` para obtener el contexto completo del sistema.
2. **Identificar el workflow** correspondiente al subcomando según la tabla de enrutamiento del SKILL.md.
3. **Leer y ejecutar** el workflow en `.agent/skills/gsd/workflows/[comando].md`.

## Referencia rápida de comandos

| Comando | Workflow ejecutado |
| ----------------------------- | --------------------------------------------------- |
| `new-project` | `.agent/skills/gsd/workflows/new-project.md` |
| `plan-phase [N]` | `.agent/skills/gsd/workflows/plan-phase.md` |
| `execute-phase [N]` | `.agent/skills/gsd/workflows/execute-phase.md` |
| `progress` | `.agent/skills/gsd/workflows/progress.md` |
| `debug [issue]` | `.agent/skills/gsd/workflows/debug.md` |
| `quick` | `.agent/skills/gsd/workflows/quick.md` |
| `discuss-phase [N]` | `.agent/skills/gsd/workflows/discuss-phase.md` |
| `verify-work [N]` | `.agent/skills/gsd/workflows/verify-work.md` |
| `map-codebase` | `.agent/skills/gsd/workflows/map-codebase.md` |
| `pause-work` | `.agent/skills/gsd/workflows/pause-work.md` |
| `resume-work` | `.agent/skills/gsd/workflows/resume-work.md` |
| `add-todo [desc]` | `.agent/skills/gsd/workflows/add-todo.md` |
| `check-todos [area]` | `.agent/skills/gsd/workflows/check-todos.md` |
| `add-phase <desc>` | `.agent/skills/gsd/workflows/add-phase.md` |
| `insert-phase <after> <desc>` | `.agent/skills/gsd/workflows/insert-phase.md` |
| `remove-phase <N>` | `.agent/skills/gsd/workflows/remove-phase.md` |
| `new-milestone [name]` | `.agent/skills/gsd/workflows/new-milestone.md` |
| `complete-milestone <ver>` | `.agent/skills/gsd/workflows/complete-milestone.md` |
| `audit-milestone [ver]` | `.agent/skills/gsd/workflows/audit-milestone.md` |
| `settings` | `.agent/skills/gsd/workflows/settings.md` |

## Estructura del skill GSD

```
.agent/skills/gsd/
├── SKILL.md ← Descripción completa del sistema
├── agents/ ← 11 sub-agentes especializados
│ ├── gsd-planner.md
│ ├── gsd-executor.md
│ ├── gsd-verifier.md
│ ├── gsd-debugger.md
│ └── ... (7 más)
├── workflows/ ← 32 workflows de operación
├── references/ ← 15 archivos de referencia técnica
└── templates/ ← Plantillas para artefactos .planning/
```

## Artefactos generados

GSD crea y mantiene la carpeta `.planning/` con:

- `PROJECT.md` — Contexto del proyecto
- `REQUIREMENTS.md` — Scope y must-haves
- `ROADMAP.md` — Fases y milestones
- `phases/` — Planes de ejecución por fase
- `research/` — Investigación por fase
