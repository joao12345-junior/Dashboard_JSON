import os
from dotenv import load_dotenv
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extensions import connection as PgConnection

load_dotenv()

db_host = os.getenv("DB_HOST")
db_port = os.getenv("DB_PORT")
db_name = os.getenv("DB_NAME")
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_sslmode = os.getenv("DB_SSLMODE", "require")

pool = ThreadedConnectionPool(
    minconn=1,
    maxconn=5,
    host=db_host,
    port=db_port,
    dbname=db_name,
    user=db_user,
    password=db_password,
    sslmode=db_sslmode
)

def get_connection() -> PgConnection:
    return pool.getconn()

def release_connection(conn: PgConnection) -> None:
    pool.putconn(conn)