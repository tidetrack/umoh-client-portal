# Procedimiento de deploy

## Antes de empezar

Verificar:
- `USE_MOCK = false` en `dashboard/assets/js/api.js`
- `PHASE1_BYPASS = false` en `dashboard/auth_check.php` (cuando Fase 4 esté activa)
- Sin `console.log` de debug en JS
- `CHANGELOG.md` actualizado con el cambio

---

## Deploy por FTP

### Credenciales
```
Host:    ftp://147.93.37.161
Usuario: u475803516.umohdasboards
Pass:    (en .env local — nunca commitear)
Ruta:    /prepagas/
```

### Comando base
```bash
curl -T <archivo-local> ftp://147.93.37.161/prepagas/<ruta-remota> \
  --user "u475803516.umohdasboards:PASSWORD" \
  -w "HTTP %{http_code}\n"
```

HTTP 226 = éxito.

### Subir múltiples archivos en paralelo
```bash
BASE="dashboard"
FTP="ftp://147.93.37.161/prepagas"
AUTH="u475803516.umohdasboards:PASSWORD"

curl -s -T "$BASE/index.html"           "$FTP/index.html"           --user "$AUTH" -w "%{filename} → %{http_code}\n" &
curl -s -T "$BASE/assets/css/umoh.css"  "$FTP/assets/css/umoh.css"  --user "$AUTH" -w "%{filename} → %{http_code}\n" &
wait
```

### Crear directorios nuevos
```bash
curl --ftp-create-dirs \
  -T dashboard/assets/img/nuevo.png \
  ftp://147.93.37.161/prepagas/assets/img/nuevo.png \
  --user "u475803516.umohdasboards:PASSWORD"
```

---

## Deploy del pipeline Python

El pipeline corre automáticamente en GitHub Actions. No requiere deploy manual.

Para forzar una ejecución:
1. GitHub → Actions → `Extract All Data` → "Run workflow"

Para actualizar los scripts Python:
1. Modificar `extractors/`, `normalizers/` o `loaders/`
2. Commit + push a `main`
3. El workflow usa siempre la versión de `main`

---

## Verificación post-deploy

1. Abrir `prepagas.umohcrew.com` en browser
2. Verificar que el dashboard carga sin errores de consola
3. Cambiar entre los 3 períodos y las 4 secciones
4. Verificar que los datos se muestran (no pantalla vacía)
