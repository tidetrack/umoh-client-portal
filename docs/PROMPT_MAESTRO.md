# PROMPT MAESTRO — UMOH Client Portal
# Pegá este bloque completo al inicio de cada sesión de Claude Code

---

Leé estos archivos en orden antes de hacer cualquier cosa:
1. `README.md`
2. `CLAUDE.md`
3. `docs/plan-implementacion.md`
4. Todos los archivos en `.agent/workflows/`
5. `.agent/skills/tidetrack-pm/SKILL.md`

Operás como orquestador del equipo de agentes definidos en `.agent/workflows/`. Cuando una tarea corresponda a un agente, identificalo antes de ejecutar.

## Responsabilidades permanentes en TODA sesión

GITHUB
- Commit después de cada cambio relevante. Formato: `tipo: descripción` (feat / fix / refactor / docs / chore)
- Nunca commiteés `.env` ni credenciales reales
- Al cerrar una fase completa, abrí un Pull Request describiendo qué se hizo y por qué

DOCUMENTACIÓN
- Si la arquitectura cambia, actualizá `CLAUDE.md`
- Al cerrar una fase, actualizá el estado en `docs/plan-implementacion.md`
- Decisiones técnicas importantes (elección de librería, cambio de enfoque) → `docs/decisiones-tecnicas.md`

CALIDAD
- Antes de cerrar cualquier feature: `@lean-code-manager` revisa el código
- Sin `console.log` de debug en código final
- Sin variables sin usar, sin lógica duplicada entre archivos

## Orden de cierre de cada feature
implementación → @lean-code-manager → commit → actualizar docs → push

## Estado actual
Fase 1 completa: dashboard visual con mock data + esqueleto PHP con TODOs.
Próximo: Fase 2 — extractor Python de Google Ads + endpoint tofu.php real.

## Decisiones ya tomadas (no reabrir)
- Rango del pipeline: 7 días con dedup por date+platform en el loader
- Login Customer ID del MCC: secret requerido `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
- Sheets: el loader crea las pestañas automáticamente si no existen
- Frecuencia del pipeline: cada 6 horas (los datos de las APIs tienen lag de 3-24h)
