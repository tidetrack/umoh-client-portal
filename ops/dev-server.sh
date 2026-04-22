#!/bin/bash
# Dev server local para umoh-client-portal
# Uso: ./ops/dev-server.sh
# Acceso: http://localhost:8080
# Login: admin / umoh_dev_2026

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASHBOARD="$REPO_ROOT/product/dashboard"

echo "────────────────────────────────────────"
echo " UMOH Client Portal — Dev Server"
echo " http://localhost:8080"
echo " Login: admin / umoh_dev_2026"
echo "────────────────────────────────────────"

php -S localhost:8080 -t "$DASHBOARD"
