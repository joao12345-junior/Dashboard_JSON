# routes/logs.py
from flask import Blueprint, request, jsonify
from db import get_connection, release_connection
from datetime import date, time

logs_bp = Blueprint("logs", __name__)

@logs_bp.route("/api/logs")
def get_logs():
    type = request.args.get('type') # pega o ?type=process da URL
    if type is None:
        return jsonify({"error": "parâmetro 'type' é obrigatório"}), 400
    
    if(type == 'process'):
        return _fetch_process_logs(get_connection())
    if(type == 'windows-event'):
        return _fetch_windows_event_logs(get_connection())
    
    return jsonify({"error": f"type '{type}' inválido. Use 'process' ou 'windows-event'"}), 400

def _fetch_process_logs(conn):
    with conn.cursor() as cur:
        try:
            cur.execute("SELECT id, message, log_date, log_time, start FROM optsislog.process_logs ORDER BY log_date DESC, log_time DESC")

            columns = [desc[0] for desc in cur.description] # ['id', 'message', 'log_date', ...]
            rows = cur.fetchall()

            result = [dict(zip(columns, row)) for row in rows]

            for row in result:
                row['log_date'] = row['log_date'].isoformat()
                row['log_time'] = row['log_time'].isoformat()

            return jsonify(result)
        except Exception as e:
            return jsonify({"error": f"Não foi possível pegar os dados do DB, {e}"}), 500
        finally:
            release_connection(conn)

def _fetch_windows_event_logs(conn):
    with conn.cursor() as cur:
        try:
            cur.execute("SELECT id, event_id, level, level_label, provider, computer, channel, time_created, message, criticality, summary, source_file, created_at, run_id FROM optsislog.windows_event_logs ORDER BY time_created DESC")

            columns = [desc[0] for desc in cur.description] # ['id', 'message', 'log_date', ...]
            rows = cur.fetchall()

            result = [dict(zip(columns, row)) for row in rows]
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": f"Não foi possível pegar os dados do DB, {e}"}), 500
        finally:
            release_connection(conn)