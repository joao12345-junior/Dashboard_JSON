# app.py
import os
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

CORS(app)

from routes.logs import logs_bp
app.register_blueprint(logs_bp)

if __name__ == "__main__":
    app.run(port=8765, debug=True)