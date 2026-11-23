# api/collector/client_sessions.py
"""
Regra PURA (sem banco) do historico de conexoes: dado o que esta aberto no banco e
o retrato deste ciclo, decide quais sessoes abrir e quais fechar. O adaptador
Postgres so executa o plano; os testes cobrem a regra sem precisar de banco.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Mapping, Optional

from .unifi_mapper import NetworkClient

#: Diferenca minima no "conectou em" para considerar que o cliente RECONECTOU entre
#: dois ciclos (o UniFi arredonda e alguns clientes oscilam poucos segundos).
RECONNECT_TOLERANCE = timedelta(seconds=120)


@dataclass(frozen=True, slots=True)
class OpenSession:
    id: int
    mac: str
    connected_at: datetime


@dataclass(frozen=True, slots=True)
class SessionToOpen:
    mac: str
    connected_at: datetime
    uplink_mac: Optional[str]
    ip_address: Optional[str]


@dataclass(frozen=True, slots=True)
class SessionToClose:
    id: int
    disconnected_at: datetime


@dataclass(frozen=True, slots=True)
class SessionPlan:
    to_open: tuple[SessionToOpen, ...]
    to_close: tuple[SessionToClose, ...]


def plan_sessions(
    open_sessions: Mapping[str, OpenSession],
    clients: Iterable[NetworkClient],
    polled_at: datetime,
) -> SessionPlan:
    """
    - Cliente presente sem sessao aberta: abre (desde `connected_since`, ou agora).
    - Cliente presente cuja hora de conexao avancou (reconectou entre ciclos):
      fecha a antiga na hora da nova conexao e abre outra.
    - Sessao aberta de cliente ausente: fecha agora (hora em que notamos).
    """
    to_open: list[SessionToOpen] = []
    to_close: list[SessionToClose] = []
    present: set[str] = set()
    for c in clients:
        if c.mac in present:
            continue
        present.add(c.mac)
        start = c.connected_since if c.connected_since and c.connected_since <= polled_at else polled_at
        current = open_sessions.get(c.mac)
        if current is None:
            to_open.append(SessionToOpen(c.mac, start, c.uplink_mac, c.ip_address))
        elif c.connected_since and c.connected_since - current.connected_at > RECONNECT_TOLERANCE:
            to_close.append(SessionToClose(current.id, c.connected_since))
            to_open.append(SessionToOpen(c.mac, start, c.uplink_mac, c.ip_address))
    for mac, session in open_sessions.items():
        if mac not in present:
            to_close.append(SessionToClose(session.id, polled_at))
    return SessionPlan(tuple(to_open), tuple(to_close))
