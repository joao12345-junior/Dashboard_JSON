from flask import Blueprint, jsonify, request
from routes.auth import require_auth
import requests
import ipaddress
import socket
from urllib.parse import urlparse

test_connection = Blueprint("test_connection", __name__)

def _is_private_host(hostname: str) -> bool:
    try:
        addrs = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return True
    for family, _, _, _, sockaddr in addrs:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return True
    return False

def _is_safe_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    return not _is_private_host(parsed.hostname)

@test_connection.route("/api/test_conn/", methods=["POST"])
@require_auth
def test_conn():
    data = request.get_json()
    url = data.get("url", "")

    if not url:
        return jsonify({"error": "URL não informada"}), 400
    if not _is_safe_url(url):
        return jsonify({"error": "URL não permitida"}), 400

    try:
        response = requests.get(
            url,
            timeout=10,
            allow_redirects=False,
            headers={
                "User-Agent": "Optare Site Monitor/1.0"
            }
        )

        return jsonify({
            "url": url,
            "status": "ok" if response.ok else "error",
            "status_code": response.status_code,
        }), 200

    except requests.RequestException as e:
        return jsonify({
            "url": url,
            "status": "error",
            "error": str(e),
        }), 200