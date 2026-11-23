# api/collector/cef_parser.py
"""
Parser de mensagens syslog em formato CEF (Common Event Format).

O UniFi (Activity Logging > SIEM Server) exporta eventos assim:

    <PRI>Nov 23 16:00:00 host CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|key=value key=value ...

Funcoes puras, sem I/O: so recebem texto e devolvem <see cref="NetworkEvent"/>.
Isso deixa o parser testavel sem rede nem banco (Ports and Adapters: o parser
e o "miolo"; o socket UDP e o Postgres sao adaptadores nas pontas).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

# Limites defensivos: uma mensagem maluca nao pode encher o banco.
MAX_RAW_CHARS = 8192
MAX_VALUE_CHARS = 2000
MAX_NAME_CHARS = 500

_SEVERITY_BY_WORD = {
    "unknown": 0,
    "low": 3,
    "medium": 6,
    "high": 8,
    "very-high": 10,
    "veryhigh": 10,
}

# Chave de extension: token seguido de "=" e precedido de inicio/espaco.
# O lookbehind evita casar "b=" dentro de "a\=b" ou no meio de um valor.
_EXT_KEY = re.compile(r"(?:^|(?<=\s))([A-Za-z0-9_.\[\]-]+)=")
_EXT_ESCAPE = re.compile(r"\\([\\=nr])")
_SYSLOG_PRI = re.compile(r"^<\d{1,3}>")


@dataclass(frozen=True, slots=True)
class NetworkEvent:
    """Um evento de rede ja interpretado (imutavel, no espirito de um record)."""

    raw: str
    source_ip: str | None
    cef_version: str | None = None
    device_vendor: str | None = None
    device_product: str | None = None
    device_version: str | None = None
    signature_id: str | None = None
    name: str | None = None
    severity: int | None = None
    extension: dict[str, str] = field(default_factory=dict)
    event_time: datetime | None = None


def _split_header(text: str) -> tuple[list[str], str] | None:
    """
    Separa os 7 campos do cabecalho CEF (separados por "|") do resto
    (extension). "\\|" e "\\\\" dentro de um campo sao escapes. Devolve None
    se nao houver 7 campos completos.
    """
    fields: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(text)
    while i < n and len(fields) < 7:
        c = text[i]
        if c == "\\" and i + 1 < n and text[i + 1] in "|\\":
            buf.append(text[i + 1])
            i += 2
        elif c == "|":
            fields.append("".join(buf))
            buf = []
            i += 1
        else:
            buf.append(c)
            i += 1
    if len(fields) < 7:
        return None
    return fields, text[i:]


def _unescape_value(value: str) -> str:
    def repl(m: re.Match[str]) -> str:
        ch = m.group(1)
        return {"n": "\n", "r": "\r"}.get(ch, ch)

    return _EXT_ESCAPE.sub(repl, value)


def _parse_extension(text: str) -> dict[str, str]:
    """
    Le "k1=v1 k2=v2 com espacos k3=v3". Valores podem ter espacos: o valor vai
    ate a proxima chave. Limitacao inerente ao CEF: um valor que contenha algo
    como " x=y" sera confundido com uma chave nova.
    """
    matches = list(_EXT_KEY.finditer(text))
    result: dict[str, str] = {}
    for idx, m in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        value = _unescape_value(text[m.end():end].rstrip())
        result[m.group(1)] = value[:MAX_VALUE_CHARS]
    return result


def _parse_severity(value: str) -> int | None:
    value = value.strip().lower()
    if value.isdigit():
        return int(value)
    return _SEVERITY_BY_WORD.get(value)


def _parse_event_time(extension: dict[str, str]) -> datetime | None:
    """
    Hora do evento. Ordem: `rt` e `start` do CEF (milissegundos desde 1970, UTC)
    e, se nao houver, `UNIFIutcTime` -- o UniFi (UCG Ultra) NAO manda `rt`, so
    esse campo em ISO 8601 com "Z" (ex.: 2026-11-23T19:17:27.382Z).
    """
    for key in ("rt", "start"):
        raw = extension.get(key)
        if raw and raw.isdigit():
            try:
                return datetime.fromtimestamp(int(raw) / 1000, tz=timezone.utc)
            except (OverflowError, OSError, ValueError):
                continue
    iso = extension.get("UNIFIutcTime")
    if iso:
        try:
            # fromisoformat (Python < 3.11) nao aceita o sufixo "Z".
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            return None
    return None


def parse_syslog_line(raw: str, source_ip: str | None) -> NetworkEvent:
    """
    Interpreta uma mensagem syslog. Se tiver um cabecalho CEF valido, preenche
    os campos; se nao tiver (syslog comum, mensagem truncada), guarda a linha
    em `name` e em `raw` para nao perder o evento.
    """
    raw = raw.strip()[:MAX_RAW_CHARS]
    idx = raw.find("CEF:")
    if idx != -1:
        split = _split_header(raw[idx + 4:])
        if split is not None:
            header, ext_text = split
            extension = _parse_extension(ext_text)
            return NetworkEvent(
                raw=raw,
                source_ip=source_ip,
                cef_version=header[0] or None,
                device_vendor=header[1] or None,
                device_product=header[2] or None,
                device_version=header[3] or None,
                signature_id=header[4] or None,
                name=header[5][:MAX_NAME_CHARS] or None,
                severity=_parse_severity(header[6]),
                extension=extension,
                event_time=_parse_event_time(extension),
            )
    # Nao e CEF: tira so o <PRI> do inicio para o texto ficar legivel.
    text = _SYSLOG_PRI.sub("", raw, count=1).strip()
    return NetworkEvent(raw=raw, source_ip=source_ip, name=text[:MAX_NAME_CHARS] or None)
