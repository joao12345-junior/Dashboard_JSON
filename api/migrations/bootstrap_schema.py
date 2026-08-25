"""
Cria o schema optsislog isoladamente, antes do run_migration.py rodar.
Necessario porque ensure_control_table() espera que o schema ja exista
(na Neon ele foi criado a mao, antes do runner existir -- banco novo
na KingHost nao tem essa etapa manual anterior).
"""
import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

MIGRATIONS_DIR = Path(__file__).parent
load_dotenv(MIGRATIONS_DIR.parent / ".env")

conn = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    sslmode=os.getenv("DB_SSLMODE", "prefer"),
)
with conn.cursor() as cur:
    cur.execute("CREATE SCHEMA IF NOT EXISTS optsislog")
conn.commit()
conn.close()
print("OK: schema optsislog criado (ou ja existia).")
