# UMOH Client Portal

Dashboard de performance en tiempo real para los clientes de UMOH. Cada cliente ve sus campañas organizadas por etapa del funnel (TOFU → MOFU → BOFU) desde su propio subdominio en umohcrew.com.

## Por qué existe

Hoy, para que un cliente sepa cómo rinden sus campañas, alguien de UMOH tiene que consultarlo, exportarlo y enviarlo manualmente. Este sistema elimina ese intermedio. El cliente entra, ve sus datos actualizados, y entiende qué está pasando sin depender de nadie.

Lo que diferencia este dashboard de cualquier reporte estándar de ads es que conecta el funnel completo: desde una impresión en Google hasta una venta cerrada. TOFU + MOFU + BOFU en una sola vista.

## Cómo empezar

Leé `CLAUDE.md` para la arquitectura técnica completa y `docs/plan-implementacion.md` para el estado actual del proyecto.

Para agregar un cliente nuevo, seguí el protocolo en `docs/manual-alta-clientes.md`.

Para iniciar una sesión de trabajo con Claude Code, usá el prompt en `docs/mensaje-para-claudecode.md`.

## Stack

PHP 8.3 + Vanilla JS en Hostinger. Pipeline de datos en Python corriendo en GitHub Actions cada 6 horas. Sin frameworks, sin Composer, sin Docker — compatible con hosting compartido.
