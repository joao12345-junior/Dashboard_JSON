# routes/logs.py
from flask import Blueprint, request, jsonify
from db import get_connection, release_connection
from routes.auth import require_auth, require_sync_key

logs_bp = Blueprint("logs", __name__)

# MAX_PAGE_SIZE tinha ficado menor que DEFAULT_PAGE_SIZE por engano --
# como o limit sempre passa por min(limit, MAX_PAGE_SIZE), toda chamada
# sem "?limit=" explicito nunca chegava a devolver os 5000 pretendidos,
# sempre parava em 1000. O requisito e' velocidade: o dashboard precisa
# vir com os logs de uma vez, sem o usuario esperando 2-3s olhando pra
# tela vazia enquanto pagina em lotes menores.
DEFAULT_PAGE_SIZE = 1000
MAX_PAGE_SIZE = 5000

PROCESS_LOGS_RETENTION_DAYS = 30
WINDOWS_EVENT_LOGS_RETENTION_DAYS = 14
APP_LOGS_RETENTION_DAYS = 14

# O endpoint de streaming (GET /api/logs/stream) saiu daqui -- agora vive
# em stream_asgi.py, como ASGI nativo, e e' desviado pra la' direto no
# app.py antes de chegar no Flask. Ver o docstring de stream_asgi.py
# pra entender por que (a versao antiga, com time.sleep() dentro de um
# generator WSGI, prendia uma thread inteira do servidor por sessao).

@logs_bp.route("/api/logs/counts")
@require_auth
def counts():
    conn = get_connection()
    conn_ok = True

    try:
        with conn.cursor() as cur:
            cur.execute("""
            SELECT
                (SELECT COUNT(*) FROM optsislog.process_logs) as backup,
                (SELECT COUNT(*) FROM optsislog.windows_event_logs) as windows,
                (SELECT COUNT(*) FROM optsislog.app_logs) as app
            """)
            row = cur.fetchone()
            return jsonify({
                "process": row[0],
                "windows-event": row[1],
                "app": row[2]
            })
    except Exception as e:
        conn_ok = False
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn, is_healthy=conn_ok)

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

@logs_bp.route("/api/logs/cleanup", methods=["POST"])
@require_sync_key
def cleanup_logs():
    """
    Apaga logs mais antigos que a retenção fixa de cada tabela (decisão de
    2026-09-17: process_logs 30 dias, windows_event_logs e app_logs 14 dias).
    Usa a coluna de inserção (created_at/coletado_em), não a data do evento —
    é sobre quanto tempo o registro vive no banco, não quando aconteceu.
    """
    conn = get_connection()
    conn_ok = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM optsislog.process_logs
                WHERE created_at < now() - (%s || ' days')::interval
                """, (PROCESS_LOGS_RETENTION_DAYS,),
            )
            deleted_process = cur.rowcount

            cur.execute(
                """
                DELETE FROM optsislog.windows_event_logs
                WHERE created_at < now() - (%s || ' days')::interval
                """, (WINDOWS_EVENT_LOGS_RETENTION_DAYS,),
            )
            deleted_windows_event = cur.rowcount

            cur.execute(
                """
                DELETE FROM optsislog.app_logs
                WHERE coletado_em < now() - (%s || ' days')::interval
                """, (APP_LOGS_RETENTION_DAYS,),
            )
            deleted_app = cur.rowcount

            conn.commit()
        return jsonify({
            "deleted": {
                "process": deleted_process,
                "windows": deleted_windows_event,
                "app": deleted_app,
            },
            "retention_days":{
                "process": PROCESS_LOGS_RETENTION_DAYS,
                "windows": WINDOWS_EVENT_LOGS_RETENTION_DAYS,
                "app": APP_LOGS_RETENTION_DAYS,
            },
        }), 200
    except Exception as e:
        conn_ok = False
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn, is_healthy=conn_ok)

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
    # sem isoformat() aqui o Flask serializa datetime no formato HTTP-date
    # (RFC 1123, tipo "Thu, 17 Sep 2026 19:12:14 GMT"), nao ISO 8601 -- o
    # mapper do frontend espera ISO ("...T...Z") pra separar data/hora.
    for row in result:
        row['time_created'] = row['time_created'].isoformat()
        row['created_at'] = row['created_at'].isoformat()
    return jsonify({"logs": result, "next_cursor": next_cursor})
