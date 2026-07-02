#api/routes/health.py

from db import get_connection, release_connection
from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)

@health_bp.route("/api/health")
def health_check():
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return jsonify({'Health':'Conexão estável'})
    except Exception as e:
        return jsonify({'Erro': f'Conexão falhou, {e}'}), 500
    finally:
        if conn is not None:
            release_connection(conn)