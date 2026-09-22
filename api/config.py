# api/config.py
"""
Configuracao compartilhada entre o app Flask (WSGI) e o handler ASGI
cru do streaming de logs (stream_asgi.py).

Existe como modulo separado -- em vez de app.py calcular ALLOWED_ORIGINS
e stream_asgi.py importar de app.py -- para evitar import circular:
app.py precisa importar o router ASGI que usa stream_asgi.py, e
stream_asgi.py precisa da lista de origens permitidas pra validar CORS
manualmente (ver comentario em stream_asgi.py sobre por que ele nao
pode reaproveitar o flask_cors).
"""
import os
from dotenv import load_dotenv

# Precisa vir ANTES do os.getenv() -- senao ele cai no default,
# silenciosamente, sem erro nenhum.
load_dotenv()

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "https://localhost:5173").split(",")
    if origin.strip()
]

# Unica fonte de verdade pra "estamos em modo dev (HTTP puro, Flask dev
# server) ou nao (TLS via hypercorn)?" -- app.py usa isso pra decidir qual
# servidor subir, e routes/auth.py usa pra decidir a flag Secure do cookie
# de refresh. Antes COOKIE_SECURE era uma env var independente de
# FLASK_ENV, e as duas ficaram dessincronizadas quando o TLS entrou no ar
# (o .env continuou com COOKIE_SECURE=false mesmo depois do servidor
# passar a rodar so' com HTTPS) -- um cookie sem Secure ainda funciona
# sobre HTTPS, entao o login nao quebrou, so' ficou com uma protecao a
# menos do que deveria ter. Derivar os dois do mesmo IS_DEV torna essa
# dessincronia estruturalmente impossivel.
IS_DEV = os.getenv("FLASK_ENV") == "development"
