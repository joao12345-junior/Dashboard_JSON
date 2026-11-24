# api/collector/state_sinks.py
"""
Porta de SAIDA do poller (Ports and Adapters, Alistair Cockburn).

`StateSink` e a PORTA: "grave este retrato da rede". `PostgresStateSink` e o
ADAPTADOR que grava em optsislog.network_devices / network_clients, tudo numa
transacao (ou grava o ciclo inteiro ou nada).
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Protocol, Sequence

from .client_sessions import OpenSession, plan_sessions
from .unifi_mapper import AppUsage, NetworkClient, NetworkDevice, VpnClient, WanLink, WanQualityPoint

#: Clientes sem atividade ha mais que isso saem da tabela.
CLIENT_RETENTION_DAYS = 30
#: Amostras de WAN (grafico de internet) mais antigas que isso sao apagadas.
WAN_SAMPLE_RETENTION_DAYS = 31


class StateSink(Protocol):
    """Deve levantar excecao se o retrato nao foi gravado."""

    def replace_snapshot(
        self,
        devices: Sequence[NetworkDevice],
        clients: Sequence[NetworkClient],
        polled_at: datetime,
    ) -> None: ...

    def replace_wans(self, wans: Sequence[WanLink], polled_at: datetime) -> None: ...

    def append_wan_samples(self, wans: Sequence[WanLink], polled_at: datetime) -> None:
        """Acrescenta uma amostra por WAN ao historico (grafico de internet)."""
        ...

    def replace_vpn_clients(self, clients: Sequence[VpnClient], polled_at: datetime) -> None:
        """Grava os usuarios de VPN conectados agora; os ausentes viram desconectados."""
        ...

    def replace_top_apps(self, period: str, apps: Sequence[AppUsage], fetched_at: datetime) -> None:
        """Substitui o ranking de aplicativos de um periodo."""
        ...

    def append_device_samples(self, devices: Sequence[NetworkDevice], polled_at: datetime) -> None:
        """Acrescenta CPU/memoria de cada dispositivo ao historico."""
        ...

    def upsert_wan_quality(self, points: Sequence[WanQualityPoint]) -> None:
        """Grava/atualiza os pontos de perda de pacotes (chave: WAN + horario)."""
        ...

    def close(self) -> None: ...


class PostgresStateSink:
    """Conexao PROPRIA (nao usa o pool do Flask), aberta sob demanda e descartada em erro."""

    _UPSERT_DEVICES = """
        INSERT INTO optsislog.network_devices
            (mac, unifi_id, name, model, ip_address, state, firmware_version,
             firmware_updatable, features, uptime_sec, cpu_pct, memory_pct,
             uplink_tx_bps, uplink_rx_bps, last_heartbeat_at, last_polled_at)
        VALUES %s
        ON CONFLICT (mac) DO UPDATE SET
            unifi_id = EXCLUDED.unifi_id, name = EXCLUDED.name, model = EXCLUDED.model,
            ip_address = EXCLUDED.ip_address, state = EXCLUDED.state,
            firmware_version = EXCLUDED.firmware_version,
            firmware_updatable = EXCLUDED.firmware_updatable, features = EXCLUDED.features,
            uptime_sec = EXCLUDED.uptime_sec, cpu_pct = EXCLUDED.cpu_pct,
            memory_pct = EXCLUDED.memory_pct, uplink_tx_bps = EXCLUDED.uplink_tx_bps,
            uplink_rx_bps = EXCLUDED.uplink_rx_bps,
            last_heartbeat_at = EXCLUDED.last_heartbeat_at,
            last_polled_at = EXCLUDED.last_polled_at
    """

    _UPSERT_CLIENTS = """
        INSERT INTO optsislog.network_clients
            (mac, name, hostname, note, ip_address, vendor, is_wired, is_guest,
             network_name, uplink_mac, ssid, signal_dbm, tx_bytes, rx_bytes,
             connected_since, first_seen_at, connected, disconnected_at, last_seen_at)
        VALUES %s
        ON CONFLICT (mac) DO UPDATE SET
            name = EXCLUDED.name, hostname = EXCLUDED.hostname, note = EXCLUDED.note,
            ip_address = EXCLUDED.ip_address, vendor = EXCLUDED.vendor,
            is_wired = EXCLUDED.is_wired, is_guest = EXCLUDED.is_guest,
            network_name = EXCLUDED.network_name, uplink_mac = EXCLUDED.uplink_mac,
            ssid = EXCLUDED.ssid, signal_dbm = EXCLUDED.signal_dbm,
            tx_bytes = EXCLUDED.tx_bytes, rx_bytes = EXCLUDED.rx_bytes,
            connected_since = EXCLUDED.connected_since,
            first_seen_at = COALESCE(EXCLUDED.first_seen_at, optsislog.network_clients.first_seen_at),
            connected = true, disconnected_at = NULL, last_seen_at = EXCLUDED.last_seen_at
    """

    def __init__(self) -> None:
        from .db_config import connection_kwargs

        self._kwargs = connection_kwargs()
        self._conn = None

    def replace_snapshot(
        self,
        devices: Sequence[NetworkDevice],
        clients: Sequence[NetworkClient],
        polled_at: datetime,
    ) -> None:
        import psycopg2
        from psycopg2.extras import Json, execute_values

        # Um MAC repetido no mesmo INSERT ... ON CONFLICT daria erro: fica o ultimo.
        devices_by_mac = {d.mac: d for d in devices}
        clients_by_mac = {c.mac: c for c in clients}

        device_rows = [
            (
                d.mac, d.unifi_id, d.name, d.model, d.ip_address, d.state,
                d.firmware_version, d.firmware_updatable, Json(list(d.features)),
                d.uptime_sec, d.cpu_pct, d.memory_pct, d.uplink_tx_bps,
                d.uplink_rx_bps, d.last_heartbeat_at, polled_at,
            )
            for d in devices_by_mac.values()
        ]
        client_rows = [
            (
                c.mac, c.name, c.hostname, c.note, c.ip_address, c.vendor,
                c.is_wired, c.is_guest, c.network_name, c.uplink_mac, c.ssid,
                c.signal_dbm, c.tx_bytes, c.rx_bytes, c.connected_since,
                c.first_seen_at, True, None, polled_at,
            )
            for c in clients_by_mac.values()
        ]
        try:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg2.connect(**self._kwargs)
            with self._conn.cursor() as cur:
                if device_rows:
                    execute_values(cur, self._UPSERT_DEVICES, device_rows)
                # Dispositivo que sumiu da API foi removido do site.
                cur.execute(
                    "DELETE FROM optsislog.network_devices WHERE mac <> ALL(%s::text[])",
                    (list(devices_by_mac),),
                )
                if client_rows:
                    execute_values(cur, self._UPSERT_CLIENTS, client_rows)
                # Quem nao veio neste ciclo desconectou (a hora e a em que notamos).
                cur.execute(
                    """
                    UPDATE optsislog.network_clients
                       SET connected = false, disconnected_at = %s
                     WHERE connected AND mac <> ALL(%s::text[])
                    """,
                    (polled_at, list(clients_by_mac)),
                )
                cur.execute(
                    "DELETE FROM optsislog.network_clients WHERE last_seen_at < %s",
                    (polled_at - timedelta(days=CLIENT_RETENTION_DAYS),),
                )
                self._write_sessions(cur, clients_by_mac.values(), polled_at)
            self._conn.commit()
        except Exception:
            self.close()
            raise

    @staticmethod
    def _write_sessions(cur, clients, polled_at: datetime) -> None:
        """Historico de conexoes: a regra esta em `plan_sessions` (pura, testada)."""
        from psycopg2.extras import execute_values

        cur.execute(
            "SELECT id, mac, connected_at FROM optsislog.network_client_sessions"
            " WHERE disconnected_at IS NULL"
        )
        open_sessions = {mac: OpenSession(id_, mac, at) for id_, mac, at in cur.fetchall()}
        plan = plan_sessions(open_sessions, clients, polled_at)
        if plan.to_close:
            execute_values(
                cur,
                """
                UPDATE optsislog.network_client_sessions s
                   SET disconnected_at = GREATEST(v.at, s.connected_at)
                  FROM (VALUES %s) AS v(id, at)
                 WHERE s.id = v.id
                """,
                [(c.id, c.disconnected_at) for c in plan.to_close],
                template="(%s::bigint, %s::timestamptz)",
            )
        if plan.to_open:
            execute_values(
                cur,
                "INSERT INTO optsislog.network_client_sessions"
                " (mac, connected_at, uplink_mac, ip_address) VALUES %s",
                [(s.mac, s.connected_at, s.uplink_mac, s.ip_address) for s in plan.to_open],
            )
        cur.execute(
            "DELETE FROM optsislog.network_client_sessions"
            " WHERE disconnected_at IS NOT NULL AND disconnected_at < %s",
            (polled_at - timedelta(days=CLIENT_RETENTION_DAYS),),
        )

    def replace_wans(self, wans: Sequence[WanLink], polled_at: datetime) -> None:
        """Substitui a tabela de WAN inteira (transacao propria, separada do retrato)."""
        import psycopg2
        from psycopg2.extras import execute_values

        rows = [
            (
                w.wan_group, w.name, w.isp_name, w.ip_address, w.is_up, w.is_enabled,
                w.failover_only, w.availability_pct, w.latency_ms, w.rx_bps, w.tx_bps,
                w.gateway_mac, polled_at,
            )
            for w in {w.wan_group: w for w in wans}.values()
        ]
        try:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg2.connect(**self._kwargs)
            with self._conn.cursor() as cur:
                cur.execute("DELETE FROM optsislog.network_wan")
                if rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO optsislog.network_wan
                            (wan_group, name, isp_name, ip_address, is_up, is_enabled,
                             failover_only, availability_pct, latency_ms, rx_bps, tx_bps,
                             gateway_mac, last_polled_at)
                        VALUES %s
                        """,
                        rows,
                    )
            self._conn.commit()
        except Exception:
            self.close()
            raise

    def append_wan_samples(self, wans: Sequence[WanLink], polled_at: datetime) -> None:
        """
        Uma linha por WAN em network_wan_samples (migracao 017) e limpeza do que passou
        de WAN_SAMPLE_RETENTION_DAYS, numa transacao propria: se a tabela nao existir
        (migracao nao aplicada), so' o historico falha, o estado atual da WAN continua.
        `ON CONFLICT DO NOTHING`: um ciclo repetido no mesmo instante nao quebra a gravacao.
        """
        import psycopg2
        from psycopg2.extras import execute_values

        rows = [
            (w.wan_group, polled_at, w.is_up, w.latency_ms, w.rx_bps, w.tx_bps)
            for w in {w.wan_group: w for w in wans}.values()
        ]
        if not rows:
            return
        try:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg2.connect(**self._kwargs)
            with self._conn.cursor() as cur:
                execute_values(
                    cur,
                    """
                    INSERT INTO optsislog.network_wan_samples
                        (wan_group, sampled_at, is_up, latency_ms, rx_bps, tx_bps)
                    VALUES %s
                    ON CONFLICT (wan_group, sampled_at) DO NOTHING
                    """,
                    rows,
                )
                cur.execute(
                    "DELETE FROM optsislog.network_wan_samples WHERE sampled_at < %s",
                    (polled_at - timedelta(days=WAN_SAMPLE_RETENTION_DAYS),),
                )
            self._conn.commit()
        except Exception:
            self.close()
            raise

    def replace_vpn_clients(self, clients: Sequence[VpnClient], polled_at: datetime) -> None:
        """
        network_vpn_clients (migracao 018), transacao propria: falhar aqui (ex.: tabela
        ainda nao criada) nao afeta dispositivos, clientes nem WAN.
        - presentes: upsert como conectados; `connected_since` so' muda numa nova conexao
          (o UCG informa `assoc_time` da sessao atual);
        - ausentes que estavam conectados: desconectados agora;
        - sem atividade ha CLIENT_RETENTION_DAYS: apagados.
        """
        import psycopg2
        from psycopg2.extras import execute_values

        by_key = {c.key: c for c in clients}
        rows = [
            (
                c.key, c.username, c.vpn_type, c.interface, c.tunnel_ip, c.remote_ip,
                c.rx_bytes, c.tx_bytes, c.connected_since or polled_at, polled_at,
            )
            for c in by_key.values()
        ]
        try:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg2.connect(**self._kwargs)
            with self._conn.cursor() as cur:
                if rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO optsislog.network_vpn_clients
                            (client_key, username, vpn_type, interface, tunnel_ip, remote_ip,
                             rx_bytes, tx_bytes, connected_since, last_seen_at)
                        VALUES %s
                        ON CONFLICT (client_key) DO UPDATE SET
                            username = EXCLUDED.username, vpn_type = EXCLUDED.vpn_type,
                            interface = EXCLUDED.interface, tunnel_ip = EXCLUDED.tunnel_ip,
                            remote_ip = EXCLUDED.remote_ip, rx_bytes = EXCLUDED.rx_bytes,
                            tx_bytes = EXCLUDED.tx_bytes,
                            connected_since = EXCLUDED.connected_since,
                            connected = true, disconnected_at = NULL,
                            last_seen_at = EXCLUDED.last_seen_at
                        """,
                        rows,
                    )
                cur.execute(
                    """
                    UPDATE optsislog.network_vpn_clients
                       SET connected = false, disconnected_at = %s
                     WHERE connected AND client_key <> ALL(%s::text[])
                    """,
                    (polled_at, list(by_key)),
                )
                cur.execute(
                    "DELETE FROM optsislog.network_vpn_clients WHERE last_seen_at < %s",
                    (polled_at - timedelta(days=CLIENT_RETENTION_DAYS),),
                )
            self._conn.commit()
        except Exception:
            self.close()
            raise

    def upsert_wan_quality(self, points: Sequence[WanQualityPoint]) -> None:
        """
        network_wan_quality (migracao 021), transacao propria. O mesmo intervalo chega
        em ate 4 leituras seguidas (janela de 1 h, leitura a cada 15 min): fica o valor
        mais recente, porque o ultimo intervalo de cada leitura ainda estava em andamento.
        """
        import psycopg2
        from psycopg2.extras import execute_values

        by_key = {(p.wan_group, p.sampled_at): p for p in points}
        if not by_key:
            return
        rows = [
            (p.wan_group, p.sampled_at, p.packet_loss_pct, p.latency_avg_ms, p.latency_min_ms, p.latency_max_ms)
            for p in by_key.values()
        ]
        newest = max(p.sampled_at for p in by_key.values())
        try:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg2.connect(**self._kwargs)
            with self._conn.cursor() as cur:
                execute_values(
                    cur,
                    """
                    INSERT INTO optsislog.network_wan_quality
                        (wan_group, sampled_at, packet_loss_pct, latency_avg_ms, latency_min_ms, latency_max_ms)
                    VALUES %s
                    ON CONFLICT (wan_group, sampled_at) DO UPDATE SET
                        packet_loss_pct = EXCLUDED.packet_loss_pct,
                        latency_avg_ms = EXCLUDED.latency_avg_ms,
                        latency_min_ms = EXCLUDED.latency_min_ms,
                        latency_max_ms = EXCLUDED.latency_max_ms
                    """,
                    rows,
                )
                cur.execute(
                    "DELETE FROM optsislog.network_wan_quality WHERE sampled_at < %s",
                    (newest - timedelta(days=WAN_SAMPLE_RETENTION_DAYS),),
                )
            self._conn.commit()
        except Exception:
            self.close()
            raise

    def append_device_samples(self, devices: Sequence[NetworkDevice], polled_at: datetime) -> None:
        """
        network_device_samples (migracao 020), transacao propria, mesma politica do
        historico da WAN: guarda 31 dias; sem a tabela, so' o grafico fica sem o ponto.
        Dispositivo sem CPU e sem memoria (estatistica falhou) nao gera linha.
        """
        import psycopg2
        from psycopg2.extras import execute_values

        rows = [
            (d.mac, polled_at, d.cpu_pct, d.memory_pct)
            for d in {d.mac: d for d in devices}.values()
            if d.cpu_pct is not None or d.memory_pct is not None
        ]
        if not rows:
            return
        try:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg2.connect(**self._kwargs)
            with self._conn.cursor() as cur:
                execute_values(
                    cur,
                    """
                    INSERT INTO optsislog.network_device_samples (mac, sampled_at, cpu_pct, memory_pct)
                    VALUES %s
                    ON CONFLICT (mac, sampled_at) DO NOTHING
                    """,
                    rows,
                )
                cur.execute(
                    "DELETE FROM optsislog.network_device_samples WHERE sampled_at < %s",
                    (polled_at - timedelta(days=WAN_SAMPLE_RETENTION_DAYS),),
                )
            self._conn.commit()
        except Exception:
            self.close()
            raise

    def replace_top_apps(self, period: str, apps: Sequence[AppUsage], fetched_at: datetime) -> None:
        """network_top_apps (migracao 019): apaga o ranking do periodo e grava o novo, numa transacao."""
        import psycopg2
        from psycopg2.extras import execute_values

        rows = [
            (period, a.rank, a.application_id, a.category_id, a.name, a.category, a.bytes, fetched_at)
            for a in apps
        ]
        try:
            if self._conn is None or self._conn.closed:
                self._conn = psycopg2.connect(**self._kwargs)
            with self._conn.cursor() as cur:
                cur.execute("DELETE FROM optsislog.network_top_apps WHERE period = %s", (period,))
                if rows:
                    execute_values(
                        cur,
                        """
                        INSERT INTO optsislog.network_top_apps
                            (period, rank, application_id, category_id, name, category, bytes, fetched_at)
                        VALUES %s
                        """,
                        rows,
                    )
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
