"""
Runner simples de migrations SQL sequenciais.

Rastreia o que já rodou numa tabela de controle (schema_migrations) pra não
reaplicar migration já executada. Não faz rollback automático — se uma
migration falhar no meio, o erro é reportado e a execução para; a correção
é manual (o operador decide se corrige o dado ou o SQL e roda de novo).
"""
import os
import subprocess
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

MIGRATIONS_DIR = Path(__file__).parent
load_dotenv(MIGRATIONS_DIR.parent / ".env")


def get_conn_kwargs() -> dict:
    return {
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
        "dbname": os.getenv("DB_NAME"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "sslmode": os.getenv("DB_SSLMODE", "require"),
    }


def get_connection(conn_kwargs: dict):
    return psycopg2.connect(**conn_kwargs)


def ensure_control_table(conn) -> None:
    with conn.cursor() as cur:
        # O schema optsislog precisa existir ANTES da tabela de controle.
        # Na Neon isso nunca foi um problema porque o schema já existia
        # (criado a mão, antes deste runner existir). Em um banco novo
        # e vazio (ex: bootstrap em outro provedor) essa etapa manual
        # nunca aconteceu — então garantimos aqui, de forma idempotente.
        cur.execute("CREATE SCHEMA IF NOT EXISTS optsislog")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS optsislog.schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    conn.commit()


def get_applied_migrations(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM optsislog.schema_migrations")
        return {row[0] for row in cur.fetchall()}


def get_pending_migrations(applied: set[str]) -> list[Path]:
    all_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    return [f for f in all_files if f.name not in applied]


def apply_migration(conn, filepath: Path) -> None:
    sql = filepath.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            "INSERT INTO optsislog.schema_migrations (filename) VALUES (%s)",
            (filepath.name,),
        )
    conn.commit()


def dump_schema(conn_kwargs: dict) -> None:
    """
    Gera um dump do schema (sem dados) logo depois das migrations rodarem,
    pra schema.sql nunca ficar defasado em relacao ao que esta aplicado de
    verdade no banco. Nao falha a execucao se o pg_dump nao estiver
    disponivel na maquina -- so avisa; aplicar a migration e o que importa,
    o dump e conveniencia.
    """
    schema_file = MIGRATIONS_DIR / "schema.sql"
    env = os.environ.copy()
    env["PGPASSWORD"] = conn_kwargs["password"] or ""
    cmd = [
        "pg_dump",
        "--schema-only",
        "-h", conn_kwargs["host"],
        "-p", str(conn_kwargs["port"]),
        "-U", conn_kwargs["user"],
        "-d", conn_kwargs["dbname"],
    ]
    try:
        result = subprocess.run(
            cmd, env=env, capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            print(f"AVISO: pg_dump falhou ({result.returncode}): {result.stderr.strip()}")
            return
        schema_file.write_text(result.stdout, encoding="utf-8")
        print(f"Schema atualizado em {schema_file.relative_to(MIGRATIONS_DIR.parent.parent)}")
    except FileNotFoundError:
        print(
            "AVISO: pg_dump nao encontrado no PATH -- schema.sql nao foi atualizado. "
            "Instale o PostgreSQL Command Line Tools nesta maquina pra manter o dump em dia."
        )
    except subprocess.TimeoutExpired:
        print("AVISO: pg_dump demorou demais e foi cancelado -- schema.sql nao foi atualizado.")


def main() -> int:
    conn_kwargs = get_conn_kwargs()
    conn = get_connection(conn_kwargs)
    try:
        ensure_control_table(conn)
        applied = get_applied_migrations(conn)
        pending = get_pending_migrations(applied)

        if not pending:
            print("Nenhuma migration pendente.")
            dump_schema(conn_kwargs)
            return 0

        for filepath in pending:
            print(f"Aplicando {filepath.name}...")
            try:
                apply_migration(conn, filepath)
                print(f"  OK: {filepath.name}")
            except Exception as e:
                conn.rollback()
                print(f"  ERRO em {filepath.name}: {e}")
                print("Execução interrompida. Corrija antes de rodar de novo.")
                return 1

        print(f"{len(pending)} migration(s) aplicada(s) com sucesso.")
        dump_schema(conn_kwargs)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())