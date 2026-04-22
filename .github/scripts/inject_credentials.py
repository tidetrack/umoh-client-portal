#!/usr/bin/env python3
"""
Genera credentials.php a partir del template, inyectando los hashes
desde variables de entorno ADMIN_HASH y PREPAGAS_HASH.

Uso: python3 inject_credentials.py <build_dir>
  build_dir: directorio que contiene config/credentials.template.php
"""
import os
import sys

build_dir = sys.argv[1].rstrip("/")
template_path = f"{build_dir}/config/credentials.template.php"
output_path   = f"{build_dir}/config/credentials.php"

admin_hash    = os.environ.get("ADMIN_HASH", "").strip()
prepagas_hash = os.environ.get("PREPAGAS_HASH", "").strip()

if not admin_hash or not prepagas_hash:
    sys.exit("ERROR: ADMIN_HASH o PREPAGAS_HASH están vacíos — verificar GitHub Secrets")

with open(template_path) as f:
    content = f.read()

content = content.replace("ADMIN_HASH_PLACEHOLDER",    admin_hash)
content = content.replace("PREPAGAS_HASH_PLACEHOLDER", prepagas_hash)

if "PLACEHOLDER" in content:
    sys.exit("ERROR: no se reemplazaron todos los placeholders")

with open(output_path, "w") as f:
    f.write(content)

print(f"credentials.php generado en {output_path}")
