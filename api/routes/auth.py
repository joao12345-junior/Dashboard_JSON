# api/routes/auth.py
import os
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from db import get_connection, release_connection

auth_bp = Blueprint("auth", __name__)

def _get_secret() -> str:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET não configurado")
    return secret

def _generate_token(username: str) -> str:
    """Gera um JWT assinado com expiração configurável."""
    expiration_hours = int(os.getenv("JWT_EXPIRATION_HOURS", "8"))
    payload = {
        "sub": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=expiration_hours),
    }
    return jwt.encode(payload, _get_secret(), algorithm="HS256")

def verify_token(token: str) -> dict | None:
    """
    Valida o JWT e retorna o payload se válido.
    Retorna None se inválido ou expirado.
    """
    try:
        return jwt.decode(token, _get_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None

from functools import wraps

def require_auth(f):
    """
    Decorator que protege endpoints exigindo JWT válido no header Authorization.
    Requisições OPTIONS são ignoradas — necessário para o preflight CORS.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Preflight CORS — deixa o flask-cors responder
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
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash FROM optsislog.users WHERE username = %s",
                (username,)
            )
            row = cur.fetchone()
    except Exception as e:
        return jsonify({"error": f"Erro ao consultar banco: {e}"}), 500
    finally:
        release_connection(conn)

    # Tempo constante mesmo se usuário não existe — evita timing attack
    if row is None:
        bcrypt.checkpw(b"dummy", b"$2b$12$dummy.hash.to.prevent.timing.attacks.xxx")
        return jsonify({"error": "Credenciais inválidas"}), 401

    password_hash = row[0].encode("utf-8")
    if not bcrypt.checkpw(password.encode("utf-8"), password_hash):
        return jsonify({"error": "Credenciais inválidas"}), 401

    token = _generate_token(username)
    return jsonify({"token": token}), 200

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