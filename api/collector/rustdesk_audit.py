# api/collector/rustdesk_audit.py
"""
Auditoria do RustDesk (VPS da Optare): regras PURAS, sem rede e sem banco.

O VPS grava `avisos.jsonl`, uma linha JSON por aviso que as maquinas RustDesk mandam
ao servidor: {"recebido_utc", "ip_origem", "caminho", "corpo"}. Aqui:

  1. `parse_line` transforma cada linha em `AuditEvent` (conexao, alarme, arquivo) ou
     em `SysInfo` (estado da maquina, chega a cada ~2 min e NAO vai para a tabela bruta);
  2. `build_sessions` junta os avisos `new` -> auth -> (alarm) -> `close` de cada
     conexao numa `RemoteSession`, que e o que a tela mostra.

Formato conferido em dados reais e no cliente 1.5.3 (src/server/connection.rs):
  - `corpo.id` e a maquina ACESSADA; no auth, `peer` = [ID, nome] de QUEM acessou;
    `corpo.ip` (na linha `new`) e o IP de quem acessou;
  - `conn_id` liga as linhas de uma conexao, mas reinicia com o servico da maquina
    (nao e unico no longo prazo): a chave e (maquina, conn_id, inicio);
  - `session_id` e a sessao do lado de quem acessa (uma sessao abre varios conn_id:
    tela, janela de arquivos). Passa do limite do bigint: gravar como numeric(20);
  - alarme: campo `typ` (1 = mais de 30 erros do mesmo IP, 2 = mais de 6 em 1 min) e
    `info` e JSON EM TEXTO (precisa de um segundo json.loads) com id, ip e nome de quem
    errou a senha.

Ports and Adapters (Alistair Cockburn): este modulo e o nucleo; quem le o SFTP e quem
grava no banco sao adaptadores (rustdesk_source.py, rustdesk_sink.py).
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta
from typing import Any, Iterable, Mapping, Optional, Union

PATH_KIND = {
    "/api/audit/conn": "conn",
    "/api/audit/file": "file",
    "/api/audit/alarm": "alarm",
}
SYSINFO_PATH = "/api/sysinfo"

#: primary_auth do cliente 1.5.3.
AUTH_METHODS = {1: "aceito por clique", 2: "senha temporária", 3: "senha permanente", 4: "troca de lados"}
#: `type` do aviso de auth (NAO e o enum ConnType do proto).
CONN_TYPES = {0: "controle remoto", 1: "transferência de arquivos", 2: "port forward", 3: "câmera", 4: "terminal"}
#: `typ` do alarme.
ALARM_TYPES = {1: "mais de 30 senhas erradas do mesmo IP", 2: "mais de 6 senhas erradas em 1 minuto"}

#: Conexao sem auth nem alarme vira "tentativa" depois disso (o auth chega em segundos).
TENTATIVE_AFTER = timedelta(minutes=10)


@dataclass(frozen=True, slots=True)
class AuditEvent:
    """Um aviso de conexao, alarme ou arquivo (vai para rustdesk_audit_raw)."""

    line_hash: str
    received_at: datetime
    source_ip: Optional[str]
    path: str
    #: "conn" | "file" | "alarm" | "other"
    kind: str
    machine_id: Optional[str]
    conn_id: Optional[int]
    #: Em "conn": "new" | "auth" | "close". Nos outros tipos, None.
    action: Optional[str]
    peer_id: Optional[str]
    peer_name: Optional[str]
    peer_ip: Optional[str]
    primary_auth: Optional[int]
    conn_type: Optional[int]
    session_id: Optional[int]
    alarm_type: Optional[int]
    body: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class SysInfo:
    """Estado de uma maquina (`/api/sysinfo`): so atualiza rustdesk_machines."""

    machine_id: str
    received_at: datetime
    source_ip: Optional[str]
    hostname: Optional[str]
    #: Falta quando ninguem esta logado na maquina.
    username: Optional[str]
    os: Optional[str]
    version: Optional[str]
    cpu: Optional[str]
    memory: Optional[str]
    uuid: Optional[str]
    #: Ultimo usuario visto nesta maquina (preenchido por `latest_sysinfo`): a tela mostra
    #: "ninguem logado (ultimo: X)" em vez de fingir que X ainda esta la.
    last_username: Optional[str] = None


Parsed = Union[AuditEvent, SysInfo]


def line_hash(raw: str) -> str:
    """SHA-256 da linha sem o fim de linha: chave de deduplicacao (releitura e rotacao)."""
    return hashlib.sha256(raw.rstrip("\r\n").encode("utf-8")).hexdigest()


def _str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _int(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value)
    return None


def _alarm_info(value: Any) -> Mapping[str, Any]:
    """`info` do alarme e JSON dentro de uma string; aceita tambem um objeto ja pronto."""
    if isinstance(value, Mapping):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except ValueError:
            return {}
        return parsed if isinstance(parsed, Mapping) else {}
    return {}


def parse_line(raw: str) -> Optional[Parsed]:
    """
    Uma linha do avisos.jsonl -> AuditEvent ou SysInfo. None para linha vazia, JSON
    invalido, sem data, ou sysinfo sem id de maquina.
    """
    text = raw.strip()
    if not text:
        return None
    try:
        row = json.loads(text)
    except ValueError:
        return None
    if not isinstance(row, Mapping):
        return None
    try:
        received_at = datetime.fromisoformat(str(row.get("recebido_utc")))
    except ValueError:
        return None
    if received_at.tzinfo is None:
        return None
    path = str(row.get("caminho") or "")
    body = row.get("corpo") if isinstance(row.get("corpo"), Mapping) else {}
    source_ip = _str(row.get("ip_origem"))
    machine_id = _str(body.get("id"))

    if path == SYSINFO_PATH:
        if machine_id is None:
            return None
        return SysInfo(
            machine_id=machine_id,
            received_at=received_at,
            source_ip=source_ip,
            hostname=_str(body.get("hostname")),
            username=_str(body.get("username")),
            os=_str(body.get("os")),
            version=_str(body.get("version")),
            cpu=_str(body.get("cpu")),
            memory=_str(body.get("memory")),
            uuid=_str(body.get("uuid")),
        )

    kind = PATH_KIND.get(path, "other")
    action: Optional[str] = None
    peer_id = peer_name = peer_ip = None
    alarm_type = None
    if kind == "conn":
        raw_action = _str(body.get("action"))
        action = raw_action if raw_action in ("new", "close") else "auth"
        peer = body.get("peer")
        if isinstance(peer, list):
            peer_id = _str(peer[0]) if len(peer) > 0 else None
            peer_name = _str(peer[1]) if len(peer) > 1 else None
        if action == "new":
            peer_ip = _str(body.get("ip"))
    elif kind == "alarm":
        alarm_type = _int(body.get("typ"))
        info = _alarm_info(body.get("info"))
        peer_id, peer_ip, peer_name = _str(info.get("id")), _str(info.get("ip")), _str(info.get("name"))

    session_id = _int(body.get("session_id"))
    return AuditEvent(
        line_hash=line_hash(raw),
        received_at=received_at,
        source_ip=source_ip,
        path=path,
        kind=kind,
        machine_id=machine_id,
        conn_id=_int(body.get("conn_id")),
        action=action,
        peer_id=peer_id,
        peer_name=peer_name,
        peer_ip=peer_ip,
        primary_auth=_int(body.get("primary_auth")),
        conn_type=_int(body.get("type")) if kind == "conn" else None,
        # O `new` vem com session_id 0: e' "ainda nao sei", nao uma sessao.
        session_id=session_id if session_id else None,
        alarm_type=alarm_type,
        body=dict(body),
    )


@dataclass(frozen=True, slots=True)
class ParsedBatch:
    events: list[AuditEvent]
    sysinfos: list[SysInfo]
    #: Linhas que nao viraram nada (JSON quebrado, sem data...): so contadas no log.
    invalid: int


def parse_lines(lines: Iterable[str]) -> ParsedBatch:
    events: list[AuditEvent] = []
    sysinfos: list[SysInfo] = []
    invalid = 0
    for raw in lines:
        if not raw.strip():
            continue
        parsed = parse_line(raw)
        if isinstance(parsed, AuditEvent):
            events.append(parsed)
        elif isinstance(parsed, SysInfo):
            sysinfos.append(parsed)
        else:
            invalid += 1
    return ParsedBatch(events, sysinfos, invalid)


def latest_sysinfo(sysinfos: Iterable[SysInfo]) -> list[SysInfo]:
    """
    O sysinfo mais recente de cada maquina, com `last_username` = ultimo usuario visto
    no lote. `username` continua como veio (None = ninguem logado agora).
    """
    latest: dict[str, SysInfo] = {}
    last_user: dict[str, str] = {}
    for info in sorted(sysinfos, key=lambda s: s.received_at):
        if info.username:
            last_user[info.machine_id] = info.username
        latest[info.machine_id] = info
    return [replace(info, last_username=last_user.get(info.machine_id)) for info in latest.values()]


# ---- Sessoes ------------------------------------------------------------------

#: Status gravados em rustdesk_sessions.
STATUSES = ("concluida", "aberta", "bloqueada", "tentativa")


@dataclass(frozen=True, slots=True)
class RemoteSession:
    """Uma conexao de alguem a uma maquina, montada a partir dos avisos."""

    machine_id: str
    conn_id: int
    started_at: datetime
    authenticated_at: Optional[datetime]
    ended_at: Optional[datetime]
    peer_id: Optional[str]
    peer_name: Optional[str]
    peer_ip: Optional[str]
    primary_auth: Optional[int]
    conn_type: Optional[int]
    session_id: Optional[int]
    alarm_type: Optional[int]
    #: concluida (entrou e saiu) | aberta (entrou, sem close ainda) |
    #: bloqueada (alarme de senha, sem entrar) | tentativa (nao entrou, sem alarme)
    status: str


#: Ordem dos avisos que chegam no mesmo segundo (o new e o auth costumam vir juntos).
_ACTION_ORDER = {"new": 0, "auth": 1, None: 2, "close": 3}


class _Builder:
    __slots__ = (
        "machine_id", "conn_id", "started_at", "authenticated_at", "ended_at", "peer_id",
        "peer_name", "peer_ip", "primary_auth", "conn_type", "session_id", "alarm_type",
    )

    def __init__(self, machine_id: str, conn_id: int, started_at: datetime) -> None:
        self.machine_id, self.conn_id, self.started_at = machine_id, conn_id, started_at
        self.authenticated_at = self.ended_at = None
        self.peer_id = self.peer_name = self.peer_ip = None
        self.primary_auth = self.conn_type = self.session_id = self.alarm_type = None

    def absorb(self, e: AuditEvent) -> None:
        if e.kind == "alarm":
            self.alarm_type = e.alarm_type
        elif e.action == "auth" and self.authenticated_at is None:
            self.authenticated_at = e.received_at
            self.primary_auth, self.conn_type = e.primary_auth, e.conn_type
        elif e.action == "close":
            self.ended_at = e.received_at
        # Quem acessou: o auth traz ID e nome, o new traz o IP, o alarme traz os tres.
        self.peer_id = self.peer_id or e.peer_id
        self.peer_name = self.peer_name or e.peer_name
        self.peer_ip = self.peer_ip or e.peer_ip
        self.session_id = self.session_id or e.session_id

    def build(self, now: datetime) -> RemoteSession:
        if self.authenticated_at is not None:
            status = "concluida" if self.ended_at is not None else "aberta"
        elif self.alarm_type is not None:
            status = "bloqueada"
        elif self.ended_at is not None or now - self.started_at > TENTATIVE_AFTER:
            status = "tentativa"
        else:
            status = "aberta"  # o auth pode estar a caminho
        return RemoteSession(
            machine_id=self.machine_id,
            conn_id=self.conn_id,
            started_at=self.started_at,
            authenticated_at=self.authenticated_at,
            ended_at=self.ended_at,
            peer_id=self.peer_id,
            peer_name=self.peer_name,
            peer_ip=self.peer_ip,
            primary_auth=self.primary_auth,
            conn_type=self.conn_type,
            session_id=self.session_id,
            alarm_type=self.alarm_type,
            status=status,
        )


def build_sessions(events: Iterable[AuditEvent], now: datetime) -> list[RemoteSession]:
    """
    Junta os avisos de conexao e alarme em sessoes, por (maquina, conn_id):
      - `new` abre; um `new` com o mesmo conn_id de uma sessao ainda aberta significa
        que o servico da maquina reiniciou (o contador voltou): a anterior e fechada
        como esta (fica "aberta"/sem encerramento, que e o que de fato se sabe);
      - auth/alarme sem `new` antes (perdido ou fora da janela) abrem a sessao no
        proprio horario; `close` sem sessao aberta e ignorado;
      - `close` encerra.
    Avisos de arquivo e outros nao entram. Devolve em ordem de inicio.
    """
    relevant = [
        e for e in events
        if e.kind in ("conn", "alarm") and e.machine_id is not None and e.conn_id is not None
    ]
    relevant.sort(key=lambda e: (e.received_at, _ACTION_ORDER.get(e.action, 2)))

    open_sessions: dict[tuple[str, int], _Builder] = {}
    done: list[RemoteSession] = []
    for e in relevant:
        key = (e.machine_id, e.conn_id)  # type: ignore[assignment]
        if e.action == "new":
            previous = open_sessions.pop(key, None)
            if previous is not None:
                done.append(previous.build(now))
            builder = _Builder(e.machine_id, e.conn_id, e.received_at)  # type: ignore[arg-type]
            builder.absorb(e)
            open_sessions[key] = builder
            continue
        builder = open_sessions.get(key)
        if builder is None:
            if e.action == "close":
                continue
            builder = _Builder(e.machine_id, e.conn_id, e.received_at)  # type: ignore[arg-type]
            open_sessions[key] = builder
        builder.absorb(e)
        if e.action == "close":
            done.append(open_sessions.pop(key).build(now))
    done.extend(b.build(now) for b in open_sessions.values())
    return sorted(done, key=lambda s: (s.started_at, s.machine_id, s.conn_id))
