# api/routes/network_state.py
import logging
from flask import Blueprint, jsonify, request
from psycopg2.extras import RealDictCursor
from db import get_connection, release_connection
from routes.auth import require_auth
import wan_history

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


@network_state_bp.route("/api/network/wan", methods=["GET"])
@require_auth
def get_network_wan():
    """
    Links de internet do gateway (WAN, WAN2...), ultimo estado gravado pelo poller.
    Devolve {"wans": [...], "polled_at": iso|null}. `polled_at` velho = o poller
    nao esta conseguindo ler a WAN (os dados sao do ultimo ciclo bom).
    """
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT wan_group, name, isp_name, ip_address, is_up, is_enabled,
                       failover_only, availability_pct, latency_ms, rx_bps, tx_bps,
                       gateway_mac, last_polled_at
                FROM optsislog.network_wan
                ORDER BY wan_group
                """
            )
            rows = cur.fetchall()
        polled_at = max((r["last_polled_at"] for r in rows), default=None)
        for row in rows:
            _iso(row, "last_polled_at")
        return jsonify({"wans": rows, "polled_at": polled_at.isoformat() if polled_at else None}), 200
    except Exception as e:
        connection_ok = False
        logger.error(f"[network_wan] Erro: {e}")
        return jsonify({"error": "Não foi possível buscar os links de internet."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


APP_PERIODS = ("hour", "day")


@network_state_bp.route("/api/network/top-apps", methods=["GET"])
@require_auth
def get_network_top_apps():
    """
    Aplicativos com mais trafego (ranking do UniFi), gravado pelo poller a cada ~5 min.
    `period`: hour | day (padrao). Devolve {"period", "apps": [...], "fetched_at": iso|null}.
    """
    period = request.args.get("period", "day")
    if period not in APP_PERIODS:
        return jsonify({"error": "Parametro period invalido."}), 400
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT rank, application_id, category_id, name, category, bytes, fetched_at
                FROM optsislog.network_top_apps
                WHERE period = %s
                ORDER BY rank
                """,
                (period,),
            )
            rows = cur.fetchall()
        fetched_at = rows[0]["fetched_at"] if rows else None
        for row in rows:
            row.pop("fetched_at", None)
        return (
            jsonify(
                {
                    "period": period,
                    "apps": rows,
                    "fetched_at": fetched_at.isoformat() if fetched_at else None,
                }
            ),
            200,
        )
    except Exception as e:
        connection_ok = False
        logger.error(f"[network_top_apps] Erro: {e}")
        return jsonify({"error": "Não foi possível buscar os aplicativos."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@network_state_bp.route("/api/network/vpn-clients", methods=["GET"])
@require_auth
def get_network_vpn_clients():
    """
    Usuarios da VPN do UCG (OpenVPN/Teleport), gravados pelo poller a partir de
    stat/remoteuservpn. `status`: connected (padrao) | disconnected | all.
    Devolve {"clients": [...], "connected_count": n, "polled_at": iso|null}.
    """
    status = request.args.get("status", "connected")
    if status not in CLIENT_STATUSES:
        return jsonify({"error": "Parametro status invalido."}), 400
    where = {"connected": "WHERE connected", "disconnected": "WHERE NOT connected", "all": ""}[status]

    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                SELECT client_key, username, vpn_type, interface, tunnel_ip, remote_ip,
                       rx_bytes, tx_bytes, connected, connected_since, disconnected_at,
                       first_seen_at, last_seen_at
                FROM optsislog.network_vpn_clients
                {where}
                ORDER BY connected DESC, username
                """
            )
            rows = cur.fetchall()
            cur.execute(
                "SELECT count(*) FILTER (WHERE connected) AS n, max(last_seen_at) AS polled_at"
                " FROM optsislog.network_vpn_clients"
            )
            summary = cur.fetchone()
        for row in rows:
            _iso(row, "connected_since", "disconnected_at", "first_seen_at", "last_seen_at")
        polled_at = summary["polled_at"]
        return (
            jsonify(
                {
                    "clients": rows,
                    "connected_count": int(summary["n"] or 0),
                    "polled_at": polled_at.isoformat() if polled_at else None,
                }
            ),
            200,
        )
    except Exception as e:
        connection_ok = False
        logger.error(f"[network_vpn_clients] Erro: {e}")
        return jsonify({"error": "Não foi possível buscar os clientes de VPN."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@network_state_bp.route("/api/network/wan/history", methods=["GET"])
@require_auth
def get_network_wan_history():
    """
    Historico dos links de internet para o grafico: ?period=1h|1d|1w|1m (padrao 1d).
    Pontos agregados (media e maximo) por WAN; o SQL esta em wan_history.py.
    """
    period = wan_history.resolve_period(request.args.get("period"))
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            result = wan_history.fetch_history(cur, period)
        return jsonify(result), 200
    except Exception as e:
        connection_ok = False
        logger.error(f"[network_wan_history] Erro: {e}")
        return jsonify({"error": "Não foi possível buscar o histórico de internet."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


SESSION_DAYS_DEFAULT = 7
SESSION_DAYS_MAX = 30


@network_state_bp.route("/api/network/clients/<mac>/sessions", methods=["GET"])
@require_auth
def get_network_client_sessions(mac: str):
    """
    Historico de conexoes de um cliente: periodos em que esteve conectado nos
    ultimos `days` dias (padrao 7, maximo 30), do mais recente ao mais antigo.
    `disconnected_at` null = ainda conectado. Comeca a contar quando a migracao 015
    entrou (antes disso nao ha historico).
    """
    mac = (mac or "").strip().lower()[:32]
    days = request.args.get("days", SESSION_DAYS_DEFAULT, type=int)
    days = max(1, min(days, SESSION_DAYS_MAX))
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT s.connected_at, s.disconnected_at, s.ip_address, s.uplink_mac,
                       d.name AS uplink_name
                FROM optsislog.network_client_sessions s
                LEFT JOIN optsislog.network_devices d ON d.mac = s.uplink_mac
                WHERE s.mac = %s
                  AND COALESCE(s.disconnected_at, now()) >= now() - make_interval(days => %s)
                ORDER BY s.connected_at DESC
                LIMIT 200
                """,
                (mac, days),
            )
            rows = cur.fetchall()
        for row in rows:
            _iso(row, "connected_at", "disconnected_at")
        return jsonify({"sessions": rows, "days": days}), 200
    except Exception as e:
        connection_ok = False
        logger.error(f"[network_client_sessions] Erro: {e}")
        return jsonify({"error": "Não foi possível buscar o histórico do cliente."}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)
