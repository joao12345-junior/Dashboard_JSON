# routes/app_programs.py
"""
Programas dos Logs Gerais: listar, mudar visibilidade e apagar os logs de um programa.
Todo o SQL esta em program_registry.py (Repository); aqui so' HTTP.
"""
import logging
from flask import Blueprint, jsonify, request
from psycopg2.extras import RealDictCursor
from db import get_connection, release_connection
from routes.auth import require_auth, current_username
import program_registry as registry

app_programs_bp = Blueprint("app_programs", __name__)
logger = logging.getLogger(__name__)


@app_programs_bp.route("/api/app-programs", methods=["GET"])
@require_auth
def get_app_programs():
    """Lista todos os programas com visibilidade, ultimo log e contadores."""
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            programs = registry.list_programs(cur)
        return jsonify({"programs": programs}), 200
    except Exception as e:
        connection_ok = False
        logger.error(f"[app_programs] Erro ao listar: {e}")
        return jsonify({"error": "Não foi possível buscar os programas."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@app_programs_bp.route("/api/app-programs/visibility", methods=["PUT"])
@require_auth
def put_app_program_visibility():
    """Body: {programa, visibility: "auto" | "shown" | "hidden"}."""
    try:
        programa, visibility = registry.parse_visibility_payload(
            request.get_json(silent=True)
        )
    except registry.InvalidPayload as e:
        return jsonify({"error": str(e)}), 400

    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor() as cur:
            registry.set_visibility(cur, programa, visibility)
        conn.commit()
        # Trilha de auditoria: quem mudou a visibilidade de qual programa.
        logger.warning(
            f"[app_programs] {current_username()!r} mudou a visibilidade de {programa!r} para {visibility}"
        )
        return jsonify({"programa": programa, "visibility": visibility}), 200
    except Exception as e:
        connection_ok = False
        conn.rollback()
        logger.error(f"[app_programs] Erro ao mudar visibilidade: {e}")
        return jsonify({"error": "Não foi possível salvar a visibilidade."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@app_programs_bp.route("/api/app-programs/logs/delete", methods=["POST"])
@require_auth
def post_delete_app_program_logs():
    """
    Apaga todos os logs do programa e o remove do registro. Body: {programa}.
    POST (e nao DELETE com body) porque o nome vai no corpo -- pode ter espaco,
    barra etc. e alguns proxies descartam body de DELETE.
    """
    try:
        programa = registry.parse_program_name(request.get_json(silent=True))
    except registry.InvalidPayload as e:
        return jsonify({"error": str(e)}), 400

    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor() as cur:
            deleted = registry.delete_program(cur, programa)
        conn.commit()
        # Trilha de auditoria: apagar logs e' irreversivel, entao fica registrado quem fez.
        logger.warning(
            f"[app_programs] {current_username()!r} apagou {deleted} logs de {programa!r}"
        )
        return jsonify({"programa": programa, "deleted": deleted}), 200
    except Exception as e:
        connection_ok = False
        conn.rollback()
        logger.error(f"[app_programs] Erro ao apagar logs: {e}")
        return jsonify({"error": "Não foi possível apagar os logs do programa."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)
