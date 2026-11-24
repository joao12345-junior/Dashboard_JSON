# api/collector/unifi_source.py
"""
Porta de ENTRADA do poller (Ports and Adapters, Alistair Cockburn).

`UnifiSource` e a PORTA: "me de os dispositivos e os clientes de agora". O
poller so conhece esse contrato. `UnifiHttpSource` e o ADAPTADOR que fala com a
API local do UCG; nos testes usa-se uma fonte em memoria.

SOMENTE LEITURA: este modulo so faz GET. A chave de API do UCG pode ter poder de
escrita, entao a garantia de que nada e alterado esta aqui, no codigo.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Optional, Protocol

from .unifi_mapper import (
    NetworkClient,
    AppUsage,
    NetworkDevice,
    VpnClient,
    WanLink,
    find_gateway,
    map_client,
    map_device,
    map_top_apps,
    map_vpn_client,
    map_wans,
    APP_PERIODS,
)

logger = logging.getLogger("unifi_source")

INTEGRATION_PREFIX = "/proxy/network/integration/v1"
LEGACY_PREFIX = "/proxy/network/api/s"
PAGE_SIZE = 200
MAX_PAGES = 50  # trava de seguranca contra paginacao que nunca termina
V2_PREFIX = "/proxy/network/v2/api/site"
#: Quantos aplicativos o ranking traz.
TOP_APPS = 10
DPI_CATALOG_TTL_SECONDS = 24 * 3600


class UnifiSource(Protocol):
    """Contrato de leitura. Deve levantar excecao se nao conseguiu ler (nunca devolver lista vazia no lugar)."""

    def fetch_devices(self) -> list[NetworkDevice]: ...

    def fetch_clients(self) -> list[NetworkClient]: ...

    def fetch_wans(self) -> list[WanLink]: ...

    def fetch_vpn_clients(self) -> list[VpnClient]: ...

    def fetch_top_apps(self, period: str) -> list[AppUsage]: ...


class UnifiHttpSource:
    """Adaptador HTTP da API local do UCG (autenticacao por X-API-KEY)."""

    def __init__(
        self,
        host: str,
        api_key: str,
        *,
        verify_tls: bool = False,
        timeout: float = 15.0,
        session: Any = None,
    ) -> None:
        if session is None:
            import requests
            import urllib3

            if not verify_tls:
                # O UCG usa certificado autoassinado; o trafego e so da LAN.
                urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            session = requests.Session()
        session.headers.update({"X-API-KEY": api_key, "Accept": "application/json"})
        self._session = session
        self._base = host.rstrip("/")
        self._verify = verify_tls
        self._timeout = timeout
        # Catalogo de nomes do DPI (~2 mil aplicativos): muda pouco, recarrega 1x/dia.
        self._dpi_apps: dict[int, str] = {}
        self._dpi_categories: dict[int, str] = {}
        self._dpi_loaded_at = 0.0
        self._site_id: Optional[str] = None
        self._site_ref: Optional[str] = None

    # ---- HTTP ---------------------------------------------------------

    def _get(self, path: str, params: Optional[dict] = None) -> Any:
        resp = self._session.get(
            self._base + path,
            params=params,
            timeout=self._timeout,
            verify=self._verify,
        )
        resp.raise_for_status()
        return resp.json()

    def _get_paged(self, path: str) -> list[dict]:
        """Integration API pagina com limit/offset e devolve totalCount."""
        items: list[dict] = []
        offset = 0
        for _ in range(MAX_PAGES):
            body = self._get(path, {"limit": PAGE_SIZE, "offset": offset})
            page = body.get("data") or []
            items.extend(p for p in page if isinstance(p, dict))
            offset += len(page)
            if not page or offset >= int(body.get("totalCount") or 0):
                break
        return items

    def _resolve_site(self) -> tuple[str, str]:
        """(id do site na Integration API, referencia 'default' da API legada). Em cache."""
        if self._site_id is None or self._site_ref is None:
            sites = self._get_paged(f"{INTEGRATION_PREFIX}/sites")
            if not sites:
                raise RuntimeError("A API do UCG nao devolveu nenhum site.")
            site = next(
                (s for s in sites if s.get("internalReference") == "default"), sites[0]
            )
            self._site_id = str(site["id"])
            self._site_ref = str(site.get("internalReference") or "default")
        return self._site_id, self._site_ref

    # ---- Porta --------------------------------------------------------

    def fetch_devices(self) -> list[NetworkDevice]:
        site_id, _ = self._resolve_site()
        base = f"{INTEGRATION_PREFIX}/sites/{site_id}/devices"
        devices: list[NetworkDevice] = []
        for raw in self._get_paged(base):
            stats = None
            try:
                stats = self._get(f"{base}/{raw.get('id')}/statistics/latest")
            except Exception as e:  # um dispositivo sem metricas nao derruba o ciclo
                logger.warning("Sem estatisticas de %s: %s: %s", raw.get("name"), type(e).__name__, e)
            device = map_device(raw, stats)
            if device is not None:
                devices.append(device)
        return devices

    def fetch_clients(self) -> list[NetworkClient]:
        _, site_ref = self._resolve_site()
        body = self._get(f"{LEGACY_PREFIX}/{site_ref}/stat/sta")
        rows = body.get("data") if isinstance(body, dict) else None
        if not isinstance(rows, list):
            raise RuntimeError("Resposta inesperada de stat/sta (sem 'data').")
        clients = (map_client(r) for r in rows if isinstance(r, dict))
        return [c for c in clients if c is not None]

    def fetch_wans(self) -> list[WanLink]:
        """
        WANs do gateway (`stat/device`). Os nomes ("Unifique", "Claro NET") vem do
        `rest/networkconf`; se esse endpoint falhar, segue sem nomes (nao e essencial).
        Levanta excecao se o `stat/device` falhar ou nao houver gateway.
        """
        _, site_ref = self._resolve_site()
        body = self._get(f"{LEGACY_PREFIX}/{site_ref}/stat/device")
        gateway = find_gateway(body.get("data") if isinstance(body, dict) else None)
        if gateway is None:
            raise RuntimeError("Nenhum gateway encontrado em stat/device.")
        confs: list = []
        try:
            conf_body = self._get(f"{LEGACY_PREFIX}/{site_ref}/rest/networkconf")
            confs = conf_body.get("data") or [] if isinstance(conf_body, dict) else []
        except Exception as e:
            logger.warning("Sem nomes das WANs (rest/networkconf): %s: %s", type(e).__name__, e)
        return map_wans(gateway, confs)

    def _dpi_catalog(self) -> tuple[dict[int, str], dict[int, str]]:
        """Nomes de aplicativos e categorias (Integration API, GET). Em cache por 24 h."""
        if not self._dpi_apps or time.monotonic() - self._dpi_loaded_at > DPI_CATALOG_TTL_SECONDS:
            apps = self._get_paged(f"{INTEGRATION_PREFIX}/dpi/applications")
            cats = self._get_paged(f"{INTEGRATION_PREFIX}/dpi/categories")
            self._dpi_apps = {
                int(a["id"]): str(a["name"]) for a in apps if a.get("id") is not None and a.get("name")
            }
            self._dpi_categories = {
                int(c["id"]): str(c["name"]) for c in cats if c.get("id") is not None and c.get("name")
            }
            self._dpi_loaded_at = time.monotonic()
        return self._dpi_apps, self._dpi_categories

    def fetch_top_apps(self, period: str) -> list[AppUsage]:
        """
        Ranking de aplicativos por trafego (`period`: "hour" | "day"), com nomes.
        Sem catalogo (falhou) segue com os ids: o front mostra "App 140" no lugar do nome.
        """
        unifi_period = APP_PERIODS[period]
        try:
            apps, cats = self._dpi_catalog()
        except Exception as e:
            logger.warning("Sem catalogo de aplicativos (DPI): %s: %s", type(e).__name__, e)
            apps, cats = self._dpi_apps, self._dpi_categories
        _, site_ref = self._resolve_site()
        body = self._get(
            f"{V2_PREFIX}/{site_ref}/traffic-flow-latest-statistics",
            {"period": unifi_period, "top": TOP_APPS},
        )
        return map_top_apps(body, period, apps, cats)

    def fetch_vpn_clients(self) -> list[VpnClient]:
        """
        Usuarios conectados na VPN (`stat/remoteuservpn`, GET). Levanta excecao se a
        resposta nao tiver 'data': lista vazia aqui significaria "todos desconectaram".
        """
        _, site_ref = self._resolve_site()
        body = self._get(f"{LEGACY_PREFIX}/{site_ref}/stat/remoteuservpn")
        rows = body.get("data") if isinstance(body, dict) else None
        if not isinstance(rows, list):
            raise RuntimeError("Resposta inesperada de stat/remoteuservpn (sem 'data').")
        clients = (map_vpn_client(r) for r in rows if isinstance(r, dict))
        return [c for c in clients if c is not None]
