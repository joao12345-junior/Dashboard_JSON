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
from typing import Any, Optional, Protocol

from .unifi_mapper import NetworkClient, NetworkDevice, map_client, map_device

logger = logging.getLogger("unifi_source")

INTEGRATION_PREFIX = "/proxy/network/integration/v1"
LEGACY_PREFIX = "/proxy/network/api/s"
PAGE_SIZE = 200
MAX_PAGES = 50  # trava de seguranca contra paginacao que nunca termina


class UnifiSource(Protocol):
    """Contrato de leitura. Deve levantar excecao se nao conseguiu ler (nunca devolver lista vazia no lugar)."""

    def fetch_devices(self) -> list[NetworkDevice]: ...

    def fetch_clients(self) -> list[NetworkClient]: ...


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
