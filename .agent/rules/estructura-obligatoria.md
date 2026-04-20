---
description: Regla global que define y obliga a respetar la estructura de carpetas del proyecto según ESTRUCTURA.md
---

# REGLA CRÍTICA: ESTRUCTURA DEL PROYECTO

## Autoridad

El archivo `ESTRUCTURA.md` en la raíz del proyecto es la ÚNICA FUENTE DE VERDAD para la organización de carpetas y archivos.

TODOS los agentes (Product Manager, Backend Architect, QA Tester, etc.) DEBEN respetar esta estructura sin excepciones.

## Estructura Canónica

Según `ESTRUCTURA.md`, el proyecto se organiza así:

```
constructora-inventarios-data/
│
├── src/ # Código fuente (12 bloques .js)
│ └── (archivos numerados 01_Bloque1_*.js hasta 12_Bloque12_*.js)
│
├── docs/ # Documentación
│ ├── permanente/ # Docs permanentes
│ │ ├── CHANGELOG.md
│ │ ├── DATABASE_SCHEMA.md
│ │ ├── GUIA_ARQUITECTURA.md
│ │ ├── HISTORIAL_DESARROLLO.md
│ │ ├── RESUMEN_PROYECTO.md
│ │ └── CONTEXTO_NEGOCIO.md
│ ├── sesiones/ # Historial de sesiones
│ ├── PRODUCT_BACKLOG.md
│ ├── REGLAS_AGENTE.md
│ └── README.md
│
├── _backup/ # Archivos históricos (NO USAR)
│
├── README.md # Punto de entrada
├── ESTRUCTURA.md # Este mapa (FUENTE DE VERDAD)
└── Notas Fran.md # Notas del usuario
```

## Mandatos Obligatorios

### 1. ANTES de crear o mover cualquier archivo:
-ESTRUCTURA GENERAL (Ver `docs/permanente/ESTRUCTURA.md` para el mapa completo)nfirmar la ubicación correcta
- Verifica que la carpeta de destino existe en el mapa
- NO inventes carpetas nuevas sin actualizar primero `ESTRUCTURA.md`

### 2. Reglas por tipo de archivo:

| Tipo de Archivo | Ubicación OBLIGATORIA | Ejemplo |
|---|---|---|
| Código fuente (.js, .ts) | `/src/` | `src/01_Bloque1_Config.js` |
| Documentación permanente | `/docs/permanente/` | `docs/permanente/CHANGELOG.md` |
| Backlog y roadmap | `/docs/` | `docs/PRODUCT_BACKLOG.md` |
| Sesiones de desarrollo | `/docs/sesiones/` | `docs/sesiones/2026-01-17_session.md` |
| Archivos temporales/legacy | `/_backup/` | `_backup/old_version.js` |
| Docs de raíz | Raíz del proyecto | `README.md`, `ESTRUCTURA.md` |

### 3. Orden de Ejecución (para código):
Los archivos en `/src/` DEBEN seguir el orden numérico (01, 02, 03...). Este orden es crítico para Google Apps Script.

### 4. Prohibiciones:
- NO crear carpetas temporales en la raíz
- NO guardar código fuera de `/src/`
- NO modificar archivos en `/_backup/`
- NO crear documentación fuera de `/docs/`

## Protocolo de Cumplimiento

Cuando trabajes en el proyecto:

1. **Consulta**: Lee `ESTRUCTURA.md` al inicio de cada tarea
2. **Valida**: Verifica que tu acción respeta la estructura
3. **Documenta**: Si necesitas crear una carpeta nueva, actualiza `ESTRUCTURA.md` PRIMERO y consulta al usuario
4. **Reporta**: Si encuentras archivos fuera de lugar, repórtalo al @context-historian para que los mueva

## Agentes con Responsabilidad Especial

- **@context-historian**: Encargado de mantener la estructura limpia y mover archivos mal ubicados
- **@backend-architect**: Debe asegurar que todo código vaya a `/src/`
- **@product-manager**: Debe mantener el backlog en `/docs/PRODUCT_BACKLOG.md`
- **@qa-tester**: Debe documentar pruebas en `/docs/permanente/` o `/docs/sesiones/`

## Consecuencias del Incumplimiento

Violar esta estructura causará:
- Pérdida de contexto para otros agentes
- Dificultad para deployment en Google Apps Script
- Confusión sobre qué archivos son autoritativos
- "Context Rot" y degradación del proyecto

ESTA REGLA ES INVIOLABLE. Si tienes dudas, pregunta al usuario ANTES de crear archivos.
