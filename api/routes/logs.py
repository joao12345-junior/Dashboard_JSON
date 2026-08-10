# routes/logs.py
from flask import Blueprint, request, jsonify
from db import get_connection, release_connection
from routes.auth import require_auth

logs_bp = Blueprint("logs", __name__)

@logs_bp.route("/api/logs/last-activity")
@require_auth
def last_activity():
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    (SELECT MAX(created_at) FROM optsislog.process_logs) as backup,
                    (SELECT MAX(created_at) FROM optsislog.windows_event_logs) as windows,
                    (SELECT MAX(checked_at) FROM optsislog.site_availability) as site,
                    (SELECT MAX(coletado_em) FROM optsislog.app_logs) as app
            """)
            row = cur.fetchone()
            return jsonify({
                "backup": row[0].isoformat() if row[0] else None,
                "windows": row[1].isoformat() if row[1] else None,
                "site": row[2].isoformat() if row[2] else None,
                "app": row[3].isoformat() if row[3] else None,
            }), 200
    except Exception as e:
        connection_ok = False
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@logs_bp.route("/api/logs")
@require_auth
def get_logs():
    log_type = request.args.get('type')
    if log_type is None:
        return jsonify({"error": "parâmetro 'type' é obrigatório"}), 400

    conn = get_connection()
    connection_ok = True
    try:
        if log_type == 'process':
            return _fetch_process_logs(conn)
        if log_type == 'windows-event':
            return _fetch_windows_event_logs(conn)
        if log_type == 'app':
            return _fetch_app_logs(conn)
        return jsonify({"error": f"type '{log_type}' inválido"}), 400
    except Exception:
        connection_ok = False
        raise
    finally:
        release_connection(conn, is_healthy=connection_ok)


def _fetch_app_logs(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, classe, programa, tipo, mensagem, detalhes, ocorrido_em, coletado_em
            FROM optsislog.app_logs
            ORDER BY ocorrido_em DESC
        """)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        result = [dict(zip(columns, row)) for row in rows]
        for row in result:
            row['ocorrido_em'] = row['ocorrido_em'].isoformat()
            row['coletado_em'] = row['coletado_em'].isoformat()
        return jsonify(result)

# Sem release_connection aqui — o get_logs cuida disso
def _fetch_process_logs(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, message, log_date, log_time, start
            FROM optsislog.process_logs
            ORDER BY log_date DESC, log_time DESC
        """)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        result = [dict(zip(columns, row)) for row in rows]
        for row in result:
            row['log_date'] = row['log_date'].isoformat()
            row['log_time'] = row['log_time'].isoformat()
        return jsonify(result)

def _fetch_windows_event_logs(conn):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, event_id, level, level_label, provider, computer,
                   channel, time_created, message, criticality, summary,
                   source_file, created_at, run_id
            FROM optsislog.windows_event_logs
            ORDER BY time_created DESC
        """)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        result = [dict(zip(columns, row)) for row in rows]
        return jsonify(result)