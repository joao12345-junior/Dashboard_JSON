# routes/logs.py
from flask import Blueprint, request, jsonify
from db import get_connection, release_connection
from routes.auth import require_auth

logs_bp = Blueprint("logs", __name__)

DEFAULT_PAGE_SIZE = 1000
MAX_PAGE_SIZE = 2000

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

    limit = request.args.get("limit", default=DEFAULT_PAGE_SIZE, type=int)
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    before_id = request.args.get("before_id", type=int)
    after_id = request.args.get("after_id", type=int)

    conn = get_connection()
    connection_ok = True
    try:
        if log_type == 'process':
            return _fetch_process_logs(conn, limit, before_id, after_id)
        if log_type == 'windows-event':
            return _fetch_windows_event_logs(conn, limit, before_id, after_id)
        if log_type == 'app':
            return _fetch_app_logs(conn, limit, before_id, after_id)
        return jsonify({"error": f"type '{log_type}' inválido"}), 400
    except Exception:
        connection_ok = False
        raise
    finally:
        release_connection(conn, is_healthy=connection_ok)

def _run_cursor_query(conn, select_clause: str, from_clause: str, limit: int, before_id: int | None, after_id: int | None):
    """
    Paginação por keyset usando 'id' (BIGSERIAL, cresce só na inserção) como
    cursor único — vale pra process_logs, windows_event_logs e app_logs.

    before_id: pega registros MAIS ANTIGOS que o cursor (scroll pra trás / "carregar mais").
    after_id:  pega registros MAIS NOVOS que o cursor (delta — o que entrou desde o último fetch).
    Os dois nunca são usados juntos.

    Devolve sempre na mesma ordem (mais novo primeiro) pro front não ter que
    saber qual modo gerou os dados.
    """
    where_sql = ""
    params: list = []
    if before_id is not None:
        where_sql = "WHERE id < %s"
        params.append(before_id)
    elif after_id is not None:
        where_sql = "WHERE id > %s"
        params.append(after_id)

    # No modo "after_id" o LIMIT precisa pegar os N mais próximos do cursor
    # (os mais antigos da leva nova), então ordena ASC pro banco aplicar o
    # LIMIT certo, e só inverte depois em memória.
    order_sql = "ORDER BY id ASC" if after_id is not None else "ORDER BY id DESC"

    query = f"{select_clause} {from_clause} {where_sql} {order_sql} LIMIT %s"
    params.append(limit)

    with conn.cursor() as cur:
        cur.execute(query, params)
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()

    result = [dict(zip(columns, row)) for row in rows]

    # next_cursor tem que ser calculado ANTES do reverse no modo after_id:
    # result ainda está ASC aqui, então result[-1] é o maior id da leva —
    # o ponto certo pra continuar avançando. Calcular depois do reverse
    # pegaria o menor id, e cada página seguinte re-buscaria quase a
    # mesma faixa de novo.
    next_cursor = result[-1]["id"] if len(result) == limit else None

    if after_id is not None:
            result.reverse()

    return result, next_cursor

def _fetch_app_logs(conn, limit, before_id, after_id):
    result, next_cursor = _run_cursor_query(
        conn,
        "SELECT id, classe, programa, tipo, mensagem, detalhes, ocorrido_em, coletado_em",
        "FROM optsislog.app_logs",
        limit, before_id, after_id,
    )
    for row in result:
        row['ocorrido_em'] = row['ocorrido_em'].isoformat()
        row['coletado_em'] = row['coletado_em'].isoformat()
    return jsonify({"logs": result, "next_cursor": next_cursor})

# Sem release_connection aqui — o get_logs cuida disso
def _fetch_process_logs(conn, limit, before_id, after_id):
    result, next_cursor = _run_cursor_query(
        conn,
        "SELECT id, message, log_date, log_time, start",
        "FROM optsislog.process_logs",
        limit, before_id, after_id,
    )
    for row in result:
        row['log_date'] = row['log_date'].isoformat()
        row['log_time'] = row['log_time'].isoformat()
    return jsonify({"logs": result, "next_cursor": next_cursor})

def _fetch_windows_event_logs(conn, limit, before_id, after_id):
    result, next_cursor = _run_cursor_query(
        conn,
        """SELECT id, event_id, level, level_label, provider, computer,
                  channel, time_created, message, criticality, summary,
                  source_file, created_at""",
        "FROM optsislog.windows_event_logs",
        limit, before_id, after_id,
    )
    return jsonify({"logs": result, "next_cursor": next_cursor})