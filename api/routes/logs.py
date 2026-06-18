# routes/logs.py
from flask import Blueprint, request, jsonify
from db import get_connection, release_connection
from routes.auth import require_auth

logs_bp = Blueprint("logs", __name__)

@logs_bp.route("/api/logs")
@require_auth
def get_logs():
    log_type = request.args.get('type')
    if log_type is None:
        return jsonify({"error": "parâmetro 'type' é obrigatório"}), 400

    conn = get_connection()
    try:
        if log_type == 'process':
            return _fetch_process_logs(conn)
        if log_type == 'windows-event':
            return _fetch_windows_event_logs(conn)
        return jsonify({"error": f"type '{log_type}' inválido"}), 400
    finally:
        release_connection(conn)

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