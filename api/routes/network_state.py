# api/routes/network_state.py
import logging
from flask import Blueprint, jsonify, request
from psycopg2.extras import RealDictCursor
from db import get_connection, release_connection
from routes.auth import require_auth

network_state_bp = Blueprint("network_state", __name__)
logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 500
MAX_LIMIT = 1000
CLIENT_STATUSES = ("connected", "disconnected", "all")


def _escape_like(text: str) -> str:
    """Escapa % _ e \\ para o termo digitado ser tratado como texto, nao como curinga."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _iso(row: dict, *keys: str) -> None:
    for key in keys:
        if row.get(key) is not None:
            row[key] = row[key].isoformat()


@network_state_bp.route("/api/network/devices", methods=["GET"])
@require_auth
def get_network_devices():
    """
    Dispositivos UniFi (UCG, APs, switches) com o ultimo estado conhecido.
    `polled_at` = ultimo ciclo do poller (se estiver velho, o poller parou).
    """
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT mac, unifi_id, name, model, ip_address, state, firmware_version,
                       firmware_updatable, features, uptime_sec, cpu_pct, memory_pct,
                       uplink_tx_bps, uplink_rx_bps, last_heartbeat_at, first_seen_at,
                       last_polled_at
                FROM optsislog.network_devices
                ORDER BY lower(coalesce(name, mac))
                """
            )
            rows = cur.fetchall()
        for row in rows:
            _iso(row, "last_heartbeat_at", "first_seen_at", "last_polled_at")
        polled_at = max((r["last_polled_at"] for r in rows), default=None)
        return jsonify({"devices": rows, "polled_at": polled_at}), 200
    except Exception as e:
        connection_ok = False
        logger.error(f"[network_devices] Erro: {e}")
        return jsonify({"error": "Não foi possível buscar os dispositivos de rede."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@network_state_bp.route("/api/network/clients", methods=["GET"])
@require_auth
def get_network_clients():
    """
    Clientes da rede. `status`: connected (padrao) | disconnected | all.
    `q` busca em nome, hostname, nota, IP, MAC e fabricante. Mais recentes primeiro.
    Devolve {"clients": [...], "connected_count": n, "polled_at": iso|null}.
    """
    status = request.args.get("status", "connected")
    if status not in CLIENT_STATUSES:
        return jsonify({"error": "Parametro status invalido."}), 400
    limit = request.args.get("limit", DEFAULT_LIMIT, type=int)
    limit = max(1, min(limit, MAX_LIMIT))
    q = (request.args.get("q") or "").strip()[:200]

    where: list[str] = []
    params: list = []
    if status == "connected":
        where.append("connected")
    elif status == "disconnected":
        where.append("NOT connected")
    if q:
        pattern = f"%{_escape_like(q)}%"
        columns = ("name", "hostname", "note", "ip_address", "mac", "vendor")
        where.append(
            "(" + " OR ".join(f"{c} ILIKE %s ESCAPE '\\'" for c in columns) + ")"
        )
        params.extend([pattern] * len(columns))
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""

    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT c.mac, c.name, c.hostname, c.note, c.ip_address, c.vendor,
                       c.is_wired, c.is_guest, c.network_name, c.uplink_mac,
                       d.name AS uplink_name, c.ssid, c.signal_dbm, c.tx_bytes,
                       c.rx_bytes, c.connected, c.connected_since, c.disconnected_at,
                       c.first_seen_at, c.last_seen_at
                FROM optsislog.network_clients c
                LEFT JOIN optsislog.network_devices d ON d.mac = c.uplink_mac
                {where_sql}
                ORDER BY c.connected DESC, c.last_seen_at DESC, c.mac
                LIMIT %s
                """,
                (*params, limit),
            )
            rows = cur.fetchall()
            cur.execute("SELECT count(*) AS n FROM optsislog.network_clients WHERE connected")
            connected_count = cur.fetchone()["n"]
            cur.execute("SELECT max(last_polled_at) AS polled FROM optsislog.network_devices")
            polled_at = cur.fetchone()["polled"]
        for row in rows:
            _iso(row, "connected_since", "disconnected_at", "first_seen_at", "last_seen_at")
        return (
            jsonify(
                {
                    "clients": rows,
                    "connected_count": connected_count,
                    "polled_at": polled_at.isoformat() if polled_at else None,
                }
            ),
            200,
        )
    except Exception as e:
        connection_ok = False
        logger.error(f"[network_clients] Erro: {e}")
        return jsonify({"error": "Não foi possível buscar os clientes de rede."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)
