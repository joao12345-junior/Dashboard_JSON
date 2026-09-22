# api/stream_asgi.py
"""
Implementacao ASGI nativa (fora do Flask/WSGI) do endpoint de streaming
de logs (/api/logs/stream).

Por que isso existe separado do resto da API:
O restante das rotas roda via Flask (WSGI) adaptado pra ASGI pelo
WsgiToAsgi, que executa cada requisicao inteira numa thread do
executor padrao do asyncio (pool de tamanho limitado). Isso e' bom
pra requests curtas, mas o endpoint de streaming mantem a conexao
aberta por tempo indefinido (enquanto a aba do dashboard estiver
aberta) -- e a implementacao original usava time.sleep() (bloqueante)
dentro do generator, entao cada aba aberta prendia uma thread inteira
do pool pra sempre, nao so durante o processamento. Com poucas abas
abertas ao mesmo tempo o pool esgotava e travava QUALQUER outra
requisicao da API (login, refresh, etc.), sem relacao nenhuma com logs.

Aqui a mesma logica roda como ASGI puro: asyncio.sleep() no lugar de
time.sleep() nao ocupa thread nenhuma enquanto espera, e as chamadas
sincronas ao psycopg2 (que nao tem driver async) rodam via
asyncio.to_thread() so' durante a query em si -- a thread volta pro
pool assim que a query termina, nao fica presa pelo tempo entre polls.

Custo dessa abordagem (documentado aqui de proposito): como essa rota
nao passa mais pelo Flask, ela nao ganha CORS de graca via flask_cors
nem autenticacao via o decorator require_auth -- as duas precisam ser
reimplementadas manualmente abaixo, checando a mesma lista
ALLOWED_ORIGINS (config.py) e reaproveitando verify_token() (a unica
parte que da' pra importar direto de routes/auth.py sem depender do
contexto de request do Flask). Se um dia a politica de CORS ou de
autenticacao mudar, tem que mudar nos dois lugares -- aqui e no
app.py/flask_cors.
"""
import asyncio
import json

from config import ALLOWED_ORIGINS
from db import get_connection, release_connection
from routes.auth import verify_token

POLL_INTERVAL_SECONDS = 5
_TABLE_BY_LOG_TYPE = {
    "app": "app_logs",
    "process": "process_logs",
    "windows-event": "windows_event_logs",
}

STREAM_PATH = "/api/logs/stream"


def _headers_dict(scope) -> dict[str, str]:
    # Headers ASGI vem como lista de tuplas de bytes -- normaliza pra
    # dict de str minusculo, igual o Flask expoe via request.headers.
    return {
        k.decode("latin-1").lower(): v.decode("latin-1")
        for k, v in scope.get("headers", [])
    }


def _extract_bearer_token(headers: dict[str, str]) -> str | None:
    auth_header = headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.removeprefix("Bearer ")


def _cors_headers(origin: str | None) -> list[tuple[bytes, bytes]]:
    """
    Replica o comportamento do flask_cors pra essa rota: so' ecoa o
    Origin de volta (com credentials=true) se ele estiver na allowlist
    -- nunca "*", porque a chamada usa credentials (Authorization
    header) e o navegador rejeita "*" junto com credentials mesmo que
    o servidor mande. Vary: Origin evita que um cache HTTP no meio do
    caminho sirva a resposta de uma origem pra outra.
    """
    if origin and origin in ALLOWED_ORIGINS:
        return [
            (b"access-control-allow-origin", origin.encode("latin-1")),
            (b"access-control-allow-credentials", b"true"),
            (b"vary", b"Origin"),
        ]
    return []


async def _handle_preflight(scope, send) -> None:
    headers = _headers_dict(scope)
    origin = headers.get("origin")
    cors = _cors_headers(origin)
    if cors:
        cors = cors + [
            (b"access-control-allow-methods", b"GET, OPTIONS"),
            (b"access-control-allow-headers", b"Authorization, Content-Type"),
        ]
    await send({"type": "http.response.start", "status": 204, "headers": cors})
    await send({"type": "http.response.body", "body": b"", "more_body": False})


async def _send_json_error(send, status: int, message: str, origin: str | None) -> None:
    body = json.dumps({"error": message}).encode("utf-8")
    headers = [(b"content-type", b"application/json")] + _cors_headers(origin)
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body, "more_body": False})


