# routes/system_health.py
"""Saude do LogDash: ultimo dado de cada componente. SQL em system_health.py (Repository)."""
import logging
from flask import Blueprint, jsonify
from psycopg2.extras import RealDictCursor
from db import get_connection, release_connection
from routes.auth import require_auth
import system_health

system_health_bp = Blueprint("system_health", __name__)
logger = logging.getLogger(__name__)


@system_health_bp.route("/api/system/health", methods=["GET"])
@require_auth
def get_system_health():
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            snapshot = system_health.fetch_snapshot(cur)
        return jsonify(snapshot), 200
    except Exception as e:
        connection_ok = False
        logger.error(f"[system_health] Erro: {e}")
        return jsonify({"error": "Não foi possível ler a saúde do sistema."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)
