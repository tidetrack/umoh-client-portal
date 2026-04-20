---
name: appscript-backend
description: Experto en Google Apps Script para Tidetrack. Diseña e implementa servicios de backend (SheetManager, UIService, MenuService) respetando la arquitectura modular, las ADRs vigentes y el stack de rangos fijos definido en 00_Config.js.
---

# AppScript Backend — Experto en Google Apps Script

## Cuándo usar este skill
- Cuando haya que crear o modificar un archivo `.js` dentro de `src/`.
- Cuando haya que agregar un nuevo módulo o servicio al sistema.
- Cuando haya que leer, escribir, actualizar o eliminar datos de Google Sheets.
- Cuando haya que crear un nuevo trigger, menú o función expuesta al usuario.
- Cuando se necesite conectar el backend con el frontend HTML (via `google.script.run`).

## Contexto del Stack Técnico
- **Entorno**: Google Apps Script (V8 runtime)
- **Sincronización local**: `clasp` via `npm run watch` o `npm run push`
- **Estructura de archivos**: Numerados `XX_NombreServicio.js` para garantizar orden de carga
- **Base de datos**: Google Sheets con rangos fijos definidos en `RANGES` (ver `00_Config.js`)
- **Acceso a datos**: Siempre a través de `03_SheetManager.js` (nunca acceso directo a rangos raw)
- **Frontend**: HTML files con `HtmlService`, comunicación via `google.script.run`

## ADRs Vigentes (Respetar siempre)
- **ADR-001**: Rangos de columnas son FIJOS. Nunca hardcodear letras de columna fuera de `00_Config.js`.
- **ADR-002**: Moneda no es obligatoria en el formulario (principio de moneda por defecto).
- **ADR-003**: Las monedas (`MONEDAS_DISPONIBLES`) son constantes de backend, no tabla de BD.

## Workflow

### Fase 1: Entender antes de tocar
1. Leer `00_Config.js` para entender los rangos y constantes disponibles.
2. Identificar qué tabla(s) de `RANGES` están involucradas.
3. Revisar si ya existe una función similar en `03_SheetManager.js` o `11_UIService.js`.

### Fase 2: Implementar respetando la arquitectura por capas
```
00_Config.js → Solo constantes y configuración
02_Utils.js → Solo logError, logInfo, logSuccess
03_SheetManager.js → Solo acceso a datos (CRUD sobre rangos fijos)
11_UIService.js → Solo API entre HTML y backend
12_MenuService.js → Solo construcción del menú nativo
13_NavigationService.js → Solo navegación entre hojas
```
**Regla de oro**: Nunca mezclar responsabilidades entre capas.

### Fase 3: Validar Lean antes de entregar
- ¿Hay alguna función que se declara pero no se invoca?
- ¿Hay algún parámetro que no se usa?
- ¿Se puede simplificar algún bloque `if/else` complejo?

## Instrucciones
- **Siempre usar `logError`/`logSuccess`** de `02_Utils.js` para trazabilidad.
- **Nunca usar `SpreadsheetApp.getActiveSpreadsheet()` fuera de `03_SheetManager.js`**.
- Los mensajes de error deben ser legibles para el usuario final (no errores técnicos crudos).
- Al agregar una función que el HTML invoca via `google.script.run`, documenta el contrato (parámetros y respuesta) con un JSDoc claro.
- Al crear un nuevo archivo `.js`, asignarlo al número de orden correcto y agregarlo a `ZZ_Changelog.js` vía `auto-changelog`.

## Output (formato exacto)
```markdown
## ️ Backend Implementado

### Cambios en `src/`
- **[ARCHIVO]**: [qué se hizo]
- **[ARCHIVO]**: [qué se hizo]

### Contrato de la nueva función
```js
// Nombre: functionName(params)
// Retorna: { success: true, data: [...] } | throws Error
```

### Próximo paso recomendado
[Indicar si se necesita también trabajo en `appscript-ui` o si está lista para `auto-changelog`]
```
