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
from collections import Counter
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


def _print_sample(title: str, sample) -> None:
    text = json.dumps(_mask(sample), ensure_ascii=False, indent=2)
    if len(text) > MAX_SAMPLE_CHARS:
        text = text[:MAX_SAMPLE_CHARS] + "\n... (cortado)"
    print(f"{title}:")
    print(text)


def _types_of(rows) -> dict:
    return dict(Counter(str(r.get("type")) for r in rows if isinstance(r, dict)))


def _probe_vpn_clients(session, host, integration, legacy, site_id) -> None:
    """
    Clientes de VPN (OpenVPN/Teleport) nao aparecem no LogDash: o poller le o
    stat/sta (so' cabo e Wi-Fi). Descobre em qual endpoint eles estao e com que campos
    (VPN costuma vir sem MAC, e o cadastro do LogDash usa o MAC como chave).
    """
    print("\n=== VPN 1/3: Integration API /clients, contagem por tipo ===")
    items: list = []
    offset, total, status = 0, None, None
    for _ in range(10):
        status, body = _get(session, host, f"{integration}/sites/{site_id}/clients?limit=200&offset={offset}")
        page = _items(body) or []
        items.extend(page)
        total = body.get("totalCount") if isinstance(body, dict) else None
        offset += len(page)
        if not page or (total is not None and offset >= total):
            break
    print(f"status: {status} -- {len(items)} clientes (totalCount={total})")
    by_type = _types_of(items)
    print(f"por tipo: {by_type}")
    for client_type in by_type:
        sample = next(c for c in items if isinstance(c, dict) and str(c.get("type")) == client_type)
        _print_sample(f"exemplo do tipo {client_type}", sample)

    print("\n=== VPN 2/3: Legado stat/sta, algum cliente parece VPN? ===")
    status, body = _get(session, host, f"{legacy}/stat/sta")
    rows = [r for r in (_items(body) or []) if isinstance(r, dict)]
    vpn_like = [
        r for r in rows
        if str(r.get("ip", "")).startswith("10.10.10.") or "vpn" in str(r.get("network", "")).lower()
    ]
    print(f"status: {status} -- {len(rows)} clientes; parecem VPN (ip 10.10.10.x ou rede com 'vpn'): {len(vpn_like)}")
    if vpn_like:
        _print_sample("exemplo", vpn_like[0])

    print("\n=== VPN 3/3: v2 clients/active, contagem por tipo ===")
    status, body = _get(session, host, "/proxy/network/v2/api/site/default/clients/active")
    rows = body if isinstance(body, list) else (_items(body) or [])
    print(f"status: {status} -- {len(rows) if isinstance(rows, list) else '?'} itens")
    if isinstance(rows, list) and rows:
        print(f"por tipo: {_types_of(rows)}")
        vpn = next((r for r in rows if isinstance(r, dict) and str(r.get('type')).upper() == 'VPN'), None)
        _print_sample("exemplo de VPN" if vpn else "exemplo (1o item, nao ha VPN)", vpn or rows[0])
    elif not isinstance(body, (dict, list)):
        print(f"corpo: {body}")


def _probe_top_apps(session, host) -> None:
    """Aplicativos mais usados (DPI): endpoint v2 por GET; so' confirma se responde com a chave."""
    print("\n=== APLICATIVOS: v2 traffic-flow-latest-statistics (GET) ===")
    status, body = _get(
        session, host, "/proxy/network/v2/api/site/default/traffic-flow-latest-statistics?period=DAY&top=5"
    )
    _report("v2 traffic-flow-latest-statistics?period=DAY&top=5", status, body)


def _looks_vpn(item) -> bool:
    """Item que parece cliente de VPN: IP da rede ServOvpn (10.10.10.x) ou 'vpn' em algum campo de tipo/rede."""
    if not isinstance(item, dict):
        return False
    for key in ("ip", "ipAddress", "last_ip", "fixed_ip", "remote_ip", "local_ip", "tunnel_ip"):
        if str(item.get(key, "")).startswith("10.10.10."):
            return True
    for key in ("type", "network", "network_name", "purpose", "vpn_type", "tags"):
        if "vpn" in str(item.get(key, "")).lower():
            return True
    return False


def _flatten_lists(body):
    """Todas as listas de dicts dentro da resposta (alguns endpoints aninham: data.clients etc.)."""
    if isinstance(body, list):
        yield body
        for item in body:
            if isinstance(item, dict):
                yield from _flatten_lists(item)
    elif isinstance(body, dict):
        for value in body.values():
            if isinstance(value, (list, dict)):
                yield from _flatten_lists(value)


