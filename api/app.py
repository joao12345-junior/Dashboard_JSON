# app.py
import os
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from waitress import serve

# Precisa vir ANTES de qualquer os.getenv() que dependa do .env —
# senão os.getenv cai no default, silenciosamente, sem erro nenhum.
load_dotenv()

app = Flask(__name__)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

CORS(
    app,
    resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=True,
)

from routes.logs import logs_bp
app.register_blueprint(logs_bp)

from routes.health import health_bp
app.register_blueprint(health_bp)

from routes.ingest import ingest_bp
app.register_blueprint(ingest_bp)

from routes.auth import auth_bp
app.register_blueprint(auth_bp)

from routes.site_monitor import site_monitor_bp
app.register_blueprint(site_monitor_bp)

from routes.test_connection import test_connection
app.register_blueprint(test_connection)

if __name__ == "__main__":
    is_dev = os.getenv("FLASK_ENV") == "development"
    if is_dev:
        app.run(host='0.0.0.0', port=8765, debug=True, use_reloader=False)
    else:
        serve(app, host='0.0.0.0', port=8765, threads=8)