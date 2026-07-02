# api/routes/site_monitor.py
import os
import requests
from datetime import datetime, timezone
from flask import Blueprint, jsonify
from db import get_connection, release_connection
from routes.auth import require_auth, require_sync_key

site_monitor_bp = Blueprint("site_monitor", __name__)

SITE_URL = "https://optare.com.br"
SENTRY_ORG = os.getenv("SENTRY_ORG", "optare")
SENTRY_PROJECT = os.getenv("SENTRY_PROJECT", "javascript-nextjs")
SENTRY_AUTH_TOKEN = os.getenv("SENTRY_AUTH_TOKEN")


def _check_site_availability() -> dict:
    """Faz GET no site e retorna status, tempo de resposta e se está no ar."""
    start = datetime.now(timezone.utc)
    try:
        response = requests.get(SITE_URL, timeout=10)
        response_time_ms = int(
            (datetime.now(timezone.utc) - start).total_seconds() * 1000
        )
        return {
            "url": SITE_URL,
            "status_code": response.status_code,
            "response_time_ms": response_time_ms,
            "is_up": response.status_code < 500,
        }
    except requests.exceptions.RequestException:
        response_time_ms = int(
            (datetime.now(timezone.utc) - start).total_seconds() * 1000
        )
        return {
            "url": SITE_URL,
            "status_code": None,
            "response_time_ms": response_time_ms,
            "is_up": False,
        }


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


@site_monitor_bp.route("/api/site/check", methods=["POST"])
@require_sync_key
def check_availability():
    """Verifica disponibilidade do site e salva no banco."""
    result = _check_site_availability()
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO optsislog.site_availability
                    (url, status_code, response_time_ms, is_up)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    result["url"],
                    result["status_code"],
                    result["response_time_ms"],
                    result["is_up"],
                ),
            )
            conn.commit()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn)


@site_monitor_bp.route("/api/site/sync-sentry", methods=["POST"])
@require_sync_key
def sync_sentry():
    """Busca issues do Sentry e salva no banco."""
    issues = _fetch_sentry_issues()
    if not issues:
        return jsonify({"synced": 0}), 200

    conn = get_connection()
    synced = 0
    try:
        with conn.cursor() as cur:
            for issue in issues:
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
                        issue.get("id"),
                        issue.get("title"),
                        issue.get("level"),
                        issue.get("culprit"),
                        issue.get("firstSeen"),
                        issue.get("lastSeen"),
                        issue.get("count"),
                        issue.get("permalink")
                    ),
                )
                synced += 1
            conn.commit()
        return jsonify({
            "synced": synced,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn)


@site_monitor_bp.route("/api/site/availability", methods=["GET"])
@require_auth
def get_availability():
    """Retorna histórico de disponibilidade do site."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, url, status_code, response_time_ms, is_up, checked_at
                FROM optsislog.site_availability
                ORDER BY checked_at DESC
                LIMIT 100
                """
            )
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
            result = [dict(zip(columns, row)) for row in rows]
            for row in result:
                row["checked_at"] = row["checked_at"].isoformat()
            return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn)


@site_monitor_bp.route("/api/site/sentry-events", methods=["GET"])
@require_auth
def get_sentry_events():
    """Retorna eventos do Sentry salvos no banco."""
    conn = get_connection()
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
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn)