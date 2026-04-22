#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-local.sh — Levanta el entorno local de staging para UMOH Client Portal
#
# Uso:
#   bash ops/testing/test-local.sh            # mock data (default)
#   bash ops/testing/test-local.sh --real     # datos reales via PHP+Sheets
#
# Requisitos:
#   - PHP 8.3 instalado localmente  (php -v para verificar)
#   - Navegador por defecto configurado en macOS
#
# Puerto: 8787 (evita conflictos con :8000/:8080)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DASHBOARD_DIR="$REPO_ROOT/product/dashboard"
API_JS="$DASHBOARD_DIR/assets/js/api.js"
PORT=8787
URL="http://localhost:$PORT"

# ── Colores ──────────────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

log()  { echo -e "${BOLD}[staging]${RESET} $1"; }
ok()   { echo -e "${GREEN}[ok]${RESET} $1"; }
warn() { echo -e "${YELLOW}[warn]${RESET} $1"; }
err()  { echo -e "${RED}[error]${RESET} $1"; exit 1; }

# ── Verificar PHP ─────────────────────────────────────────────────────────────
if ! command -v php &>/dev/null; then
    err "PHP no encontrado. Instalá con: brew install php"
fi
PHP_VER=$(php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;")
log "PHP $PHP_VER detectado"

# ── Modo: mock (default) o real ───────────────────────────────────────────────
MODE="mock"
if [[ "${1:-}" == "--real" ]]; then
    MODE="real"
fi

# ── Configurar USE_MOCK según el modo ────────────────────────────────────────
if [[ "$MODE" == "real" ]]; then
    warn "Modo REAL: apuntando a endpoints PHP + Google Sheets"
    warn "Asegurate de tener .env configurado en product/api/"
    sed -i '' 's/const USE_MOCK = true;/const USE_MOCK = false; \/\/ test-local.sh --real/' "$API_JS"
    log "USE_MOCK → false"
else
    # Asegurar que USE_MOCK esté en true para staging local
    sed -i '' 's/const USE_MOCK = false; \/\/ test-local.sh --real/const USE_MOCK = true;/' "$API_JS" 2>/dev/null || true
    if grep -q "USE_MOCK = false" "$API_JS"; then
        warn "USE_MOCK estaba en false — lo dejamos así (modo real activo)"
        MODE="real-existing"
    else
        ok "USE_MOCK = true (mock data)"
    fi
fi

# ── Verificar si el puerto está ocupado ──────────────────────────────────────
if lsof -i ":$PORT" &>/dev/null; then
    warn "Puerto $PORT ocupado. Matando proceso previo..."
    lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# ── Función de cleanup al salir ──────────────────────────────────────────────
cleanup() {
    echo ""
    log "Deteniendo servidor..."
    # Restaurar USE_MOCK a true si lo cambiamos
    if [[ "$MODE" == "real" ]]; then
        sed -i '' 's/const USE_MOCK = false; \/\/ test-local.sh --real/const USE_MOCK = true;/' "$API_JS" 2>/dev/null || true
        ok "USE_MOCK restaurado → true"
    fi
    kill "$PHP_PID" 2>/dev/null || true
    log "Servidor detenido. Hasta luego."
}
trap cleanup EXIT INT TERM

# ── Iniciar servidor PHP ──────────────────────────────────────────────────────
log "Iniciando PHP built-in server en $URL"
log "Dashboard: $DASHBOARD_DIR"
log "Modo: $MODE"
echo ""

php -S "localhost:$PORT" -t "$DASHBOARD_DIR" &>/tmp/umoh-staging.log &
PHP_PID=$!

# Esperar que levante
sleep 1
if ! kill -0 "$PHP_PID" 2>/dev/null; then
    err "PHP server falló al iniciar. Ver logs en /tmp/umoh-staging.log"
fi

ok "Servidor corriendo (PID $PHP_PID)"

# ── Abrir el browser ─────────────────────────────────────────────────────────
log "Abriendo $URL en el browser..."
open "$URL" 2>/dev/null || warn "No se pudo abrir el browser automáticamente. Navegá a $URL"

echo ""
echo -e "${BOLD}  UMOH Staging Local${RESET}"
echo -e "  URL:   ${GREEN}$URL${RESET}"
echo -e "  Modo:  $MODE"
echo -e "  Logs:  tail -f /tmp/umoh-staging.log"
echo ""
echo -e "  Presioná ${BOLD}Ctrl+C${RESET} para detener el servidor"
echo ""

# ── Tail de logs mientras corre ──────────────────────────────────────────────
wait "$PHP_PID"
