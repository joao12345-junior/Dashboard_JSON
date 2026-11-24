// src/features/network/vpnClients.ts
//
// Clientes de VPN (OpenVPN/Teleport do UCG). Eles não têm MAC e não aparecem em
// stat/sta: o poller lê de stat/remoteuservpn e grava em network_vpn_clients
// (migração 018). Aqui ficam o tipo e as regras puras (testadas, sem React); o hook
// `useNetworkVpnClients` fica em hooks/useNetworkExtras.ts.

/** Usuário de VPN como a API devolve — ver `GET /api/network/vpn-clients`. */
export interface VpnClient {
	/** "<vpn_type>:<usuário>". */
	client_key: string;
	username: string;
	/** Ex.: "openvpn-server". */
	vpn_type: string | null;
	interface: string | null;
	/** IP dentro da VPN (10.10.10.x). */
	tunnel_ip: string | null;
	/** IP público de onde a pessoa conectou. */
	remote_ip: string | null;
	rx_bytes: number | null;
	tx_bytes: number | null;
	connected: boolean;
	connected_since: string | null;
	disconnected_at: string | null;
	first_seen_at: string;
	last_seen_at: string;
}

export interface VpnClientsResponse {
	clients: VpnClient[];
	connected_count: number;
	polled_at: string | null;
}

/** "OpenVPN" para "openvpn-server"; o valor cru para tipos desconhecidos. */
export function vpnTypeLabel(vpnType: string | null): string {
	if (!vpnType) return "VPN";
	const lower = vpnType.toLowerCase();
	if (lower.startsWith("openvpn")) return "OpenVPN";
	if (lower.includes("wireguard")) return "WireGuard";
	if (lower.includes("teleport")) return "Teleport";
	if (lower.includes("l2tp")) return "L2TP";
	return vpnType;
}

/** Busca sem caixa no usuário, IPs e tipo (igual à busca da lista de clientes). */
export function filterVpnClients(clients: readonly VpnClient[], query: string): VpnClient[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...clients];
	return clients.filter((c) =>
		[c.username, c.tunnel_ip, c.remote_ip, c.vpn_type]
			.filter((v): v is string => v !== null)
			.some((v) => v.toLowerCase().includes(q)),
	);
}

/** Conectados primeiro, depois pelo nome de usuário. */
export function sortVpnClients(clients: readonly VpnClient[]): VpnClient[] {
	return [...clients].sort(
		(a, b) => Number(b.connected) - Number(a.connected) || a.username.localeCompare(b.username, "pt-BR"),
	);
}
