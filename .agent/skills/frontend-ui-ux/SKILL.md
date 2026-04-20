---
name: appscript-ui
description: Especialista en UI/UX dentro del contexto de Google Apps Script (HtmlService). Diseña popups (showModalDialog), mantiene el Design System en UI_SharedStyles.html, y garantiza la comunicación correcta entre HTML y backend via google.script.run.
---

# AppScript UI — Especialista en Frontend Google Apps Script

## Cuándo usar este skill
- Cuando haya que crear o modificar un archivo `.html` en `src/`.
- Cuando haya que diseñar un nuevo formulario, popup o panel visual.
- Cuando haya que integrar la comunicación `google.script.run` desde el HTML.
- Cuando el Design System (`UI_SharedStyles.html`) necesite ajustes de color, tipografía o componentes.
- Cuando haya bugs visuales o de comportamiento en los popups.

## Contexto del Stack Técnico
- **Entorno**: Google Apps Script HtmlService — NO es un browser normal.
- **Restricción crítica**: No hay routing, no hay imports de módulos, no hay React/Vue.
- **CSS compartido**: Todo el Design System vive en `UI_SharedStyles.html`, se inyecta con `<?!= include('UI_SharedStyles'); ?>`.
- **Comunicación backend**: Solo via `google.script.run.withSuccessHandler(fn).withFailureHandler(fn).funcionBackend()`.
- **Apertura de popups**: `SpreadsheetApp.getUi().showModalDialog(html, 'Título')` desde el backend.

## Design System de Tidetrack (Respetar siempre)
```css
/* Variables Core */
--primary-color: #34475d;
--bg-main: #eff2f9;
--font-family: 'Google Sans', 'Roboto', sans-serif;
--border-radius-md: 8px;
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
```

**Componentes disponibles en `UI_SharedStyles.html`:**
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-selected`
- `.form-group`, `.form-label`, `.form-input`, `.form-select`
- `.card`, `.container`, `.container-xs`
- `.hidden` (clase utilitaria para mostrar/ocultar)

## Workflow

### Fase 1: Diseñar el layout
1. Definir el tamaño del modal (ancho × alto recomendado: 520×750 px).
2. Listar los elementos visuales necesarios: header, formulario, éxito/error state.
3. Decidir qué campos son dinámicos (mostrados/ocultados con JS).

### Fase 2: Implementar el HTML
4. Siempre empezar con el boilerplate:
 ```html
 <!DOCTYPE html>
 <html>
 <head>
 <base target="_top">
 <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap" rel="stylesheet">
 <?!= include('UI_SharedStyles'); ?>
 <style>/* Estilos específicos del popup */</style>
 </head>
 <body>
 ```
5. Un único archivo HTML por popup. CSS y JS embebidos (restricción de Apps Script).

### Fase 3: Conectar con backend
6. Siempre usar `withSuccessHandler` + `withFailureHandler`.
7. El handler de error siempre debe mostrar feedback visual (nunca `alert()` nativo).
8. Al cargar datos iniciales, mostrar un spinner (`loading-overlay`) mientras llega la respuesta.

## Instrucciones
- **No usar librerías externas** (jQuery, Bootstrap, etc.) — Apps Script tiene restricciones de seguridad.
- **Manejar siempre el estado de carga** (loading) y error visual.
- **El `google.script.host.close()`** es la única forma de cerrar el modal desde el HTML.
- Los formularios deben tener `id` únicos y descriptivos para facilitar el testing.
- Toda acción destructiva (borrar) debe pedir confirmación visual al usuario.

## Output (formato exacto)
```markdown
## UI Implementada

### Archivo(s) modificados
- `src/[ARCHIVO].html`: [qué se hizo]

### Componentes utilizados
- [lista de clases del Design System utilizadas]

### Contratos con el backend
- `google.script.run.funcionBackend(payload)` → `{ success: true }`

### Próximo paso recomendado
[auto-changelog → github-sync]
```
