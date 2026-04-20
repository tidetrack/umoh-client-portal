# Criterios de Vinculación y Salud de Apps Script

Esta regla define los parámetros que DEBEN verificarse para considerar que un proyecto de Google Apps Script está correctamente vinculado al entorno de código local.

## Verificaciones Obligatorias

1. **Configuración de Clasp (`.clasp.json`)**:
   - Debe existir en la raíz del proyecto.
   - Debe contener un `scriptId` válido apuntando al proyecto correcto.
   - El `rootDir` debe estar configurado para apuntar a `src/`.

2. **Manifiesto (`appsscript.json`)**:
   - Debe existir en `src/appsscript.json`.
   - Las scopes requeridas de OAuth y configuraciones de zona horaria deben ser correctas.

3. **Comunicación Frontend-Backend**:
   - Cualquier intento de invocar funciones en el servidor desde HTML (`google.script.run`) debe coincidir EXACTAMENTE con funciones globales declaradas y exportadas en los `.js` del backend. Ninguna macro de interfaz debe apuntar a una función inexistente.

4. **Configuración Global (`00_Config.js` o similar)**:
   - Todos los nombres de hojas (`sheet names`) o rangos fijos declarados en la constante de configuración deben existir y coincidir en la Planilla de Google Sheets asociada. Errores de `Sheet not found` son el principal indicador de que la vinculación está rota.

5. **Lógica de Autenticación / UI**:
   - Las funciones que sirven el HTML (e.g., `doGet` o funciones para menús custom/modales) deben invocar y evaluar los templates (usando `HtmlService.createTemplateFromFile`) correctamente, previendo la inclusión de los parciales en Apps Script.
