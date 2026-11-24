// src/features/network/vpnClients.test.ts
import { describe, expect, it } from "vitest";
import { filterVpnClients, sortVpnClients, vpnTypeLabel, type VpnClient } from "./vpnClients";

function vpn(overrides: Partial<VpnClient> = {}): VpnClient {
	return {
		client_key: "openvpn-server:charles.farias",
		username: "charles.farias",
		vpn_type: "openvpn-server",
		interface: "tun1",
		tunnel_ip: "10.10.10.2",
		remote_ip: "170.244.220.173",
		rx_bytes: 649_400_256,
		tx_bytes: 1_427_651_616,
		connected: true,
		connected_since: "2026-11-24T10:08:19Z",
		disconnected_at: null,
		first_seen_at: "2026-11-24T19:00:00Z",
		last_seen_at: "2026-11-24T19:00:00Z",
		...overrides,
	};
}

describe("vpnTypeLabel", () => {
	it("nomes amigáveis para os tipos conhecidos", () => {
		expect(vpnTypeLabel("openvpn-server")).toBe("OpenVPN");
		expect(vpnTypeLabel("wireguard-server")).toBe("WireGuard");
		expect(vpnTypeLabel(null)).toBe("VPN");
		expect(vpnTypeLabel("ipsec-x")).toBe("ipsec-x");
	});
});

describe("filterVpnClients", () => {
	const clients = [vpn(), vpn({ client_key: "k2", username: "ana.souza", tunnel_ip: "10.10.10.3", remote_ip: null })];

	it("busca no usuário e nos IPs, sem caixa", () => {
		expect(filterVpnClients(clients, "ANA").map((c) => c.username)).toEqual(["ana.souza"]);
		expect(filterVpnClients(clients, "10.10.10.2").map((c) => c.username)).toEqual(["charles.farias"]);
		expect(filterVpnClients(clients, "170.244")).toHaveLength(1);
		expect(filterVpnClients(clients, "  ")).toHaveLength(2);
	});
});

describe("sortVpnClients", () => {
	it("conectados primeiro, depois por nome", () => {
		const sorted = sortVpnClients([
			vpn({ client_key: "1", username: "zeca" }),
			vpn({ client_key: "2", username: "ana", connected: false }),
			vpn({ client_key: "3", username: "bruno" }),
		]);
		expect(sorted.map((c) => c.username)).toEqual(["bruno", "zeca", "ana"]);
	});
});
