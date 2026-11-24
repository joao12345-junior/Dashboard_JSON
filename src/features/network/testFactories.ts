// src/features/network/testFactories.ts
// Fábricas de dados só para os testes (nenhum código de produção importa este arquivo).
import type { NetworkClient, NetworkDevice } from "./hooks/useNetworkState";
import type { NetworkEvent } from "./hooks/useNetworkEvents";

export function makeClient(overrides: Partial<NetworkClient> = {}): NetworkClient {
	return {
		mac: "aa:bb:cc:00:00:01",
		name: null,
		hostname: null,
		note: null,
		ip_address: null,
		vendor: null,
		is_wired: true,
		is_guest: false,
		network_name: null,
		uplink_mac: null,
		uplink_name: null,
		ssid: null,
		signal_dbm: null,
		tx_bytes: null,
		rx_bytes: null,
		connected: true,
		connected_since: null,
		disconnected_at: null,
		last_seen_at: "2026-11-24T12:00:00Z",
		...overrides,
	};
}

export function makeDevice(overrides: Partial<NetworkDevice> = {}): NetworkDevice {
	return {
		mac: "dd:ee:ff:00:00:01",
		name: null,
		model: null,
		ip_address: null,
		state: "ONLINE",
		firmware_version: null,
		firmware_updatable: null,
		features: [],
		uptime_sec: null,
		cpu_pct: null,
		memory_pct: null,
		uplink_tx_bps: null,
		uplink_rx_bps: null,
		last_heartbeat_at: null,
		last_polled_at: "2026-11-24T12:00:00Z",
		...overrides,
	};
}

export function makeEvent(overrides: Partial<NetworkEvent> = {}): NetworkEvent {
	return {
		id: 1,
		created_at: "2026-11-24T12:00:00Z",
		event_time: null,
		source_ip: null,
		device_product: null,
		signature_id: null,
		name: null,
		severity: null,
		extension: {},
		...overrides,
	};
}
