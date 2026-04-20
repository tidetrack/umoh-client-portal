"""
loaders/sheets_writer.py
------------------------
Escribe datos normalizados del schema TOFU canónico en la Google Sheet del cliente.

Responsabilidades:
- Autenticarse con la Service Account de UMOH (GOOGLE_SHEETS_SA_JSON env var).
- Verificar si la pestaña 'tofu_raw' existe; crearla con headers si no existe.
- Leer las fechas ya presentes para hacer upsert (no duplicar en re-ejecuciones).
- Escribir o actualizar las filas del DataFrame normalizado.

La logica de upsert garantiza que si el pipeline corre dos veces en el mismo dia,
los datos se actualizan en lugar de duplicarse. Esto es esencial porque Google Ads
puede consolidar metricas hasta 3 horas despues del evento.

Credenciales esperadas:
  GOOGLE_SHEETS_SA_JSON  (JSON completo de la Service Account, como string)
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import pandas as pd
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# Nombre de la pestaña donde se escriben los datos TOFU en cada Sheet de cliente
TOFU_SHEET_NAME = "tofu_raw"

# Columnas en el orden exacto en que se escriben en la Sheet
# Este orden es el contrato con el dashboard y no puede cambiarse libremente.
TOFU_COLUMNS = [
    "date",
    "platform",
    "impressions",
    "clicks",
    "spend",
    "cpc",
    "top_search_terms",
    "channel_breakdown",
    "device_breakdown",
]

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


# ---------------------------------------------------------------------------
# Autenticacion
# ---------------------------------------------------------------------------

def build_sheets_service() -> Any:
    """
    Construye el cliente de Google Sheets API usando la Service Account.

    La Service Account debe tener rol Editor en la Sheet de cada cliente.
    El JSON completo de credenciales se pasa como string en GOOGLE_SHEETS_SA_JSON.

    Returns:
        Recurso de la Sheets API listo para operar.
    """
    sa_json_str = os.environ["GOOGLE_SHEETS_SA_JSON"]
    sa_info = json.loads(sa_json_str)
    credentials = service_account.Credentials.from_service_account_info(
        sa_info, scopes=_SCOPES
    )
    service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
    return service.spreadsheets()


# ---------------------------------------------------------------------------
# Gestion de la pestaña
# ---------------------------------------------------------------------------

def _ensure_tofu_sheet_exists(sheets: Any, spreadsheet_id: str) -> None:
    """
    Verifica que la pestaña 'tofu_raw' exista en la Sheet del cliente.
    Si no existe, la crea y escribe la fila de headers.

    Args:
        sheets: Recurso spreadsheets() de la Sheets API.
        spreadsheet_id: ID de la Google Sheet del cliente.
    """
    metadata = sheets.get(spreadsheetId=spreadsheet_id).execute()
    existing_sheets = [s["properties"]["title"] for s in metadata.get("sheets", [])]

    if TOFU_SHEET_NAME in existing_sheets:
        logger.debug("Pestaña '%s' ya existe en sheet=%s.", TOFU_SHEET_NAME, spreadsheet_id)
        return

    logger.info(
        "Pestaña '%s' no existe en sheet=%s. Creando...",
        TOFU_SHEET_NAME,
        spreadsheet_id,
    )
    body = {
        "requests": [{
            "addSheet": {
                "properties": {"title": TOFU_SHEET_NAME}
            }
        }]
    }
    sheets.batchUpdate(spreadsheetId=spreadsheet_id, body=body).execute()

    # Escribir headers
    headers = [TOFU_COLUMNS]
    sheets.values().update(
        spreadsheetId=spreadsheet_id,
        range=f"{TOFU_SHEET_NAME}!A1",
        valueInputOption="RAW",
        body={"values": headers},
    ).execute()
    logger.info("Headers escritos en pestaña '%s'.", TOFU_SHEET_NAME)


def _get_existing_dates(sheets: Any, spreadsheet_id: str) -> dict[str, int]:
    """
    Lee las fechas ya presentes en la pestaña tofu_raw para implementar el upsert.

    Retorna un dict {date_str: row_index_1based} donde row_index es la fila en
    la Sheet (contando desde 1, con la fila 1 siendo los headers).

    Args:
        sheets: Recurso spreadsheets() de la Sheets API.
        spreadsheet_id: ID de la Sheet.

    Returns:
        Dict mapeando fecha YYYY-MM-DD al numero de fila (1-based) en la Sheet.
    """
    result = sheets.values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{TOFU_SHEET_NAME}!A:A",  # Solo la columna de fechas
    ).execute()

    values = result.get("values", [])
    date_to_row: dict[str, int] = {}

    for i, row in enumerate(values):
        if i == 0:
            continue  # Fila de headers
        if row and row[0]:
            date_to_row[row[0]] = i + 1  # i+1 porque Sheets es 1-based

    return date_to_row


# ---------------------------------------------------------------------------
# Escritura con upsert
# ---------------------------------------------------------------------------

def write_tofu(df: pd.DataFrame, spreadsheet_id: str) -> None:
    """
    Escribe (o actualiza) las filas del DataFrame en la pestaña tofu_raw.

    Para cada fila del DataFrame:
    - Si la fecha ya existe en la Sheet → actualiza la fila existente.
    - Si la fecha no existe → la agrega al final.

    Esto garantiza idempotencia: correr el pipeline dos veces en el mismo dia
    produce el mismo resultado que correrlo una sola vez.

    Args:
        df: DataFrame con el schema TOFU canónico (output de normalizers/canonical.py).
        spreadsheet_id: ID de la Google Sheet del cliente.
    """
    if df.empty:
        logger.warning(
            "DataFrame vacio recibido para sheet=%s. No hay nada que escribir.",
            spreadsheet_id,
        )
        return

    sheets = build_sheets_service()
    _ensure_tofu_sheet_exists(sheets, spreadsheet_id)
    existing_dates = _get_existing_dates(sheets, spreadsheet_id)

    updates: list[dict] = []   # Filas a actualizar (ya existen en la Sheet)
    appends: list[list] = []   # Filas nuevas a agregar al final

    for _, row in df.iterrows():
        date_str = str(row["date"])
        values = [str(row.get(col, "")) for col in TOFU_COLUMNS]

        if date_str in existing_dates:
            row_num = existing_dates[date_str]
            updates.append({
                "range": f"{TOFU_SHEET_NAME}!A{row_num}",
                "values": [values],
            })
        else:
            appends.append(values)

    # Ejecutar updates (filas existentes)
    if updates:
        sheets.values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "valueInputOption": "RAW",
                "data": updates,
            },
        ).execute()
        logger.info(
            "Actualizadas %d filas existentes en sheet=%s.",
            len(updates),
            spreadsheet_id,
        )

    # Ejecutar appends (filas nuevas)
    if appends:
        sheets.values().append(
            spreadsheetId=spreadsheet_id,
            range=f"{TOFU_SHEET_NAME}!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": appends},
        ).execute()
        logger.info(
            "Agregadas %d filas nuevas en sheet=%s.",
            len(appends),
            spreadsheet_id,
        )


def write_normalized_data(df: pd.DataFrame) -> None:
    """
    Wrapper de alto nivel: toma el DataFrame del normalizador (que incluye
    la columna sheets_output_id) y lo enruta a la Sheet correcta.

    Esta es la funcion que llama el workflow de GitHub Actions.

    Args:
        df: DataFrame con schema TOFU canónico + columnas client_id y sheets_output_id.
    """
    if "sheets_output_id" not in df.columns:
        raise ValueError(
            "El DataFrame no tiene la columna 'sheets_output_id'. "
            "Verificar que el normalizador la este incluyendo."
        )

    # Agrupar por Sheet (puede haber multiples clientes en el mismo DataFrame
    # si el pipeline procesa varios a la vez)
    for sheets_id, group_df in df.groupby("sheets_output_id"):
        if not sheets_id or str(sheets_id).startswith("REEMPLAZAR"):
            logger.warning(
                "sheets_output_id no configurado para client_id=%s. Se omite.",
                group_df["client_id"].iloc[0] if "client_id" in group_df.columns else "desconocido",
            )
            continue

        try:
            write_tofu(group_df, str(sheets_id))
        except HttpError as e:
            logger.error(
                "Error HTTP al escribir en sheet=%s: %s. "
                "Verificar que la Service Account tenga acceso a esta Sheet.",
                sheets_id,
                e,
            )
            raise
