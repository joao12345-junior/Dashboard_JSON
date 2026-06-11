# ingestor/adapters/PostgresRepository.py

from psycopg2.extensions import connection as PgConnection
from ports.ILogRepository import ILogRepository

class PostgresRepository(ILogRepository):
    """
    Adapter: implementa ILogRepository gravando em process_logs
    no PostgreSQL.

    Recebe a conexão já aberta — mesma conexão compartilhada
    com o PostgresRunLogger (Unit of Work).
    """

    def __init__(self, conn: PgConnection) -> None:
        self._conn = conn
    
    def already_processed(self, source_file: str) -> bool:
        """
        Verifica se algum registro com esse source_name já existe.
        Retorna True se o arquivo já foi processado.
        """
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT 1 FROM optsislog.process_logs
                WHERE source_name = %s
                LIMIT 1
                """, (source_file,),
            )
            return cur.fetchone() is not None
        
    def save(self, records: list[dict], run_id: int, source_file: str | None = None) -> int:
        """
        Grava os registros em process_logs em lote.
        Retorna quantos registros foram inseridos.

        ON CONFLICT DO NOTHING: se um registro já existir,
        ignora silenciosamente sem derrubar o lote inteiro.
        """
        if not records: 
            return 0
        
        inserted = 0

        with self._conn.cursor() as cur:
            for record in records:
                try:
                    cur.execute("""SAVEPOINT sp""")
                    cur.execute(
                        """
                        INSERT INTO optsislog.process_logs (message, log_date, log_time, start, source_name, run_id)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            record['message'],
                            record['log_date'],
                            record['log_time'],
                            record['start'],
                            record['source_name'],
                            run_id
                        ),
                    )
                    inserted += 1
                except Exception as e:
                    cur.execute("""ROLLBACK TO SAVEPOINT sp""")
                    # Um registro inválido não derruba os outros
                    print(f"[WARN] Registro ignorado: {e}")
        self._conn.commit()
        return inserted