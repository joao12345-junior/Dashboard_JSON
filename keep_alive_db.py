# keep_alive_db.py
# Mantém o compute do Neon ativo com uma query leve periódica.
# Mesma estrutura de logging do keep_alive_db.ps1, adaptada para Python.

import os
import sys
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
import psycopg2

LOG_DIR = Path(__file__).parent
LOG_FILE = LOG_DIR / "keep_alive_log.txt"

# Aponta explicitamente pro .env dentro de api/, já que este script roda da raiz
env_path = Path(__file__).parent / "api" / ".env"
load_dotenv(dotenv_path=env_path)


def write_keep_alive_log(message: str) -> None:
    """Escreve no console e no arquivo de log, mesmo padrão do Write-KeepAlive-Log do .ps1."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"{timestamp} - {message}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def keep_alive() -> None:
    write_keep_alive_log("========================================")
    write_keep_alive_log("Iniciando keep-alive...")
    write_keep_alive_log(f"Python version: {sys.version.split()[0]}")
    write_keep_alive_log(f"User: {os.getenv('USERNAME', 'desconhecido')}")
    write_keep_alive_log(f"Log file: {LOG_FILE}")

    conn = None
    try:
        write_keep_alive_log("Executando query de keep-alive...")
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            sslmode=os.getenv("DB_SSLMODE", "require"),
            connect_timeout=10,
        )
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
        write_keep_alive_log("Keep-alive OK")
    except Exception as e:
        write_keep_alive_log(f"Keep-alive FALHOU: {e}")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    keep_alive()