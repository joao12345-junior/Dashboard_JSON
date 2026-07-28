# api/routes/site_monitor.py
import os
import logging
import requests
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Blueprint, jsonify, request
from psycopg2.extras import RealDictCursor
from db import get_connection, release_connection
from routes.auth import require_auth, require_sync_key

site_monitor_bp = Blueprint("site_monitor", __name__)
logger = logging.getLogger(__name__)

SENTRY_ORG = os.getenv("SENTRY_ORG", "optare")
SENTRY_PROJECT = os.getenv("SENTRY_PROJECT", "javascript-nextjs")
SENTRY_AUTH_TOKEN = os.getenv("SENTRY_AUTH_TOKEN")

CHECK_MAX_WORKERS = 5  # teto fixo, independente de quantas URLs existirem

def _get_active_monitored_urls() -> list[dict]:
    """Busca URLs ativas. Conexão liberada antes de iniciar os checks HTTP."""
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, url, timeout_seconds
                FROM optsislog.monitored_urls
                WHERE active = true
                """
            )
            return cur.fetchall()
    except Exception:
        connection_ok = False
        raise
    finally:
        release_connection(conn, is_healthy=connection_ok)


def _check_url(monitored_url: dict) -> dict:
    """Faz GET numa URL monitorada e retorna o resultado do check."""
    start = datetime.now(timezone.utc)
    try:
        response = requests.get(
            monitored_url["url"], timeout=monitored_url["timeout_seconds"]
        )
        response_time_ms = int(
            (datetime.now(timezone.utc) - start).total_seconds() * 1000
        )
        return {
            "monitored_url_id": monitored_url["id"],
            "url": monitored_url["url"],
            "status_code": response.status_code,
            "response_time_ms": response_time_ms,
            "is_up": response.status_code < 500,
        }
    except requests.exceptions.RequestException:
        response_time_ms = int(
            (datetime.now(timezone.utc) - start).total_seconds() * 1000
        )
        return {
            "monitored_url_id": monitored_url["id"],
            "url": monitored_url["url"],
            "status_code": None,
            "response_time_ms": response_time_ms,
            "is_up": False,
        }


def _save_check_result(result: dict) -> bool:
    """Grava um resultado de check em conexão própria (thread-safe)."""
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO optsislog.site_availability
                    (url, status_code, response_time_ms, is_up, monitored_url_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    result["url"],
                    result["status_code"],
                    result["response_time_ms"],
                    result["is_up"],
                    result["monitored_url_id"],
                ),
            )
            conn.commit()
        return True
    except Exception as e:
        connection_ok = False
        conn.rollback()
        logger.error(f"[site_check] Falha ao salvar {result['url']}: {e}")
        return False
    finally:
        release_connection(conn, is_healthy=connection_ok)

@site_monitor_bp.route("/api/site/monitored-urls", methods=["GET"])
@require_auth
def get_monitored_urls():
    """Lista os sites monitorados — alimenta o seletor de filtro no frontend."""
    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, label, url, active, has_sentry
                FROM optsislog.monitored_urls
                ORDER BY label
                """
            )
            return jsonify(cur.fetchall()), 200
    except Exception as e:
        connection_ok = False
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)

@site_monitor_bp.route("/api/site/check", methods=["POST"])
@require_sync_key
def check_availability():
    """Verifica disponibilidade de todas as URLs ativas, em paralelo, e salva no banco."""
    try:
        monitored_urls = _get_active_monitored_urls()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if not monitored_urls:
        return jsonify({"checked": 0, "results": []}), 200

    results = []
    failed_saves = []
    with ThreadPoolExecutor(max_workers=CHECK_MAX_WORKERS) as executor:
        futures = {executor.submit(_check_url, mu): mu for mu in monitored_urls}
        for future in as_completed(futures):
            result = future.result()
            if not _save_check_result(result):
                failed_saves.append(result["url"])
            results.append(result)

    return jsonify({
        "checked": len(results),
        "results": results,
        "failed_saves": failed_saves,
    }), 200

