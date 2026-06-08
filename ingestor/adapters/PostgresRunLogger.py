# ingestor/adapters/PostgresRunLogger.py

import psycopg2
from psycopg2.extensions import connection as PgConnection
from ports.IRunLogger import IRunLogger

class PostgresRunLogger(IRunLogger):
    """
    Adapter: implementa IRunLogger gravando em ingestion_runs no PostgreSQL.

    Recebe a conexão já aberta — não abre nem fecha conexão aqui.
    Por quê? Porque conexão é um recurso caro. O log_ingestor.py
    abre uma conexão e passa para todos os adapters. Centralizar
    o controle da conexão em um lugar só é mais seguro.
    """

    def __init__(self, conn: PgConnection) -> None:
        self._conn = conn

    def start_run(self, source_type: str, source_host: str | None = None) -> int:
        """
        Insere um registro em ingestion_runs com status='running'.
        Retorna o ID gerado pelo banco (BIGSERIAL).
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO optsislog.ingestion_runs (source_type, source_host)
                VALUES (%s, %s)
                RETURNING id
                """, (source_type, source_host)
            )
            # fetchone() pega a primeira (e única) linha retornada
            # o [0] pega o primeiro campo dessa linha — o id
            run_id: int = cur.fetchone()[0]
        self._conn.commit()
        return run_id
    
    def finish_run(self, run_id: int, files_processed: int, files_failed: int, records_inserted: int, error_message: str | None = None) -> None:
        """
        Chama a função finish_ingestion_run() que já existe no banco.
        A lógica de status (success/partial/failed) fica no PostgreSQL.
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT optsislog.finish_ingestion_run(%s, %s, %s, %s, %s)
                """, (run_id, files_processed, files_failed, records_inserted, error_message)
            )
        self._conn.commit()