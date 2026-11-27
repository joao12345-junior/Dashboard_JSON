# routes/rustdesk.py
"""
Auditoria do RustDesk (acesso remoto): sessoes, alarmes e maquinas.
Todo o SQL esta em rustdesk_queries.py (Repository); aqui so' HTTP.
Os dados tem IPs e nomes de pessoas: todas as rotas exigem login.
"""
import logging
from flask import Blueprint, jsonify, request
from psycopg2.extras import RealDictCursor
from db import get_connection, release_connection
from routes.auth import current_username, require_auth
import rustdesk_queries as queries

rustdesk_bp = Blueprint("rustdesk", __name__)
logger = logging.getLogger(__name__)


def _read(fn, label: str):
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            return jsonify(fn(cur)), 200
    except Exception as e:
        connection_ok = False
        logger.error(f"[rustdesk] Erro ao buscar {label}: {e}")
        return jsonify({"error": f"Não foi possível buscar {label}."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@rustdesk_bp.route("/api/rustdesk/sessions", methods=["GET"])
@require_auth
def get_sessions():
    """?days=7 (1-365) &status=concluida|aberta|bloqueada|tentativa &machine=<id> &include_test=1"""
    try:
        days = queries.parse_days(request.args.get("days"))
        status = queries.parse_status(request.args.get("status"))
    except queries.InvalidParameter as e:
        return jsonify({"error": str(e)}), 400
    machine = (request.args.get("machine") or "").strip()[:32] or None
    include_test = queries.parse_flag(request.args.get("include_test"))
    return _read(
        lambda cur: {
            "days": days,
            **queries.list_sessions(cur, days=days, status=status, machine_id=machine, include_test=include_test),
        },
        "as sessões",
    )


@rustdesk_bp.route("/api/rustdesk/alarms", methods=["GET"])
@require_auth
def get_alarms():
    """?days=30 &include_test=1"""
    try:
        days = queries.parse_days(request.args.get("days"), default=30)
    except queries.InvalidParameter as e:
        return jsonify({"error": str(e)}), 400
    include_test = queries.parse_flag(request.args.get("include_test"))
    return _read(lambda cur: {"alarms": queries.list_alarms(cur, days=days, include_test=include_test)}, "os alarmes")


@rustdesk_bp.route("/api/rustdesk/machines", methods=["GET"])
@require_auth
def get_machines():
    return _read(lambda cur: {"machines": queries.list_machines(cur)}, "as máquinas")


@rustdesk_bp.route("/api/rustdesk/machines/<machine_id>/test", methods=["PUT"])
@require_auth
def put_machine_test(machine_id: str):
    """Body {"is_test": bool}: marca VM de laboratório / notebook do técnico (some das listas)."""
    try:
        is_test = queries.parse_test_flag_payload(request.get_json(silent=True))
    except queries.InvalidParameter as e:
        return jsonify({"error": str(e)}), 400
    machine_id = machine_id.strip()[:32]
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor() as cur:
            queries.set_machine_test_flag(cur, machine_id, is_test)
        conn.commit()
        logger.warning(f"[rustdesk] {current_username()!r} marcou {machine_id!r} como teste={is_test}")
        return jsonify({"machine_id": machine_id, "is_test": is_test}), 200
    except Exception as e:
        connection_ok = False
        conn.rollback()
        logger.error(f"[rustdesk] Erro ao marcar máquina: {e}")
        return jsonify({"error": "Não foi possível salvar."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)