#: Candidatos (todos GET) para os clientes de VPN. Os 3 ja testados (Integration /clients,
#: stat/sta e v2 clients/active) devolveram so cabo/Wi-Fi.
VPN_CANDIDATES = (
    "/proxy/network/v2/api/site/default/clients/active?includeTrafficUsage=true&includeUnifiDevices=true",
    "/proxy/network/v2/api/site/default/clients/history?onlyNonBlocked=true&includeUnifiDevices=true&withinHours=24",
    "/proxy/network/v2/api/site/default/vpn/connections",
    "/proxy/network/v2/api/site/default/vpn/servers",
    "/proxy/network/v2/api/site/default/remote-user-vpn/clients",
    "/proxy/network/api/s/default/stat/remoteuservpn",
    "/proxy/network/api/s/default/stat/vpn",
    "/proxy/network/api/s/default/rest/user",
)


def _probe_vpn_candidates(session, host) -> None:
    print("\n=== VPN 4: outros endpoints candidatos (somente GET) ===")
    for path in VPN_CANDIDATES:
        status, body = _get(session, host, path)
        lists = list(_flatten_lists(body)) if isinstance(body, (dict, list)) else []
        total = sum(len(l) for l in lists)
        vpn = [item for l in lists for item in l if _looks_vpn(item)]
        print(f"\n{path}\n  status: {status} -- itens: {total} -- parecem VPN: {len(vpn)}")
        if not isinstance(body, (dict, list)):
            print(f"  corpo: {str(body)[:150]}")
        elif vpn:
            _print_sample("  exemplo de VPN", vpn[0])
        elif isinstance(body, dict):
            print(f"  chaves do topo: {sorted(body.keys())[:15]}")


def _probe_top_apps_detail(session, host) -> None:
    """Formato de top_all_traffic_by_application, que a 1a rodada cortou."""
    for period in ("DAY", "HOUR"):
        print(f"\n=== APLICATIVOS: top_all_traffic_by_application (period={period}) ===")
        status, body = _get(
            session,
            host,
            f"/proxy/network/v2/api/site/default/traffic-flow-latest-statistics?period={period}&top=10",
        )
        print(f"status: {status}")
        apps = body.get("top_all_traffic_by_application") if isinstance(body, dict) else None
        if not isinstance(apps, list):
            print(f"sem a chave (tipo: {type(apps).__name__})")
            continue
        print(f"itens: {len(apps)}")
        for app in apps[:3]:
            _print_sample("item", app)
        if len(apps) > 3:
            names = [a.get("name") or a.get("application_name") or a.get("app_name") for a in apps if isinstance(a, dict)]
            print(f"nomes dos demais: {names[3:]}")


def _integration_all(session, host, path: str) -> tuple:
    """Todas as paginas de um endpoint paginado da Integration API (limit 200)."""
    items: list = []
    offset, status = 0, None
    for _ in range(30):
        status, body = _get(session, host, f"{path}?limit=200&offset={offset}")
        page = _items(body) or []
        items.extend(i for i in page if isinstance(i, dict))
        offset += len(page)
        total = body.get("totalCount") if isinstance(body, dict) else None
        if not page or (total is not None and offset >= total):
            break
    return status, items


def _probe_dpi_names(session, host) -> None:
    """
    As estatisticas trazem so' `application_id` e `category_id`. Os nomes estao em
    GET /integration/v1/dpi/applications e /dpi/categories (documentacao oficial).
    Confere se o id bate direto ou combinado com a categoria ((cat << 16) | app).
    """
    base = "/proxy/network/integration/v1/dpi"
    status, apps = _integration_all(session, host, f"{base}/applications")
    print(f"\n=== DPI: aplicativos (Integration) ===\nstatus: {status} -- {len(apps)} itens")
    for app in apps[:3]:
        _print_sample("item", app)
    status, cats = _integration_all(session, host, f"{base}/categories")
    print(f"\n=== DPI: categorias (Integration) ===\nstatus: {status} -- {len(cats)} itens")
    for cat in cats[:3]:
        _print_sample("item", cat)

    by_id = {a.get("id"): a for a in apps}
    cat_by_id = {c.get("id"): c for c in cats}
    print("\n=== DPI: os 3 primeiros da estatistica ===")
    for app_id, cat_id in ((140, 17), (185, 20), (37, 10)):
        direct = by_id.get(app_id)
        combined = by_id.get((cat_id << 16) | app_id)
        print(
            f"app {app_id} / cat {cat_id}: direto={direct and direct.get('name')!r}"
            f" | combinado {(cat_id << 16) | app_id}={combined and combined.get('name')!r}"
            f" | categoria={cat_by_id.get(cat_id) and cat_by_id[cat_id].get('name')!r}"
        )


