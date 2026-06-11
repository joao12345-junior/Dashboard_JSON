from flask import Blueprint, jsonify
from dotenv import load_dotenv
import threading
import subprocess
import os
import pathlib

ingest_bp = Blueprint("ingest", __name__)

@ingest_bp.route('/api/ingest', methods=["POST"])
def trigger_ingest():
    load_dotenv()

    ingestor_python = os.getenv('INGESTOR_PYTHON')
    ingestor_path = os.getenv('INGESTOR_PATH')

    if ingestor_path is None or ingestor_python is None:
        return jsonify({"ERRO": "Sem caminho para o ingestor"}), 500
    
    thread = threading.Thread(target=run_ingestor, args=(ingestor_python, ingestor_path))
    thread.start()
    return jsonify({"status": "started"}), 202

def run_ingestor(python, path):
    ingestor_dir = pathlib.Path(path).parent
    subprocess.run([python, path], cwd=ingestor_dir)