def _fetch_sentry_issues() -> list[dict]:
    """Busca issues não resolvidos do projeto no Sentry."""
    if not SENTRY_AUTH_TOKEN:
        return []

    try:
        response = requests.get(
            f"https://sentry.io/api/0/projects/{SENTRY_ORG}/{SENTRY_PROJECT}/issues/",
            headers={"Authorization": f"Bearer {SENTRY_AUTH_TOKEN}"},
            params={"is": "unresolved", "limit": 50},
            timeout=10,
        )
        if not response.ok:
            return []
        return response.json()
    except requests.exceptions.RequestException:
        return []

@site_monitor_bp.route("/api/site/sync-sentry", methods=["POST"])
@require_sync_key
def sync_sentry():
    """Busca issues do Sentry e salva no banco."""
    issues = _fetch_sentry_issues()
    if not issues:
        return jsonify({"synced": 0}), 200

    conn = get_connection()
    connection_ok = True
    synced = 0
    failed = []

    try:
        with conn.cursor() as cur:
            for issue in issues:
                issue_id = issue.get("id")
                try:
                    cur.execute("SAVEPOINT sp_issue")    
                    cur.execute(
                        """
                        INSERT INTO optsislog.sentry_events
                            (id, title, level, culprit, first_seen, last_seen, count, permalink)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            title      = EXCLUDED.title,
                            level      = EXCLUDED.level,
                            culprit    = EXCLUDED.culprit,
                            last_seen  = EXCLUDED.last_seen,
                            count      = EXCLUDED.count,
                            permalink = EXCLUDED.permalink,
                            synced_at  = NOW()
                        """,
                        (
                            issue_id,
                            issue.get("title"),
                            issue.get("level"),
                            issue.get("culprit"),
                            issue.get("firstSeen"),
                            issue.get("lastSeen"),
                            issue.get("count"),
                            issue.get("permalink")
                        ),
                    )
                    cur.execute("RELEASE SAVEPOINT sp_issue")
                    synced += 1
                except Exception as issue_error:
                    cur.execute("ROLLBACK TO SAVEPOINT sp_issue")
                    failed.append({"id": issue_id, "error": str(issue_error)})
                    print(f"[sync_sentry] Falha ao sincronizar issue {issue_id}: {issue_error}")
            conn.commit()

        return jsonify({
            "synced": synced,
            "failed": failed
        }), 200
    except Exception as e:
        connection_ok = False
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)

@site_monitor_bp.route("/api/site/availability", methods=["GET"])
@require_auth
def get_availability():
    """Retorna histórico de disponibilidade. Filtra por site se monitored_url_id vier na query."""
    monitored_url_id = request.args.get("monitored_url_id", type=int)
    conn = get_connection()
    connection_ok = True

    try:
        with conn.cursor() as cur:
            if monitored_url_id is not None:
                cur.execute(
                    """
                    SELECT id, url, status_code, response_time_ms, is_up, checked_at, monitored_url_id
                    FROM optsislog.site_availability
                    WHERE monitored_url_id = %s
                    ORDER BY checked_at DESC
                    LIMIT 500
                    """,
                    (monitored_url_id,),
                )
            else:
                cur.execute(
                    """
                    SELECT id, url, status_code, response_time_ms, is_up, checked_at, monitored_url_id
                    FROM optsislog.site_availability
                    ORDER BY checked_at DESC
                    LIMIT 500
                    """
                )
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            result = [dict(zip(columns, row)) for row in rows]
            for row in result:
                row["checked_at"] = row["checked_at"].isoformat()
            return jsonify(result), 200
    except Exception as e:
        connection_ok = False
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@site_monitor_bp.route("/api/site/sentry-events", methods=["GET"])
@require_auth
def get_sentry_events():
    """Retorna eventos do Sentry salvos no banco."""
    conn = get_connection()
    connection_ok = True

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, level, culprit, permalink, first_seen, last_seen, count, synced_at 
                FROM optsislog.sentry_events
                ORDER BY last_seen DESC
                LIMIT 100
                """
            )
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            result = [dict(zip(columns, row)) for row in rows]
            for row in result:
                for field in ("first_seen", "last_seen", "synced_at"):
                    if row[field]:
                        row[field] = row[field].isoformat()
            return jsonify(result), 200
    except Exception as e:
        connection_ok = False
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)