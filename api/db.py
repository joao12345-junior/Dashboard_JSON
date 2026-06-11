import os
from dotenv import load_dotenv
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extensions import connection as PgConnection

# Carrega o .env
load_dotenv()

# Variaveis do Banco de Dados
db_host = os.getenv("DB_HOST")
db_port = os.getenv("DB_PORT")
db_name = os.getenv("DB_NAME")
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")

pool = ThreadedConnectionPool(minconn=1, maxconn=2, host=db_host,
    port=db_port,
    dbname=db_name,
    user=db_user,
    password=db_password)

def get_connection():
    conn = pool.getconn()
    return conn

def release_connection(conn):
    pool.putconn(conn)