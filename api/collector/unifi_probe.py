# api/collector/unifi_probe.py
"""
Sonda SOMENTE LEITURA da API local do UCG (fase 2 do UniFi).

Objetivo: descobrir, no equipamento real, quais endpoints respondem com a chave
de API e qual o formato do JSON (clientes, dispositivos, alertas, topologia),
antes de escrever o coletor. Faz apenas GET, nunca altera nada no UCG.

Uso (a partir de api/, no servidor 201 — ele enxerga o UCG na LAN).
Coloque no api/.env (fora do git) e rode:

    UNIFI_HOST=https://192.168.16.1
    UNIFI_API_KEY=<chave criada em Network > Integrations>

    python -m collector.unifi_probe

Variaveis de ambiente ja definidas no shell tem prioridade sobre o .env.

A saida mascara MACs (mantem os 3 primeiros bytes) e esconde campos com cara de
segredo (pass, psk, secret, token, key, x_*). Mesmo assim, confira antes de colar.
O certificado do UCG e autoassinado, entao a verificacao TLS fica desligada
(trafego so na LAN).
"""
import json
import os
import re
import sys
from pathlib import Path

import requests
import urllib3

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # sem python-dotenv, vale so o ambiente do shell
    pass

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

TIMEOUT_SECONDS = 15
MAX_SAMPLE_CHARS = 1800
SECRET_KEY_PATTERN = re.compile(r"pass|psk|secret|token|key|^x_", re.IGNORECASE)
MAC_PATTERN = re.compile(r"\b([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){2})(?::[0-9a-fA-F]{2}){3}\b")


def _mask(value):
    """Esconde segredos e encurta MACs, recursivamente."""
    if isinstance(value, dict):
        return {
            k: ("***" if SECRET_KEY_PATTERN.search(k) else _mask(v))
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [_mask(v) for v in value]
    if isinstance(value, str):
        return MAC_PATTERN.sub(r"\1:xx:xx:xx", value)
    return value


def _get(session: requests.Session, base: str, path: str):
    """GET e devolve (status, json|texto|None)."""
    try:
        resp = session.get(base + path, timeout=TIMEOUT_SECONDS, verify=False)
    except requests.RequestException as e:
        return None, f"{type(e).__name__}: {e}"
    try:
        return resp.status_code, resp.json()
    except ValueError:
        return resp.status_code, resp.text[:200]


def _items(body):
    """Lista de itens de uma resposta (Integration: 'data'; legado: 'data' tambem)."""
    if isinstance(body, dict) and isinstance(body.get("data"), list):
        return body["data"]
    if isinstance(body, list):
        return body
    return None


def _report(title: str, status, body) -> None:
    print(f"\n=== {title} ===")
    print(f"status: {status}")
    if status is None or not isinstance(body, (dict, list)):
        print(f"corpo: {body}")
        return
    if isinstance(body, dict):
        print(f"chaves do topo: {sorted(body.keys())}")
        for extra in ("count", "totalCount", "limit", "offset"):
            if extra in body:
                print(f"{extra}: {body[extra]}")
    items = _items(body)
    if items is None:
        sample = body
    else:
        print(f"itens: {len(items)}")
        sample = items[0] if items else None
    if sample is not None:
        text = json.dumps(_mask(sample), ensure_ascii=False, indent=2)
        if len(text) > MAX_SAMPLE_CHARS:
            text = text[:MAX_SAMPLE_CHARS] + "\n... (cortado)"
        print("exemplo (1o item):")
        print(text)


def main() -> int:
    host = os.environ.get("UNIFI_HOST", "").rstrip("/")
    api_key = os.environ.get("UNIFI_API_KEY", "")
    if not host or not api_key:
        print("Defina UNIFI_HOST (ex.: https://192.168.16.1) e UNIFI_API_KEY no api/.env.")
        return 2

    session = requests.Session()
    session.headers.update({"X-API-KEY": api_key, "Accept": "application/json"})
    integration = "/proxy/network/integration/v1"
    legacy = "/proxy/network/api/s/default"

    status, body = _get(session, host, f"{integration}/info")
    _report("Integration: info", status, body)

    status, body = _get(session, host, f"{integration}/sites")
    _report("Integration: sites", status, body)
    sites = _items(body) or []
    if not sites:
        print("\nSem site para continuar nos endpoints do Integration.")
    else:
        site_id = sites[0].get("id")
        status, body = _get(session, host, f"{integration}/sites/{site_id}/devices?limit=200")
        _report("Integration: devices", status, body)
        devices = _items(body) or []
        if devices:
            device_id = devices[0].get("id")
            status, stats = _get(
                session, host, f"{integration}/sites/{site_id}/devices/{device_id}/statistics/latest"
            )
            _report("Integration: device statistics/latest (1o dispositivo)", status, stats)
        status, body = _get(session, host, f"{integration}/sites/{site_id}/clients?limit=200")
        _report("Integration: clients", status, body)

    # API legada: alertas e topologia (uplink/LLDP). Pode exigir login por cookie;
    # o status abaixo diz se a chave basta.
    for title, path in (
        ("Legado: stat/alarm (alertas)", f"{legacy}/stat/alarm"),
        ("Legado: stat/device (uplink / LLDP)", f"{legacy}/stat/device"),
        ("Legado: stat/sta (clientes ativos)", f"{legacy}/stat/sta"),
        ("Legado: stat/event (eventos recentes)", f"{legacy}/stat/event?_limit=5"),
    ):
        status, body = _get(session, host, path)
        _report(title, status, body)

    # WAN (fase 4): o que o poller usa para a aba Infraestrutura. Mostra so os blocos
    # de WAN do gateway (o stat/device inteiro e grande demais e e cortado acima).
    from .unifi_mapper import find_gateway, map_wans

    status, body = _get(session, host, f"{legacy}/stat/device")
    gateway = find_gateway(body.get("data") if isinstance(body, dict) else None)
    print("\n=== WAN: blocos do gateway em stat/device ===")
    if gateway is None:
        print(f"status: {status} -- nenhum gateway encontrado")
    else:
        wan_keys = ("wan1", "wan2", "wan3", "uptime_stats", "geo_info", "last_wan_status", "uplink")
        print(f"chaves presentes: {[k for k in wan_keys if k in gateway]}")
        print(json.dumps(_mask({k: gateway.get(k) for k in wan_keys if k in gateway}), ensure_ascii=False, indent=2)[:MAX_SAMPLE_CHARS])
    status, confs = _get(session, host, f"{legacy}/rest/networkconf")
    wan_confs = [c for c in (_items(confs) or []) if isinstance(c, dict) and c.get("purpose") == "wan"]
    print(f"\n=== WAN: rest/networkconf (purpose=wan) ===\nstatus: {status}")
    for c in wan_confs:
        print({k: c.get(k) for k in ("name", "wan_networkgroup", "wan_load_balance_type", "enabled")})
    if gateway is not None:
        print("\n=== WAN: resultado do mapeador (o que vai para o banco) ===")
        for link in map_wans(gateway, wan_confs):
            print(link)

    return 0


if __name__ == "__main__":
    sys.exit(main())
