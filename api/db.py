# api/db.py
import os
import logging
from dotenv import load_dotenv
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extensions import connection as PgConnection

load_dotenv()

logger = logging.getLogger(__name__)

db_host = os.getenv("DB_HOST")
db_port = os.getenv("DB_PORT")
db_name = os.getenv("DB_NAME")
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_sslmode = os.getenv("DB_SSLMODE", "require")

pool = ThreadedConnectionPool(
    minconn=2,
    maxconn=15,
    host=db_host,
    port=db_port,
    dbname=db_name,
    user=db_user,
    password=db_password,
    sslmode=db_sslmode
)

def _is_connection_alive(conn: PgConnection) -> bool:
    """
    Testa se a conexão ainda está viva no lado do servidor.
    Necessário porque o Neon suspende o compute por ociosidade e mata
    conexões do lado do servidor sem avisar o pool local.
    """
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return True
    except Exception:
        return False

def get_connection() -> PgConnection:
    """
    Retorna uma conexão saudável do pool.
    Se a conexão obtida estiver morta (ex: cold start do Neon), descarta
    e tenta novamente até esgotar o pool de conexões disponíveis.
    """
    attempts = pool.maxconn
    last_error: Exception | None = None

    for _ in range(attempts):
        conn = pool.getconn()

        if _is_connection_alive(conn):
            return conn

        logger.warning("Conexão morta detectada no pool, descartando e tentando novamente")
        try:
            pool.putconn(conn, close=True)
        except Exception as e:
            last_error = e

    raise RuntimeError(f"Não foi possível obter conexão saudável do pool: {last_error}")

def release_connection(conn: PgConnection, *, is_healthy: bool = True) -> None:
    """
    Devolve a conexão ao pool.
    is_healthy=False força o descarte da conexão em vez de reciclá-la —
    use isso quando uma exceção ocorreu durante o uso da conexão.
    """
    pool.putconn(conn, close=not is_healthy)