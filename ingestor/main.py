# ingestor/main.py

import json
import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

from adapters.PostgresRunLogger import PostgresRunLogger
from adapters.PostgresRepository import PostgresRepository
from adapters.ProcessJsonSource import ProcessJsonSource
from log_ingestor import LogIngestor

def main():
    
    # Carrega o arquivo config.json
    with open("config.json", encoding='utf-8') as f:
        try:
            config = json.load(f)
        except Exception as e:
            return print(f"Erro ao fazer a leitura do config.json, {e}")
        
    try:
        conn = connection()
    except Exception as e:
        return print(f"Erro ao conectar ao banco: {e}")

    # Variaveis do config.json
    folder_path = config['sources']['process_logs']['folder_path']
    source_host = config['sources']['process_logs']['source_host']
    source_type = config['sources']['process_logs']['source_type']

    # Variaveis dos adapter
    repository = PostgresRepository(conn=conn)
    source = ProcessJsonSource(folder_path=folder_path)
    run_logger=PostgresRunLogger(conn=conn)
    
    # Variavel do ingestor
    ingestor = LogIngestor(
        source_type=source_type,
        log_repository=repository,
        run_logger=run_logger,
        log_source=source,
        source_host=source_host,
        folder_path=folder_path,  # ← adicionar
    )

    ingestor.run()

    conn.close()
    
def connection():

    # Carrega o .env
    load_dotenv()

    # Variaveis do Banco de Dados
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")

    conn = psycopg2.connect(
        host=db_host,
        port=db_port,
        dbname=db_name,
        user=db_user,
        password=db_password
    )
    return conn

if __name__ == "__main__":
    main()