# api/collector/rustdesk_source.py
"""
Leitura incremental do `avisos.jsonl` do VPS do RustDesk (porta de ENTRADA).

`RemoteFiles` e a PORTA ("quanto mede este arquivo, me de os bytes a partir de X");
`SftpRemoteFiles` e o ADAPTADOR SFTP (paramiko). A regra de offset e rotacao fica em
`read_new_lines`, testada com arquivos em memoria.

Regras do VPS (27/11): logrotate semanal com `create` + `delaycompress`. O arquivo
rotacionado fica legivel como `avisos.jsonl.1` ate a rotacao seguinte; o receptor
reabre o arquivo a cada aviso, entao nada se perde. O firewall limita a porta 22
(mais de 6 conexoes em 30 s do mesmo IP sao bloqueadas): UMA conexao por ciclo e,
em erro, espera o proximo ciclo. Nunca reconectar em laco.

SOMENTE LEITURA: o usuario `logreader` so tem SFTP `-R`; este modulo so abre arquivos
para leitura.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Optional, Protocol

#: Bytes do inicio do arquivo usados para reconhecer que ele foi trocado (rotacao).
HEAD_BYTES = 256
AUDIT_FILE = "avisos.jsonl"


class RemoteFiles(Protocol):
    def size(self, name: str) -> Optional[int]:
        """Tamanho em bytes, ou None se o arquivo nao existe."""
        ...

    def read(self, name: str, offset: int, length: Optional[int] = None) -> bytes:
        """Bytes a partir de `offset` (ate o fim, ou `length` bytes)."""
        ...


@dataclass(frozen=True, slots=True)
class FileState:
    """Onde a leitura parou num arquivo, e a "impressao digital" do inicio dele."""

    offset: int
    head_hash: Optional[str]
    #: Quantos bytes entraram no hash. Arquivo ainda pequeno cresce DEPOIS desse trecho:
    #: comparar sempre os mesmos bytes evita confundir "cresceu" com "foi trocado".
    head_len: int = 0


def head_hash(files: RemoteFiles, name: str, length: Optional[int] = None) -> tuple[Optional[str], int]:
    """(hash dos primeiros `length` bytes, ou ate HEAD_BYTES; bytes usados)."""
    size = files.size(name)
    if not size:
        return None, 0
    used = min(length if length else HEAD_BYTES, HEAD_BYTES, size)
    return hashlib.sha256(files.read(name, 0, used)).hexdigest(), used


def _complete_lines(data: bytes, *, allow_partial_tail: bool) -> tuple[list[str], int]:
    """
    Linhas completas de `data` e quantos bytes foram consumidos. A ultima linha sem
    "\\n" fica para o proximo ciclo (o receptor pode estar no meio da escrita), exceto
    em arquivo que ja foi rotacionado (`allow_partial_tail`), que nao cresce mais.
    """
    if allow_partial_tail:
        consumed = len(data)
    else:
        cut = data.rfind(b"\n")
        consumed = cut + 1 if cut >= 0 else 0
    text = data[:consumed].decode("utf-8", errors="replace")
    return [line for line in text.splitlines() if line.strip()], consumed


@dataclass(frozen=True, slots=True)
class ReadResult:
    lines: list[str]
    state: FileState
    #: Rotacao detectada neste ciclo (para o log).
    rotated: bool


def read_new_lines(files: RemoteFiles, previous: Optional[FileState], name: str = AUDIT_FILE) -> ReadResult:
    """
    Linhas novas de `name` desde `previous`:
      - primeira leitura (sem estado): le o `.1` inteiro (a semana anterior) e o atual;
      - arquivo trocado (menor que o offset, ou o inicio mudou): termina de ler o `.1`
        a partir do offset antigo e recomeca o atual do zero;
      - normal: le do offset ate a ultima linha completa.
    A deduplicacao por hash de linha (no banco) torna seguro reler um trecho.
    """
    size = files.size(name)
    lines: list[str] = []
    rotated_name = f"{name}.1"

    if previous is None:
        if files.size(rotated_name):
            old, _ = _complete_lines(files.read(rotated_name, 0), allow_partial_tail=True)
            lines.extend(old)
        offset, rotated = 0, False
    else:
        current_head, _ = head_hash(files, name, previous.head_len or None)
        rotated = size is not None and (
            size < previous.offset
            or (previous.head_hash is not None and current_head is not None and current_head != previous.head_hash)
        )
        offset = previous.offset
        if rotated:
            # O que faltava da semana anterior esta no .1, a partir do offset antigo.
            rot_size = files.size(rotated_name) or 0
            if rot_size > previous.offset:
                tail, _ = _complete_lines(files.read(rotated_name, previous.offset), allow_partial_tail=True)
                lines.extend(tail)
            offset = 0

    if not size:
        return ReadResult(lines, FileState(0, None, 0), rotated)
    if size > offset:
        new, consumed = _complete_lines(files.read(name, offset), allow_partial_tail=False)
        lines.extend(new)
        offset += consumed
    digest, used = head_hash(files, name)
    return ReadResult(lines, FileState(offset, digest, used), rotated)


class SftpRemoteFiles:
    """
    Adaptador SFTP (paramiko). Use com `with`: abre UMA conexao e fecha no fim.
    A chave do host e fixada (`RejectPolicy` + known_hosts proprio): host desconhecido
    ou trocado = erro, nunca aceita sozinho.
    """

    def __init__(
        self,
        host: str,
        user: str,
        key_path: str,
        known_hosts_path: str,
        *,
        base_dir: str = "/rustdesk-audit",
        port: int = 22,
        timeout: float = 20.0,
    ) -> None:
        self._host, self._user, self._port = host, user, port
        self._key_path, self._known_hosts = key_path, known_hosts_path
        self._base = base_dir.rstrip("/")
        self._timeout = timeout
        self._client = None
        self._sftp = None

    def __enter__(self) -> "SftpRemoteFiles":
        import paramiko

        client = paramiko.SSHClient()
        client.load_host_keys(self._known_hosts)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(
            self._host,
            port=self._port,
            username=self._user,
            key_filename=self._key_path,
            look_for_keys=False,
            allow_agent=False,
            timeout=self._timeout,
            banner_timeout=self._timeout,
            auth_timeout=self._timeout,
        )
        self._client = client
        self._sftp = client.open_sftp()
        return self

    def __exit__(self, *_exc: object) -> None:
        for closable in (self._sftp, self._client):
            try:
                if closable is not None:
                    closable.close()
            except Exception:
                pass
        self._sftp = self._client = None

    def _path(self, name: str) -> str:
        return f"{self._base}/{name}" if self._base else name

    def size(self, name: str) -> Optional[int]:
        try:
            return int(self._sftp.stat(self._path(name)).st_size)  # type: ignore[union-attr]
        except FileNotFoundError:
            return None
        except IOError as e:  # paramiko levanta IOError(errno 2) para arquivo ausente
            if getattr(e, "errno", None) == 2:
                return None
            raise

    def read(self, name: str, offset: int, length: Optional[int] = None) -> bytes:
        with self._sftp.open(self._path(name), "rb") as f:  # type: ignore[union-attr]
            f.seek(offset)
            if length is None:
                f.prefetch()
                return f.read()
            return f.read(length)
