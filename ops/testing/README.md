# Testing — UMOH Client Portal

Guía de entornos de prueba, datos mock y procedimientos de validación antes de deploy.

---

## Entornos disponibles

| Entorno | Cómo activarlo | Datos | Autenticación |
|---------|---------------|-------|--------------|
| Local mock | `USE_MOCK=true` en `api.js` | `mockdata.js` | `PHASE1_BYPASS=true` |
| Local real | `USE_MOCK=false` + PHP local | Sheets reales | `PHASE1_BYPASS=true` |
| Producción | `USE_MOCK=false` en servidor | Sheets reales | Login real (Fase 4) |

---

## Activar entorno de desarrollo local

**1. Mock data (recomendado para UI/frontend):**
```javascript
// dashboard/assets/js/api.js
const USE_MOCK = true;
```

**2. Auth bypass (sin pantalla de login):**
```php
// dashboard/auth_check.php
define('PHASE1_BYPASS', true);
```

Abrir `dashboard/index.html` con Live Server en VS Code.

---

## Mock data

`dashboard/assets/js/mockdata.js` contiene datos realistas para los 3 períodos (7d, 30d, 90d) y los 4 endpoints (summary, tofu, mofu, bofu).

Los datos mock siguen el mismo schema que los endpoints PHP reales. Si se cambia el schema en `api/lib/config.php`, actualizar también `mockdata.js`.

---

## Checklist de validación antes de deploy

### Visual
- [ ] Dashboard carga sin errores en consola
- [ ] Los 4 tabs (Performance, TOFU, MOFU, BOFU) renderizan correctamente
- [ ] Los gráficos muestran datos en los 3 períodos (7d, 30d, 90d)
- [ ] El date picker custom funciona
- [ ] Los KPI modals abren y cierran correctamente
- [ ] El user menu hover/click funciona sin bugs
- [ ] Dark mode y light mode funcionan
- [ ] Login page carga con planetas animados y favicon
- [ ] Responsive: verificar en viewport 390px (iPhone 14 Pro Max)

### Funcional
- [ ] `USE_MOCK = false` en `api.js` antes de subir
- [ ] Los endpoints PHP responden con JSON válido
- [ ] El período de filtrado retorna el rango correcto de fechas
- [ ] La autenticación redirige correctamente al login

### Seguridad
- [ ] Sin credenciales hardcodeadas en JS ni PHP
- [ ] `PHASE1_BYPASS = false` (cuando Fase 4 esté activa)
- [ ] `.env` no incluido en el commit
