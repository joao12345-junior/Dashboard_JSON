from flask import Blueprint, jsonify, request
from routes.auth import require_auth
import requests

test_connection = Blueprint("test_connection", __name__)

@test_connection.route("/api/test_conn/", methods=["POST"])
@require_auth
def test_conn():
    data = request.get_json()

    url = data.get("url", "")

    if not url:
        return jsonify({"error": "URL não informada"}), 400

    try:
        response = requests.get(
            url,
            timeout=10,
            allow_redirects=True,
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