#: Pedacos de nome de chave que indicam perda de pacotes ou contagem de conexoes.
_WAN_EXTRA_HINTS = ("loss", "packet", "drop", "connection", "conn_", "session", "jitter")


def _find_keys(value, hints, path="", found=None, limit=60):
    """Caminhos (a.b[0].c) de chaves cujo nome contem algum `hint`, com o valor (curto)."""
    if found is None:
        found = []
    if len(found) >= limit:
        return found
    if isinstance(value, dict):
        for key, child in value.items():
            here = f"{path}.{key}" if path else str(key)
            if any(h in str(key).lower() for h in hints):
                shown = child if not isinstance(child, (dict, list)) else f"<{type(child).__name__} {len(child)}>"
                found.append((here, shown))
            _find_keys(child, hints, here, found, limit)
    elif isinstance(value, list):
        for i, child in enumerate(value[:3]):  # 3 primeiros bastam para ver o formato
            _find_keys(child, hints, f"{path}[{i}]", found, limit)
    return found


#: Candidatos (todos GET) com historico/saude da WAN.
WAN_EXTRA_CANDIDATES = (
    "/proxy/network/v2/api/site/default/aggregated-dashboard?historySeconds=3600",
    "/proxy/network/v2/api/site/default/wan/enriched-configuration",
    "/proxy/network/v2/api/site/default/wan-slas",
    "/proxy/network/v2/api/site/default/isp-health",
    "/proxy/network/api/s/default/stat/health",
)


def _probe_wan_extra(session, host) -> None:
    """Procura perda de pacotes e numero de conexoes (grafico Internet do UniFi)."""
    legacy = "/proxy/network/api/s/default"
    status, body = _get(session, host, f"{legacy}/stat/device")
    gateway = None
    for d in (_items(body) or []):
        if isinstance(d, dict) and (d.get("type") in ("udm", "ugw", "uxg") or isinstance(d.get("wan1"), dict)):
            gateway = d
            break
    print(f"\n=== WAN extra: gateway em stat/device (status {status}) ===")
    if gateway is None:
        print("gateway nao encontrado")
    else:
        for key in ("uptime_stats", "last_wan_status", "wan1"):
            block = gateway.get(key)
            if key != "wan1":
                _print_sample(key, block)
        print("chaves com loss/packet/drop/connection/session/jitter no gateway inteiro:")
        for where, val in _find_keys(gateway, _WAN_EXTRA_HINTS):
            print(f"  {where} = {val}")

    for path in WAN_EXTRA_CANDIDATES:
        status, body = _get(session, host, path)
        print(f"\n=== WAN extra: {path} ===\nstatus: {status}")
        if not isinstance(body, (dict, list)):
            print(f"corpo: {str(body)[:150]}")
            continue
        if isinstance(body, dict):
            print(f"chaves do topo: {sorted(body.keys())[:25]}")
        hits = _find_keys(body, _WAN_EXTRA_HINTS)
        print(f"chaves com loss/packet/drop/connection/session/jitter: {len(hits)}")
        for where, val in hits:
            print(f"  {where} = {val}")


def main() -> int:
    host = os.environ.get("UNIFI_HOST", "").rstrip("/")
    api_key = os.environ.get("UNIFI_API_KEY", "")
    if not host or not api_key:
        print("Defina UNIFI_HOST (ex.: https://192.168.16.1) e UNIFI_API_KEY no api/.env.")
        return 2

    session = requests.Session()
    session.headers.update({"X-API-KEY": api_key, "Accept": "application/json"})

    # Rodada curta: so' o que falta descobrir (clientes de VPN e aplicativos).
    if "--vpn-apps" in sys.argv:
        _probe_vpn_candidates(session, host)
        _probe_top_apps_detail(session, host)
        return 0
    if "--wan-extra" in sys.argv:
        _probe_wan_extra(session, host)
        return 0
    if "--dpi" in sys.argv:
        _probe_dpi_names(session, host)
        return 0

    site_id = None
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

    # Pedido de 24/11: clientes de VPN e aplicativos mais usados.
    if site_id:
        _probe_vpn_clients(session, host, integration, legacy, site_id)
    _probe_top_apps(session, host)

    return 0


if __name__ == "__main__":
    sys.exit(main())
