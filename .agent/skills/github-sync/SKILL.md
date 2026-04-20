---
name: github-sync
description: Agente de sincronización continua y versionado con GitHub. Cubre dos modos: watcher automático (auto-sync.js) para commit/push sin fricción durante el trabajo, y commit manual semántico para hitos relevantes.
---

# GitHub Sync — Sincronización con GitHub

## Cuándo usar este skill
- Cuando el usuario diga "guardá en GitHub", "subí los cambios" o similar.
- Al finalizar una feature completa (último paso del pipeline de `tidetrack-pm`).
- Al inicio de una sesión, para activar el watcher automático de fondo.
- Cuando haya conflictos o errores de autenticación con GitHub.

## Dos Modos de Operación

### Modo A: Watcher Automático (durante el trabajo)
Para no interrumpir el flujo de desarrollo. Cada modificación se sube sola.

**Activación:**
```bash
node scripts/auto-sync.js
```
O bien, doble clic en `iniciar_autosync.command` desde Finder.

**Comportamiento:**
- Observa cambios en el proyecto con debounce de 10 segundos.
- Ejecuta `git add . && git commit -m "chore(auto): backup"` y `git push` automáticamente.
- Dejar la ventana de terminal minimizada y olvidarse.
- Para detener: `Ctrl + C` en esa terminal.

### Modo B: Commit Semántico Manual (al cerrar un hito)
Para hitos importantes que merecen un commit con mensaje significativo.

**Workflow:**
1. `git status` — verificar qué archivos cambiaron.
2. `git add .` — staging completo.
3. `git commit -m "<tipo>(<scope>): <descripción>"` — usar Conventional Commits:
 - `feat(plan-cuentas): agregar validación de duplicados`
 - `fix(sheet-manager): corregir deleteRow en tablas multi-columna`
 - `docs(readme): actualizar ecosistema agéntico`
 - `chore(config): actualizar rangos de PROYECTOS`
4. `git push origin main`

## Instrucciones
- **Siempre Modo B para cierres de feature** (coordina con `tidetrack-pm`).
- **Usar Modo A** para trabajo incremental del día a día.
- Si hay error 403 (auth), guiar al usuario a regenerar su PAT en GitHub → Settings → Developer Settings → Tokens.
- Si la rama no existe en remoto: `git push -u origin main`.
- Nunca hacer push en modo B sin que `auto-changelog` haya actualizado el changelog primero.

## Output (formato exacto)
```markdown
## Sincronización con GitHub Completada

- **Rama**: `main`
- **Commit**: `[mensaje usado]`
- **Archivos**: [cantidad] archivos sincronizados

 Código y documentación respaldados en GitHub.
```