async def _wait_for_disconnect(receive) -> None:
    """
    Fica consumindo o canal receive() ate' o cliente desconectar (aba
    fechada, F5, etc.). E' a unica forma, em ASGI cru, de descobrir que
    a conexao morreu sem esperar a proxima tentativa de send() falhar.
    Roda como task paralela a' geracao dos eventos (ver stream_logs_asgi).
    """
    while True:
        message = await receive()
        if message["type"] == "http.disconnect":
            print("stream de logs: cliente desconectou (aba fechada/F5)")
            return


async def _run_stream(send) -> None:
    """Mesma logica de negocio do generator Flask original -- so' que
    com sleep assincrono e queries delegadas pra thread apenas durante
    a execucao delas, nao durante a espera entre polls."""
    conn = await asyncio.to_thread(get_connection)
    conn_ok = True
    try:
        def _fetch_max_ids():
            with conn.cursor() as cur:
                ids = {}
                for log_type, table in _TABLE_BY_LOG_TYPE.items():
                    cur.execute(f"SELECT COALESCE(MAX(id), 0) FROM optsislog.{table}")
                    ids[log_type] = cur.fetchone()[0]
                return ids

        last_seen_ids = await asyncio.to_thread(_fetch_max_ids)

        while True:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

            def _poll_counts():
                counts = {}
                with conn.cursor() as cur:
                    for log_type, table in _TABLE_BY_LOG_TYPE.items():
                        cur.execute(
                            f"SELECT COUNT(*) FROM optsislog.{table} WHERE id > %s",
                            [last_seen_ids[log_type]],
                        )
                        counts[log_type] = cur.fetchone()[0]
                return counts

            counts = await asyncio.to_thread(_poll_counts)

            if any(counts.values()):
                payload = f"data: {json.dumps(counts)}\n\n".encode("utf-8")
                await send({"type": "http.response.body", "body": payload, "more_body": True})
                last_seen_ids = await asyncio.to_thread(_fetch_max_ids)
            else:
                await send({"type": "http.response.body", "body": b": keep-alive\n\n", "more_body": True})
    except Exception as e:
        conn_ok = False
        print(f"stream de logs quebrou: {e}")
    finally:
        # asyncio.to_thread aqui tambem, mesmo dentro de um finally
        # disparado por cancelamento -- ver nota no docstring do modulo
        # sobre cancelamento cooperativo em pontos de await.
        await asyncio.to_thread(release_connection, conn, is_healthy=conn_ok)
        print(f"stream de logs: conexao do pool liberada (saudavel={conn_ok})")


async def stream_logs_asgi(scope, receive, send) -> None:
    headers = _headers_dict(scope)
    origin = headers.get("origin")

    if scope["method"] == "OPTIONS":
        await _handle_preflight(scope, send)
        return

    if scope["method"] != "GET":
        await _send_json_error(send, 405, "Metodo nao permitido", origin)
        return

    token = _extract_bearer_token(headers)
    payload = verify_token(token) if token else None
    if payload is None:
        await _send_json_error(send, 401, "Token nao fornecido ou invalido", origin)
        return

    response_headers = [
        (b"content-type", b"text/event-stream"),
        (b"cache-control", b"no-cache"),
        (b"x-accel-buffering", b"no"),
    ] + _cors_headers(origin)
    await send({"type": "http.response.start", "status": 200, "headers": response_headers})

    stream_task = asyncio.ensure_future(_run_stream(send))
    disconnect_task = asyncio.ensure_future(_wait_for_disconnect(receive))

    done, pending = await asyncio.wait(
        {stream_task, disconnect_task}, return_when=asyncio.FIRST_COMPLETED
    )

    for task in pending:
        task.cancel()
    # Espera o cancelamento propagar de verdade (o finally de
    # _run_stream precisa terminar de liberar a conexao) antes de
    # devolver o controle pro servidor ASGI.
    await asyncio.gather(*pending, return_exceptions=True)

    if disconnect_task in done:
        # Cliente ja' desconectou -- nao tenta mandar mais nada nesse
        # socket, o servidor ASGI ja sabe que a conexao acabou.
        return

    # So' chega aqui se _run_stream saiu sozinho -- o loop dele e'
    # infinito, entao isso so' acontece se uma excecao nao tratada
    # escapou. Fecha o body e repropaga pro hypercorn logar.
    exc = stream_task.exception()
    await send({"type": "http.response.body", "body": b"", "more_body": False})
    if exc:
        raise exc
