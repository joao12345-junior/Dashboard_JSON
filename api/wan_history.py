# api/wan_history.py
"""
Historico dos links de internet (grafico "Internet") e de CPU/memoria dos
dispositivos UniFi, ambos do Rede > Painel.

Repository (Repository Pattern): todo o SQL de leitura de optsislog.network_wan_samples
fica aqui. Recebe o cursor e nao abre conexao, entao a rota fica fina e isto e'
testavel sem banco (test_wan_history.py). As amostras sao gravadas pelo poller
(collector/state_sinks.py, append_wan_samples).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class WanPeriod:
    """Uma opcao de periodo do grafico."""

    key: str
    #: Quanto tempo para tras, em segundos.
    span_seconds: int
    #: Tamanho de cada ponto do grafico (media das amostras dentro dele), em segundos.
    step_seconds: int


# Cerca de 60 a 360 pontos por linha em qualquer periodo: o bastante para ver
# picos sem mandar 43 mil amostras para o navegador no periodo de um mes.
PERIODS: dict[str, WanPeriod] = {
    "1h": WanPeriod("1h", 3600, 60),
    "1d": WanPeriod("1d", 86400, 300),
    "1w": WanPeriod("1w", 7 * 86400, 1800),
    "1m": WanPeriod("1m", 30 * 86400, 7200),
}
DEFAULT_PERIOD = "1d"


def resolve_period(value: str | None) -> WanPeriod:
    """Periodo pedido na query string; desconhecido ou vazio = 1 dia."""
    return PERIODS.get((value or "").strip().lower(), PERIODS[DEFAULT_PERIOD])


# PostgreSQL 13 nao tem date_bin (veio no 14): o "balde" e' calculado pelo epoch.
_HISTORY_SQL = """
    SELECT wan_group,
           to_timestamp(floor(extract(epoch FROM sampled_at) / %(step)s) * %(step)s) AS bucket,
           avg(rx_bps)::bigint AS rx_bps,
           max(rx_bps)         AS rx_bps_max,
           avg(tx_bps)::bigint AS tx_bps,
           max(tx_bps)         AS tx_bps_max,
           avg(latency_ms)     AS latency_ms,
           max(latency_ms)     AS latency_ms_max,
           count(*)                                   AS samples,
           count(*) FILTER (WHERE is_up IS FALSE)     AS down_samples
    FROM optsislog.network_wan_samples
    WHERE sampled_at >= now() - make_interval(secs => %(span)s)
    GROUP BY wan_group, bucket
    ORDER BY wan_group, bucket
"""


# Perda de pacotes vem em intervalos de 5 min do UniFi: o balde e' no minimo 5 min,
# senao 4 de cada 5 baldes de 1 min ficariam vazios.
_QUALITY_SQL = """
    SELECT wan_group,
           to_timestamp(floor(extract(epoch FROM sampled_at) / %(step)s) * %(step)s) AS bucket,
           avg(packet_loss_pct) AS packet_loss_pct,
           max(packet_loss_pct) AS packet_loss_max
    FROM optsislog.network_wan_quality
    WHERE sampled_at >= now() - make_interval(secs => %(span)s)
    GROUP BY wan_group, bucket
    ORDER BY wan_group, bucket
"""
QUALITY_MIN_STEP_SECONDS = 300


def fetch_quality(cur, period: WanPeriod) -> dict[str, list[dict[str, Any]]]:
    """Perda de pacotes por WAN ({wan: [{t, packet_loss_pct, packet_loss_max}]})."""
    step = max(period.step_seconds, QUALITY_MIN_STEP_SECONDS)
    cur.execute(_QUALITY_SQL, {"step": step, "span": period.span_seconds})
    quality: dict[str, list[dict[str, Any]]] = {}
    for row in cur.fetchall():
        quality.setdefault(row["wan_group"], []).append(
            {
                "t": row["bucket"].isoformat(),
                "packet_loss_pct": _round(row["packet_loss_pct"]),
                "packet_loss_max": _round(row["packet_loss_max"]),
            }
        )
    return quality


def fetch_history(cur, period: WanPeriod) -> dict[str, Any]:
    """
    Pontos agregados por WAN. `cur` deve devolver dicts (RealDictCursor).
    Devolve {"period", "step_seconds", "span_seconds", "server_time", "series": {wan: [ponto...]}}.
    Baldes sem amostra NAO vem (o front mostra como buraco na linha, que e' o certo:
    sem amostra = poller parado, nao "trafego zero").
    """
    cur.execute("SELECT now() AS server_time")
    server_time = cur.fetchone()["server_time"]
    cur.execute(_HISTORY_SQL, {"step": period.step_seconds, "span": period.span_seconds})
    series: dict[str, list[dict[str, Any]]] = {}
    for row in cur.fetchall():
        point = {
            "t": row["bucket"].isoformat(),
            "rx_bps": _int(row["rx_bps"]),
            "rx_bps_max": _int(row["rx_bps_max"]),
            "tx_bps": _int(row["tx_bps"]),
            "tx_bps_max": _int(row["tx_bps_max"]),
            "latency_ms": _round(row["latency_ms"]),
            "latency_ms_max": _round(row["latency_ms_max"]),
            "samples": int(row["samples"]),
            "down_samples": int(row["down_samples"]),
        }
        series.setdefault(row["wan_group"], []).append(point)
    return {
        "period": period.key,
        "step_seconds": period.step_seconds,
        "span_seconds": period.span_seconds,
        "server_time": server_time.isoformat(),
        "series": series,
    }


def _int(value: Any) -> int | None:
    return None if value is None else int(value)


def _round(value: Any) -> float | None:
    return None if value is None else round(float(value), 1)


_DEVICE_HISTORY_SQL = """
    SELECT to_timestamp(floor(extract(epoch FROM sampled_at) / %(step)s) * %(step)s) AS bucket,
           avg(cpu_pct)    AS cpu_pct,
           max(cpu_pct)    AS cpu_pct_max,
           avg(memory_pct) AS memory_pct,
           max(memory_pct) AS memory_pct_max,
           count(*)        AS samples
    FROM optsislog.network_device_samples
    WHERE mac = %(mac)s AND sampled_at >= now() - make_interval(secs => %(span)s)
    GROUP BY bucket
    ORDER BY bucket
"""


def fetch_device_history(cur, period: WanPeriod, mac: str) -> dict[str, Any]:
    """
    CPU e memoria de UM dispositivo, agregados como o historico da WAN (mesmos
    periodos e baldes). Devolve {"period", "step_seconds", "span_seconds",
    "server_time", "mac", "points": [...]}.
    """
    cur.execute("SELECT now() AS server_time")
    server_time = cur.fetchone()["server_time"]
    cur.execute(
        _DEVICE_HISTORY_SQL,
        {"step": period.step_seconds, "span": period.span_seconds, "mac": mac},
    )
    points = [
        {
            "t": row["bucket"].isoformat(),
            "cpu_pct": _round(row["cpu_pct"]),
            "cpu_pct_max": _round(row["cpu_pct_max"]),
            "memory_pct": _round(row["memory_pct"]),
            "memory_pct_max": _round(row["memory_pct_max"]),
            "samples": int(row["samples"]),
        }
        for row in cur.fetchall()
    ]
    return {
        "period": period.key,
        "step_seconds": period.step_seconds,
        "span_seconds": period.span_seconds,
        "server_time": server_time.isoformat(),
        "mac": mac,
        "points": points,
    }
