# app.py
import asyncio
from pathlib import Path
from flask import Flask
from flask_cors import CORS
from asgiref.wsgi import WsgiToAsgi
from hypercorn.config import Config
from hypercorn.asyncio import serve as hypercorn_serve

from config import ALLOWED_ORIGINS, IS_DEV

app = Flask(__name__)

CORS(
    app,
    resources={r"/api/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=True,
)

from routes.logs import logs_bp
app.register_blueprint(logs_bp)

from routes.health import health_bp
app.register_blueprint(health_bp)

from routes.auth import auth_bp
app.register_blueprint(auth_bp)

from routes.site_monitor import site_monitor_bp
app.register_blueprint(site_monitor_bp)

from routes.test_connection import test_connection_bp
app.register_blueprint(test_connection_bp)

if __name__ == "__main__":
    if IS_DEV:
        app.run(host='0.0.0.0', port=8765, debug=True, use_reloader=False)
    else:
        # Caminho absoluto ancorado neste arquivo -- nao pode ser relativo,
        # porque o Vite spawna esse processo com cwd="api/", e um caminho
        # relativo resolveria para "api/certs/" em vez de "certs/" na raiz.
        certs_dir = Path(__file__).resolve().parent.parent / "certs"

        # hypercorn e' um servidor assincrono (asyncio) com suporte nativo a
        # TLS -- diferente do Waitress, que precisou de um hack de socket
        # que se mostrou incompativel com o loop nao-bloqueante dele.
        # WsgiToAsgi adapta o app Flask (sincrono/WSGI) para rodar sob um
        # servidor assincrono (ASGI), executando cada request numa thread
        # separada para nao bloquear o event loop.
        wsgi_asgi_app = WsgiToAsgi(app)

        # /api/logs/stream e' desviado ANTES de chegar no Flask: ele
        # mantem a conexao aberta indefinidamente (enquanto a aba do
        # dashboard estiver aberta), e rodar isso dentro de uma thread
        # do WsgiToAsgi prendia essa thread pra sempre -- bastavam 2-3
        # abas abertas ao mesmo tempo pra esgotar o pool de threads e
        # travar QUALQUER outra rota da API (login, refresh, etc.).
        # stream_asgi.py reimplementa so' essa rota como ASGI nativo
        # (asyncio.sleep no lugar de time.sleep), sem tocar thread
        # nenhuma durante a espera entre polls. Ver o docstring de
        # stream_asgi.py para o custo dessa abordagem (CORS e auth
        # duplicados fora do Flask so' pra essa rota).
        from stream_asgi import stream_logs_asgi, STREAM_PATH
        import notify_listener

        async def _handle_lifespan(scope, receive, send) -> None:
            # Hypercorn manda esses eventos automaticamente no boot e no
            # encerramento do processo -- e' o unico hook confiavel pra
            # abrir/fechar a conexao de LISTEN uma vez so', fora do ciclo
            # de vida de qualquer request individual.
            while True:
                message = await receive()
                if message["type"] == "lifespan.startup":
                    notify_listener.start(asyncio.get_running_loop())
                    await send({"type": "lifespan.startup.complete"})
                elif message["type"] == "lifespan.shutdown":
                    notify_listener.stop()
                    await send({"type": "lifespan.shutdown.complete"})
                    return

        async def routed_asgi_app(scope, receive, send):
            if scope["type"] == "lifespan":
                await _handle_lifespan(scope, receive, send)
            elif scope["type"] == "http" and scope["path"] == STREAM_PATH:
                await stream_logs_asgi(scope, receive, send)
            else:
                await wsgi_asgi_app(scope, receive, send)

        config = Config()
        config.bind = ["0.0.0.0:8765"]
        config.certfile = str(certs_dir / "cert.pem")
        config.keyfile = str(certs_dir / "key.pem")
        # Hypercorn nao loga requests por padrao (diferente do Waitress/Flask) --
        # sem isso, uma requisicao travada nao deixa rastro nenhum no terminal.
        config.accesslog = "-"
        config.errorlog = "-"

        asyncio.run(hypercorn_serve(routed_asgi_app, config))
