// src/features/network/hooks/useNetworkState.ts
import { useNetworkPolling, type NetworkPollingState } from "./useNetworkPolling";

/** Dispositivo UniFi como a API devolve — ver `GET /api/network/devices`. */
export interface NetworkDevice {
	mac: string;
	name: string | null;
	model: string | null;
	ip_address: string | null;
	/** Estado informado pelo UniFi (ex.: "ONLINE"). */
	state: string | null;
	firmware_version: string | null;
	firmware_updatable: boolean | null;
	features: string[];
	uptime_sec: number | null;
	cpu_pct: number | null;
	memory_pct: number | null;
	uplink_tx_bps: number | null;
	uplink_rx_bps: number | null;
	last_heartbeat_at: string | null;
	last_polled_at: string;
}

/** Cliente da rede como a API devolve — ver `GET /api/network/clients`. */
export interface NetworkClient {
	mac: string;
	name: string | null;
	hostname: string | null;
	/** Anotação do UniFi (costuma ser o nome do dono). */
	note: string | null;
	ip_address: string | null;
	vendor: string | null;
	is_wired: boolean;
	is_guest: boolean;
	network_name: string | null;
	uplink_mac: string | null;
	/** Nome do AP/switch onde está ligado (join com os dispositivos). */
	uplink_name: string | null;
	ssid: string | null;
	signal_dbm: number | null;
	tx_bytes: number | null;
	rx_bytes: number | null;
	connected: boolean;
	connected_since: string | null;
	disconnected_at: string | null;
	last_seen_at: string;
}

interface DevicesResponse {
	devices: NetworkDevice[];
	/** Último ciclo do poller (ISO) ou null se ainda não há dispositivos. */
	polled_at: string | null;
}

interface ClientsResponse {
	clients: NetworkClient[];
	connected_count: number;
	polled_at: string | null;
}

export type ClientStatus = "connected" | "disconnected" | "all";

export function useNetworkDevices(): NetworkPollingState<DevicesResponse> {
	return useNetworkPolling<DevicesResponse>(
		"/api/network/devices",
		"Erro ao buscar dispositivos de rede",
	);
}

export function useNetworkClients(
	status: ClientStatus,
	q: string,
): NetworkPollingState<ClientsResponse> {
	const params = new URLSearchParams({ status });
	if (q) params.set("q", q);
	return useNetworkPolling<ClientsResponse>(
		`/api/network/clients?${params.toString()}`,
		"Erro ao buscar clientes de rede",
	);
}
