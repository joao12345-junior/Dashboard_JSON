# api/collector/sinks.py
"""
Portas de saida do coletor (Ports and Adapters, Alistair Cockburn).

`EventSink` e a PORTA: o contrato "gravar um lote de eventos". O receptor UDP
so conhece esse contrato. `PostgresEventSink` e um ADAPTADOR (grava no
optsislog.network_events); nos testes usa-se um sink em memoria. Trocar o
destino nao exige mexer no receptor.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol, Sequence

from .cef_parser import NetworkEvent


class EventSink(Protocol):
    """Contrato de gravacao. Deve levantar excecao se o lote nao foi gravado."""

    def write_batch(self, events: Sequence[NetworkEvent]) -> None: ...

    def close(self) -> None: ...


class PostgresEventSink:
    """
    Grava em optsislog.network_events com conexao PROPRIA (nao usa o pool do
    Flask: o coletor e outro processo e nao deve disputar conexoes da API).
    A conexao e aberta sob demanda e descartada em qualquer erro, para a
    proxima tentativa reconectar do zero.
    """

    _INSERT = """
        INSERT INTO optsislog.network_events
            (source_ip, event_time, cef_version, device_vendor, device_product,
             device_version, signature_id, name, severity, extension, raw)
        VALUES %s
    """

    def __init__(self) -> None:
        from dotenv import load_dotenv

        # api/.env, mesmo arquivo da API Flask (o coletor roda com cwd em api/,
        # mas ancorar no arquivo evita depender disso).
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
        self._kwargs = {
            "host": os.getenv("DB_HOST"),
            "port": os.getenv("DB_PORT"),
            "dbname": os.getenv("DB_NAME"),
            "user": os.getenv("DB_USER"),
            "password": os.getenv("DB_PASSWORD"),
            "sslmode": os.getenv("DB_SSLMODE", "require"),
            "connect_timeout": 10,
        }
        self._conn = None

    def write_batch(self, events: Sequence[NetworkEvent]) -> None:
        if not events:
            return
        import psycopg2
        from psycopg2.extras import Json, execute_values

        rows = [
            (
                e.source_ip,
                e.event_time,
                e.cef_version,
                e.device_vendor,
                e.device_product,
                e.device_version,
                e.signature_id,
                e.name,
                e.severity,
                Json(e.extension),
                e.raw,
            )
            for e in events
        ]
        try:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg2.connect(**self._kwargs)
            with self._conn.cursor() as cur:
                execute_values(cur, self._INSERT, rows)
            self._conn.commit()
        except Exception:
            self.close()
            raise

    def close(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None
