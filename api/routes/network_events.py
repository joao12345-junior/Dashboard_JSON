# api/routes/network_events.py
import logging
import re
from flask import Blueprint, jsonify, request
from psycopg2.extras import RealDictCursor
from db import get_connection, release_connection
from routes.auth import require_auth

network_events_bp = Blueprint("network_events", __name__)
logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 200
MAX_LIMIT = 500
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# Os dias da lista seguem o horario de Brasilia (o mesmo mostrado na tela).
DISPLAY_TIMEZONE = "America/Sao_Paulo"


def _escape_like(text: str) -> str:
    """Escapa % _ e \\ para o termo digitado ser tratado como texto, nao como curinga."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@network_events_bp.route("/api/network/events", methods=["GET"])
@require_auth
def get_network_events():
    """
    Eventos de rede (UniFi, via coletor syslog), do mais novo para o mais antigo.
    Paginacao por cursor (keyset): `before_id` = id do ultimo item ja carregado.
    Filtros: `min_severity` (inteiro CEF 0-10), `q` (texto em nome ou mensagem)
    e `date` (AAAA-MM-DD, dia inteiro no horario de Brasilia).
    Devolve {"events": [...], "has_more": bool}. A linha original (`raw`) nao vai
    na lista, so o cabecalho e o `extension` (JSONB).
    """
    limit = request.args.get("limit", DEFAULT_LIMIT, type=int)
    limit = max(1, min(limit, MAX_LIMIT))
    before_id = request.args.get("before_id", type=int)
    min_severity = request.args.get("min_severity", type=int)
    q = (request.args.get("q") or "").strip()[:200]
    date = (request.args.get("date") or "").strip()
    if date and not DATE_PATTERN.match(date):
        return jsonify({"error": "Parametro date invalido (use AAAA-MM-DD)."}), 400

    where: list[str] = []
    params: list = []
    if before_id is not None:
        where.append("id < %s")
        params.append(before_id)
    if min_severity is not None:
        where.append("severity >= %s")
        params.append(min_severity)
    if date:
        # [00:00 do dia, 00:00 do dia seguinte) em Brasilia; usa a hora do evento
        # e, se o UniFi nao informou, a hora em que o coletor gravou.
        where.append(
            "COALESCE(event_time, created_at) >= (%s::date)::timestamp AT TIME ZONE %s"
            " AND COALESCE(event_time, created_at) < (%s::date + 1)::timestamp AT TIME ZONE %s"
        )
        params.extend([date, DISPLAY_TIMEZONE, date, DISPLAY_TIMEZONE])
    if q:
        pattern = f"%{_escape_like(q)}%"
        where.append(
            "(name ILIKE %s ESCAPE '\\' OR extension->>'msg' ILIKE %s ESCAPE '\\')"
        )
        params.extend([pattern, pattern])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT id, created_at, event_time, source_ip, device_product,
                       signature_id, name, severity, extension
                FROM optsislog.network_events
                {where_sql}
                ORDER BY id DESC
                LIMIT %s
                """,
                (*params, limit + 1),  # +1 para saber se ha mais paginas
            )
            rows = cur.fetchall()
        has_more = len(rows) > limit
        rows = rows[:limit]
        for row in rows:
            row["created_at"] = row["created_at"].isoformat()
            if row["event_time"] is not None:
                row["event_time"] = row["event_time"].isoformat()
        return jsonify({"events": rows, "has_more": has_more}), 200
    except Exception as e:
        connection_ok = False
        logger.error(f"[network_events] Erro: {e}")
        return jsonify({"error": "Não foi possível buscar os eventos de rede."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)
