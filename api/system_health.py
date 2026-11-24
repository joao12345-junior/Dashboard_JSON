# system_health.py
"""
Fotografia da saude do proprio LogDash: quando foi o ultimo dado de cada
componente. Repository: so' SQL, recebe cursor, sem importar `db` (testavel sem banco).

Por que devolvemos tambem `server_time` (now() do banco): quem decide se um
componente esta atrasado compara "agora" com "ultimo dado"; usar o relogio do
navegador faria um PC com a hora errada mostrar tudo como parado (ou tudo em dia).

Cada leitura usa `ORDER BY id DESC LIMIT 1` (indice da chave primaria): o id cresce
junto com a insercao, entao a ultima linha e' o ultimo dado, sem varrer a tabela.
"""
from __future__ import annotations

from typing import Any

SNAPSHOT_KEYS = (
    "server_time",
    "unifi_poller",
    "site_check",
    "network_events",
    "app_logs",
    "windows_logs",
    "process_logs",
)


def fetch_snapshot(cur: Any) -> dict[str, str | None]:
    """Devolve {chave: ISO 8601 ou None}. `cur` deve ser RealDictCursor."""
    cur.execute(
        """
        SELECT
            now() AS server_time,
            (SELECT max(last_polled_at) FROM optsislog.network_devices) AS unifi_poller,
            (SELECT checked_at FROM optsislog.site_availability ORDER BY id DESC LIMIT 1) AS site_check,
            (SELECT created_at FROM optsislog.network_events ORDER BY id DESC LIMIT 1) AS network_events,
            (SELECT coletado_em FROM optsislog.app_logs ORDER BY id DESC LIMIT 1) AS app_logs,
            (SELECT created_at FROM optsislog.windows_event_logs ORDER BY id DESC LIMIT 1) AS windows_logs,
            (SELECT created_at FROM optsislog.process_logs ORDER BY id DESC LIMIT 1) AS process_logs
        """
    )
    row = cur.fetchone()
    return {
        key: (row[key].isoformat() if row.get(key) is not None else None)
        for key in SNAPSHOT_KEYS
    }
