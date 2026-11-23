# api/collector/db_config.py
"""Configuracao de conexao com o banco para os processos do coletor (api/.env)."""
from __future__ import annotations

import os
from pathlib import Path


def connection_kwargs() -> dict:
    """
    Argumentos de psycopg2.connect lidos de api/.env (o mesmo arquivo da API Flask).
    O coletor roda com cwd em api/, mas ancorar no arquivo evita depender disso.
    """
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
    return {
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
        "dbname": os.getenv("DB_NAME"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "sslmode": os.getenv("DB_SSLMODE", "require"),
        "connect_timeout": 10,
    }
