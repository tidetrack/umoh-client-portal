"""Singleton del cliente Supabase para el pipeline UMOH.

Lee SUPABASE_URL y SUPABASE_SERVICE_KEY desde el entorno (.env en local,
GitHub Secrets en Actions). Expone get_client() que devuelve siempre la
misma instancia, evitando reconexiones innecesarias.

Uso típico:
    from data.connections.supabase_client import get_client

    sb = get_client()
    sb.table('leads').select('*').eq('client_slug', 'prepagas').execute()

Variables de entorno requeridas:
    SUPABASE_URL          URL del proyecto (ej: https://piwtcnyoatpeqdimyiaf.supabase.co)
    SUPABASE_SERVICE_KEY  Service role key (escritura completa). NUNCA usar la anon key
                          desde el pipeline — el pipeline necesita bypassar RLS.

NO commitear las credenciales — siempre vía .env (gitignored) o Secrets.
"""

from __future__ import annotations

import os
from typing import Optional

from dotenv import load_dotenv
from supabase import Client, create_client


# Singleton del cliente — se inicializa una sola vez en el primer get_client()
_client: Optional[Client] = None


def _load_env() -> tuple[str, str]:
    """Carga SUPABASE_URL y SUPABASE_SERVICE_KEY del entorno.

    Llama load_dotenv() para soportar archivo .env en desarrollo local.
    En GitHub Actions, las variables ya están en os.environ y load_dotenv
    es no-op si .env no existe.

    Returns:
        Tupla (url, service_key).

    Raises:
        RuntimeError: si alguna variable requerida no está definida.
    """
    load_dotenv()

    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')

    missing = []
    if not url:
        missing.append('SUPABASE_URL')
    if not key:
        missing.append('SUPABASE_SERVICE_KEY')

    if missing:
        raise RuntimeError(
            f"Variables de entorno faltantes: {', '.join(missing)}. "
            "Configurá .env localmente (basado en .env.example) o "
            "GitHub Secrets para el workflow."
        )

    return url, key


def get_client() -> Client:
    """Devuelve la instancia singleton del cliente Supabase.

    Inicializa el cliente la primera vez que se llama. En llamadas posteriores
    devuelve la misma instancia. Thread-safe para el caso de uso típico (un
    pipeline secuencial); si se usa en código concurrente, considerar agregar
    un lock.

    Returns:
        Cliente Supabase autenticado con service_role (full access, bypassa RLS).

    Raises:
        RuntimeError: si SUPABASE_URL o SUPABASE_SERVICE_KEY no están en el entorno.
    """
    global _client
    if _client is None:
        url, key = _load_env()
        _client = create_client(url, key)
    return _client


def reset_client() -> None:
    """Resetea el singleton. Útil para tests o cuando rotan las credenciales.

    En producción no debería llamarse — el cliente se reinicia naturalmente
    cuando se reinicia el proceso del pipeline.
    """
    global _client
    _client = None
