# api/notify_listener.py
"""
Listener compartilhado de LISTEN/NOTIFY do Postgres, para o canal
'log_inserted' criado na migration 011.

Por que uma conexao dedicada, fora do ThreadedConnectionPool: uma
conexao em LISTEN fica esperando notificacao indefinidamente -- se
viesse do pool (maxconn=15, compartilhado com o resto da API), cada
processo do servidor prenderia uma conexao do pool pra sempre, sem
nunca devolver. Essa conexao vive por todo o tempo de vida do
processo, aberta uma vez no startup (evento ASGI lifespan.startup) e
fechada no shutdown.

Por que uma thread, nao uma task asyncio: psycopg2 e sincrono -- nao
tem como esperar (await) uma notificacao chegar sem bloquear o loop
inteiro. A thread fica presa em select() (chamada de sistema que so'
acorda quando o socket da conexao tem algo pra ler -- sem gastar CPU
enquanto espera) e, quando acorda, repassa o que achou pro loop
asyncio principal via loop.call_soon_threadsafe -- a unica forma
segura de uma thread "de fora" mexer em estruturas do asyncio (como
as filas dos clientes SSE), que nao sao thread-safe por padrao.

Fan-out: cada cliente SSE conectado (uma aba aberta do dashboard)
registra sua propria asyncio.Queue aqui via register_client(). Quando
uma notificacao chega, o payload e' colocado em TODAS as filas
registradas -- cada aba recebe o mesmo evento, independente das
outras. unregister_client() precisa ser chamado quando a aba
desconecta, senao a fila fica presa em memoria pra sempre (memory
leak silencioso).
"""
import asyncio
import json
import select
import threading

import psycopg2
import psycopg2.extensions

from db import db_host, db_port, db_name, db_user, db_password, db_sslmode

CHANNEL = "log_inserted"

# Mesmos 3 valores usados nos argumentos dos CREATE TRIGGER (migration
# 011) -- qualquer outro valor aqui indica um payload que nao veio de
# onde a gente espera (ou um typo numa trigger futura), e nao deve
# ser repassado adiante sem mais nem menos.
_KNOWN_LOG_TYPES = {"process", "windows-event", "app"}

_listen_conn: psycopg2.extensions.connection | None = None
_listener_thread: threading.Thread | None = None
_stop_event = threading.Event()
_loop: asyncio.AbstractEventLoop | None = None
_clients: set[asyncio.Queue] = set()


def register_client() -> asyncio.Queue:
    """Chamado por cada nova conexao SSE (uma aba). Precisa rodar na
    thread do loop asyncio -- so' e' seguro porque _clients so' e'
    mexido a partir dali (ver nota de thread-safety no fim do arquivo)."""
    queue: asyncio.Queue = asyncio.Queue()
    _clients.add(queue)
    return queue


def unregister_client(queue: asyncio.Queue) -> None:
    """Chamado quando a aba desconecta (finally do stream). Sem isso,
    a fila continua na memoria recebendo eventos que ninguem le mais."""
    _clients.discard(queue)


def _broadcast(payload: dict) -> None:
    # So' e' chamada via loop.call_soon_threadsafe (ver _listen_loop) --
    # quando roda, ja' esta' executando DENTRO do loop asyncio, entao e'
    # seguro iterar/mexer em _clients aqui.
    for queue in _clients:
        queue.put_nowait(payload)


def _listen_loop() -> None:
    """Roda na thread de background. Fica em select() ate' o socket da
    conexao ter algo pra ler, ou 1s se passar (timeout existe so' pra
    _stop_event ser checado periodicamente -- sem timeout, select()
    bloquearia pra sempre e o shutdown nunca conseguiria parar a thread)."""
    assert _listen_conn is not None
    while not _stop_event.is_set():
        readable, _, _ = select.select([_listen_conn], [], [], 1.0)
        if not readable:
            continue

        _listen_conn.poll()
        while _listen_conn.notifies:
            notify = _listen_conn.notifies.pop(0)
            try:
                payload = json.loads(notify.payload)
            except (json.JSONDecodeError, TypeError):
                print(f"notify_listener: payload invalido ignorado: {notify.payload!r}")
                continue

            if (
                not isinstance(payload, dict)
                or payload.get("log_type") not in _KNOWN_LOG_TYPES
                or not isinstance(payload.get("count"), int)
            ):
                print(f"notify_listener: payload com formato inesperado ignorado: {payload!r}")
                continue

            if _loop is not None:
                _loop.call_soon_threadsafe(_broadcast, payload)


def start(loop: asyncio.AbstractEventLoop) -> None:
    """Chamado uma vez, no boot do servidor (lifespan.startup)."""
    global _listen_conn, _listener_thread, _loop
    _loop = loop
    _stop_event.clear()

    _listen_conn = psycopg2.connect(
        host=db_host, port=db_port, dbname=db_name,
        user=db_user, password=db_password, sslmode=db_sslmode,
    )
    # LISTEN precisa de autocommit: fora disso, o comando so' "vale"
    # depois de um COMMIT que nunca vai acontecer, porque essa conexao
    # nunca faz mais nada alem de esperar.
    _listen_conn.autocommit = True
    with _listen_conn.cursor() as cur:
        cur.execute(f"LISTEN {CHANNEL};")

    _listener_thread = threading.Thread(
        target=_listen_loop, name="notify-listener", daemon=True
    )
    _listener_thread.start()
    print(f"notify_listener: ouvindo canal '{CHANNEL}'")


def stop() -> None:
    """Chamado uma vez, no encerramento do servidor (lifespan.shutdown)."""
    _stop_event.set()
    if _listener_thread is not None:
        _listener_thread.join(timeout=2)
    if _listen_conn is not None:
        _listen_conn.close()
    print("notify_listener: conexao de LISTEN fechada")
