# api/routes/auth.py
import os
import secrets
import hashlib
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Blueprint, request, jsonify, make_response
from db import get_connection, release_connection

auth_bp = Blueprint("auth", __name__)

REFRESH_COOKIE_NAME = "logdash_refresh"
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "60"))
# Em produção atrás de HTTPS isso precisa virar "true" no .env. Enquanto o
# LogDash roda só em HTTP dentro da VPN (servidor 201), tem que ficar "false" —
# um cookie Secure nunca é devolvido pelo navegador em conexão HTTP puro,
# e o refresh simplesmente nunca funcionaria, silenciosamente.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"


def _get_secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET não configurado")
    return secret


def _generate_access_token(username: str) -> str:
    payload = {
        "sub": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, _get_secret(), algorithm="HS256")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _issue_refresh_token(conn, username: str) -> str:
    """Gera um refresh token opaco, salva só o hash, retorna o valor puro
    (esse valor só existe aqui — nunca é reconstruído a partir do banco)."""
    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO optsislog.refresh_tokens (username, token_hash, expires_at)
            VALUES (%s, %s, %s)
            """,
            (username, token_hash, expires_at),
        )
    conn.commit()
    return raw_token


def _revoke_refresh_token(conn, raw_token: str) -> None:
    token_hash = _hash_token(raw_token)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE optsislog.refresh_tokens
            SET revoked_at = now()
            WHERE token_hash = %s AND revoked_at IS NULL
            """,
            (token_hash,),
        )
    conn.commit()


def _validate_refresh_token(conn, raw_token: str) -> str | None:
    """Retorna o username se o token for válido, ativo e não expirado. Senão, None."""
    token_hash = _hash_token(raw_token)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT username FROM optsislog.refresh_tokens
            WHERE token_hash = %s
              AND revoked_at IS NULL
              AND expires_at > now()
            """,
            (token_hash,),
        )
        row = cur.fetchone()
    return row[0] if row else None


def _set_refresh_cookie(response, raw_token: str):
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        raw_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="Lax",
        max_age=REFRESH_TOKEN_DAYS * 24 * 3600,
        path="/api/auth",
    )


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _get_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Token não fornecido"}), 401

        token = auth_header.removeprefix("Bearer ")
        payload = verify_token(token)
        if payload is None:
            return jsonify({"error": "Token inválido ou expirado"}), 401

        return f(*args, **kwargs)
    return decorated


def require_sync_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

        sync_key = request.headers.get("X-Sync-Key", "")
        expected = os.getenv("SYNC_API_KEY", "")

        if not expected or sync_key != expected:
            return jsonify({"error": "Chave de sync inválida"}), 401

        return f(*args, **kwargs)
    return decorated


@auth_bp.route("/api/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return "", 200

    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Body inválido"}), 400

    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return jsonify({"error": "username e password são obrigatórios"}), 400

    conn = get_connection()
    connection_ok = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash FROM optsislog.users WHERE username = %s",
                (username,)
            )
            row = cur.fetchone()

        if row is None:
            bcrypt.checkpw(b"dummy", b"$2b$12$dummy.hash.to.prevent.timing.attacks.xxx")
            return jsonify({"error": "Credenciais inválidas"}), 401

        password_hash = row[0].encode("utf-8")
        if not bcrypt.checkpw(password.encode("utf-8"), password_hash):
            return jsonify({"error": "Credenciais inválidas"}), 401

        access_token = _generate_access_token(username)
        refresh_token = _issue_refresh_token(conn, username)

        response = make_response(jsonify({"token": access_token}), 200)
        _set_refresh_cookie(response, refresh_token)
        return response
    except Exception as e:
        connection_ok = False
        return jsonify({"error": f"Erro ao consultar banco: {e}"}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@auth_bp.route("/api/auth/refresh", methods=["POST", "OPTIONS"])
def refresh():
    if request.method == "OPTIONS":
        return "", 200

    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw_token:
        return jsonify({"error": "Refresh token não encontrado"}), 401

    conn = get_connection()
    connection_ok = True
    try:
        username = _validate_refresh_token(conn, raw_token)
        if username is None:
            return jsonify({"error": "Refresh token inválido ou expirado"}), 401

        # Rotação: revoga o token usado, emite um novo — se esse cookie
        # específico vazar, só serve pra uma única troca, não pro resto da vida dele.
        _revoke_refresh_token(conn, raw_token)
        new_refresh_token = _issue_refresh_token(conn, username)
        access_token = _generate_access_token(username)

        response = make_response(jsonify({"token": access_token}), 200)
        _set_refresh_cookie(response, new_refresh_token)
        return response
    except Exception as e:
        connection_ok = False
        return jsonify({"error": str(e)}), 500
    finally:
        release_connection(conn, is_healthy=connection_ok)


@auth_bp.route("/api/auth/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return "", 200

    raw_token = request.cookies.get(REFRESH_COOKIE_NAME)
    response = make_response(jsonify({"ok": True}), 200)
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/api/auth")

    if not raw_token:
        return response

    conn = get_connection()
    connection_ok = True
    try:
        _revoke_refresh_token(conn, raw_token)
        return response
    except Exception:
        connection_ok = False
        return response
    finally:
        release_connection(conn, is_healthy=connection_ok)


@auth_bp.route("/api/auth/me", methods=["GET"])
def me():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Token não fornecido"}), 401

    token = auth_header.removeprefix("Bearer ")
    payload = verify_token(token)
    if payload is None:
        return jsonify({"error": "Token inválido ou expirado"}), 401

    return jsonify({"username": payload["sub"]}), 200