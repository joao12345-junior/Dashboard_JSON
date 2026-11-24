// src/features/network/networkDashboard.ts
//
// Regras puras do Rede > Painel (a "home" da rede, como a tela inicial do UniFi).
// Sem React e sem fetch: a página busca, estas funções só resumem. Testadas com vitest.
import type { NetworkClient, NetworkDevice } from "./hooks/useNetworkState";
import { isGateway } from "./topologyLayout";

/** Tráfego total de um cliente (enviado + recebido) desde que conectou; null = UniFi não informou. */
export function clientTraffic(client: NetworkClient): number | null {
	if (client.tx_bytes === null && client.rx_bytes === null) return null;
	return (client.tx_bytes ?? 0) + (client.rx_bytes ?? 0);
}

/// <summary>
/// Os `limit` clientes CONECTADOS com mais tráfego. Os contadores do UniFi zeram a
/// cada conexão, então é "quem mais usou desde que conectou", não "no dia". Clientes
/// sem contador ficam de fora. Empate: pelo MAC, para a ordem não pular.
/// </summary>
export function topClientsByTraffic(clients: readonly NetworkClient[], limit: number): NetworkClient[] {
	return clients
		.filter((c) => c.connected && clientTraffic(c) !== null)
		.sort((a, b) => (clientTraffic(b) ?? 0) - (clientTraffic(a) ?? 0) || a.mac.localeCompare(b.mac))
		.slice(0, limit);
}

export interface NetworkCounts {
	devicesOnline: number;
	devicesTotal: number;
	clientsConnected: number;
	wired: number;
	wifi: number;
	guests: number;
}

/** Totais do cartão do gateway. "Online" = estado ONLINE informado pelo UniFi. */
export function countNetwork(devices: readonly NetworkDevice[], clients: readonly NetworkClient[]): NetworkCounts {
	const connected = clients.filter((c) => c.connected);
	return {
		devicesOnline: devices.filter((d) => d.state === "ONLINE").length,
		devicesTotal: devices.length,
		clientsConnected: connected.length,
		wired: connected.filter((c) => c.is_wired).length,
		wifi: connected.filter((c) => !c.is_wired).length,
		guests: connected.filter((c) => c.is_guest).length,
	};
}

/** Clientes conectados por MAC do dispositivo onde estão ligados. */
export function clientsPerDevice(clients: readonly NetworkClient[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const c of clients) {
		if (!c.connected || !c.uplink_mac) continue;
		counts.set(c.uplink_mac, (counts.get(c.uplink_mac) ?? 0) + 1);
	}
	return counts;
}

/** Separa o gateway dos demais dispositivos (APs, switches), na ordem de nome. */
export function splitGateway(devices: readonly NetworkDevice[]): {
	gateway: NetworkDevice | null;
	others: NetworkDevice[];
} {
	const gateway = devices.find(isGateway) ?? null;
	const others = devices
		.filter((d) => d !== gateway)
		.sort((a, b) => (a.name ?? a.mac).localeCompare(b.name ?? b.mac, "pt-BR"));
	return { gateway, others };
}
