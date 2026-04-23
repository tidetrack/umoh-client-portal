#!/usr/bin/env python3
"""
Genera credentials.php a partir del template, inyectando los hashes
desde variables de entorno ADMIN_HASH y PREPAGAS_HASH.

También inyecta ASSET_VERSION (SHA corto del commit de GitHub Actions)
en index.php para forzar cache-busting automático de JS/CSS en cada deploy.

Uso: python3 inject_credentials.py <build_dir>
  build_dir: directorio que contiene config/credentials.template.php e index.php
"""
import os
import re
import sys

build_dir = sys.argv[1].rstrip("/")
template_path = f"{build_dir}/config/credentials.template.php"
output_path   = f"{build_dir}/config/credentials.php"
index_path    = f"{build_dir}/index.php"

admin_hash    = os.environ.get("ADMIN_HASH", "").strip()
prepagas_hash = os.environ.get("PREPAGAS_HASH", "").strip()
# GITHUB_SHA está disponible automáticamente en todos los runners de GitHub Actions
asset_version = os.environ.get("GITHUB_SHA", "")[:7] or "local"

if not admin_hash or not prepagas_hash:
    sys.exit("ERROR: ADMIN_HASH o PREPAGAS_HASH están vacíos — verificar GitHub Secrets")

# ── credentials.php ──────────────────────────────────────────────────────────
with open(template_path) as f:
    content = f.read()

content = content.replace("ADMIN_HASH_PLACEHOLDER",    admin_hash)
content = content.replace("PREPAGAS_HASH_PLACEHOLDER", prepagas_hash)

if "PLACEHOLDER" in content:
    sys.exit("ERROR: no se reemplazaron todos los placeholders")

with open(output_path, "w") as f:
    f.write(content)

print(f"credentials.php generado en {output_path}")

# ── cache-busting: inyectar ASSET_VERSION en index.php ───────────────────────
if os.path.exists(index_path):
    with open(index_path) as f:
        idx = f.read()

    # Reemplaza la línea de fallback por una constante con el SHA real
    idx = re.sub(
        r"\$_asset_v = defined\('ASSET_VERSION'\).*?filemtime\(__DIR__.*?\);",
        f"$_asset_v = '{asset_version}';",
        idx,
        flags=re.DOTALL,
    )

    with open(index_path, "w") as f:
        f.write(idx)

    print(f"index.php: ASSET_VERSION={asset_version} inyectado")
else:
    print(f"WARN: {index_path} no encontrado — cache-busting no aplicado")
