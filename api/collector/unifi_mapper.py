# api/collector/unifi_mapper.py
"""
Tradutor PURO (sem rede, sem banco) das respostas da API do UCG para os
registros que o LogDash guarda. Todos os campos sao tolerantes: o UniFi muda o
formato entre versoes e nem todo dispositivo/cliente manda tudo, entao campo
ausente ou de tipo inesperado vira None em vez de derrubar o ciclo inteiro.

Fontes (Network 11.0.x):
  - dispositivos: Integration API  GET /integration/v1/sites/{id}/devices
                  + .../devices/{id}/statistics/latest
  - clientes:     API legada       GET /api/s/{site}/stat/sta
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Optional


@dataclass(frozen=True, slots=True)
class NetworkDevice:
    """Dispositivo adotado no UniFi (gateway, AP, switch) com as metricas mais recentes."""

    mac: str
    unifi_id: Optional[str]
    name: Optional[str]
    model: Optional[str]
    ip_address: Optional[str]
    state: Optional[str]
    firmware_version: Optional[str]
    firmware_updatable: Optional[bool]
    features: tuple[str, ...]
    uptime_sec: Optional[int]
    cpu_pct: Optional[float]
    memory_pct: Optional[float]
    uplink_tx_bps: Optional[int]
    uplink_rx_bps: Optional[int]
    last_heartbeat_at: Optional[datetime]


@dataclass(frozen=True, slots=True)
class NetworkClient:
    """Cliente conectado (cabeado ou Wi-Fi) no momento do ciclo."""

    mac: str
    name: Optional[str]
    hostname: Optional[str]
    note: Optional[str]
    ip_address: Optional[str]
    vendor: Optional[str]
    is_wired: bool
    is_guest: bool
    network_name: Optional[str]
    #: MAC do AP (Wi-Fi) ou do switch/gateway (cabo) onde o cliente esta ligado.
    uplink_mac: Optional[str]
    ssid: Optional[str]
    signal_dbm: Optional[int]
    #: Contadores do UniFi (acumulados na sessao do cliente).
    tx_bytes: Optional[int]
    rx_bytes: Optional[int]
    connected_since: Optional[datetime]
    first_seen_at: Optional[datetime]


def _str(value: Any) -> Optional[str]:
    return value.strip() or None if isinstance(value, str) else None


def _mac(value: Any) -> Optional[str]:
    text = _str(value)
    return text.lower() if text else None


def _int(value: Any) -> Optional[int]:
    # bool e subclasse de int: excluido de proposito (True nao e "1 byte").
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value)


def _float(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _epoch(value: Any) -> Optional[datetime]:
    seconds = _float(value)
    if seconds is None or seconds <= 0:
        return None
    try:
        return datetime.fromtimestamp(seconds, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None


def _iso(value: Any) -> Optional[datetime]:
    text = _str(value)
    if text is None:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def map_device(
    device: Mapping[str, Any], stats: Optional[Mapping[str, Any]] = None
) -> Optional[NetworkDevice]:
    """Dispositivo da Integration API (+ statistics/latest, opcional). None se nao tem MAC."""
    mac = _mac(device.get("macAddress"))
    if mac is None:
        return None
    stats = stats or {}
    uplink = stats.get("uplink")
    uplink = uplink if isinstance(uplink, Mapping) else {}
    features = device.get("features")
    return NetworkDevice(
        mac=mac,
        unifi_id=_str(device.get("id")),
        name=_str(device.get("name")),
        model=_str(device.get("model")),
        ip_address=_str(device.get("ipAddress")),
        state=_str(device.get("state")),
        firmware_version=_str(device.get("firmwareVersion")),
        firmware_updatable=(
            device["firmwareUpdatable"]
            if isinstance(device.get("firmwareUpdatable"), bool)
            else None
        ),
        features=tuple(f for f in features if isinstance(f, str))
        if isinstance(features, list)
        else (),
        uptime_sec=_int(stats.get("uptimeSec")),
        cpu_pct=_float(stats.get("cpuUtilizationPct")),
        memory_pct=_float(stats.get("memoryUtilizationPct")),
        uplink_tx_bps=_int(uplink.get("txRateBps")),
        uplink_rx_bps=_int(uplink.get("rxRateBps")),
        last_heartbeat_at=_iso(stats.get("lastHeartbeatAt")),
    )


def map_client(sta: Mapping[str, Any]) -> Optional[NetworkClient]:
    """Cliente do `stat/sta` (API legada). None se nao tem MAC."""
    mac = _mac(sta.get("mac"))
    if mac is None:
        return None
    wired = bool(sta.get("is_wired"))
    if wired:
        uplink = (
            _mac(sta.get("sw_mac"))
            or _mac(sta.get("last_uplink_mac"))
            or _mac(sta.get("gw_mac"))
        )
        tx, rx = sta.get("wired-tx_bytes"), sta.get("wired-rx_bytes")
    else:
        uplink = _mac(sta.get("ap_mac")) or _mac(sta.get("last_uplink_mac"))
        tx, rx = sta.get("tx_bytes"), sta.get("rx_bytes")
    return NetworkClient(
        mac=mac,
        name=_str(sta.get("name")) or _str(sta.get("hostname")),
        hostname=_str(sta.get("hostname")),
        note=_str(sta.get("note")),
        ip_address=_str(sta.get("ip")) or _str(sta.get("last_ip")),
        vendor=_str(sta.get("oui")),
        is_wired=wired,
        is_guest=bool(sta.get("is_guest")),
        network_name=_str(sta.get("network"))
        or _str(sta.get("last_connection_network_name")),
        uplink_mac=uplink,
        ssid=None if wired else _str(sta.get("essid")),
        signal_dbm=None if wired else _int(sta.get("signal")),
        tx_bytes=_int(tx),
        rx_bytes=_int(rx),
        connected_since=_epoch(sta.get("latest_assoc_time") or sta.get("assoc_time")),
        first_seen_at=_epoch(sta.get("first_seen")),
    )
