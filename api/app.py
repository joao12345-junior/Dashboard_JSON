# app.py
import os
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

from routes.logs import logs_bp
app.register_blueprint(logs_bp)

from routes.health import logs_bp as health_bp
app.register_blueprint(health_bp)

from routes.ingest import ingest_bp
app.register_blueprint(ingest_bp)

from routes.auth import auth_bp
app.register_blueprint(auth_bp)

from routes.site_monitor import site_monitor_bp
app.register_blueprint(site_monitor_bp)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8765, debug=True, use_reloader=False)