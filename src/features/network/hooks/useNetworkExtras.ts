// src/features/network/hooks/useNetworkExtras.ts
import { useEffect, useState } from "react";
import { loadApiConfig } from "../../../lib/storage/logPaths";
import { authorizedFetch } from "../../../hooks/useAuth";
import { useNetworkPolling, type NetworkPollingState } from "./useNetworkPolling";
import type { NetworkEvent } from "./useNetworkEvents";
import type { ClientStatus } from "./useNetworkState";
import type { VpnClientsResponse } from "../vpnClients";

/** Link de internet do gateway — ver `GET /api/network/wan`. */
export interface WanLink {
	/** "WAN", "WAN2"... */
	wan_group: string;
	/** Nome dado no UniFi (ex.: "Unifique"). */
	name: string | null;
	/** Provedor detectado pelo UniFi. */
	isp_name: string | null;
	ip_address: string | null;
	is_up: boolean | null;
	is_enabled: boolean | null;
	failover_only: boolean | null;
	/** Disponibilidade nas últimas 24 h, em %. */
	availability_pct: number | null;
	latency_ms: number | null;
	rx_bps: number | null;
	tx_bps: number | null;
	gateway_mac: string | null;
	last_polled_at: string;
}

interface WanResponse {
	wans: WanLink[];
	polled_at: string | null;
}

/** Período conectado — ver `GET /api/network/clients/<mac>/sessions`. */
export interface ClientSession {
	connected_at: string;
	/** null = ainda conectado. */
	disconnected_at: string | null;
	ip_address: string | null;
	uplink_mac: string | null;
	uplink_name: string | null;
}

/** Usuários de VPN (OpenVPN/Teleport) — ver `GET /api/network/vpn-clients`. */
export function useNetworkVpnClients(status: ClientStatus): NetworkPollingState<VpnClientsResponse> {
	return useNetworkPolling<VpnClientsResponse>(
		`/api/network/vpn-clients?status=${status}`,
		"Erro ao buscar os clientes de VPN",
	);
}

export function useNetworkWan(): NetworkPollingState<WanResponse> {
	return useNetworkPolling<WanResponse>("/api/network/wan", "Erro ao buscar os links de internet");
}

/** Último evento de gravidade média ou alta (para o card da Home). */
export function useLatestNetworkAlert(): NetworkPollingState<{ events: NetworkEvent[] }> {
	return useNetworkPolling<{ events: NetworkEvent[] }>(
		"/api/network/events?limit=1&min_severity=4",
		"Erro ao buscar alertas de rede",
	);
}

export interface OnceState<T> {
	data: T | null;
	error: string | null;
	loading: boolean;
}

/// <summary>
/// Busca única (sem repetir) de `path`; `null` = não buscar. Usado no modal do
/// cliente, que só precisa dos dados enquanto está aberto. Resposta de um
/// cliente anterior (troca rápida) é ignorada pela flag `cancelled`.
/// </summary>
function useApiOnce<T>(path: string | null, errorMessage: string): OnceState<T> {
	const [state, setState] = useState<OnceState<T> & { path: string | null }>({
		data: null,
		error: null,
		loading: false,
		path: null,
	});

	useEffect(() => {
		if (!path) return;
		let cancelled = false;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- inicio de busca na API (sistema externo)
		setState({ data: null, error: null, loading: true, path });
		(async () => {
			try {
				const { api } = loadApiConfig();
				const res = await authorizedFetch(`${api}${path}`);
				if (!res.ok) throw new Error(errorMessage);
				const body = (await res.json()) as T;
				if (!cancelled) setState({ data: body, error: null, loading: false, path });
			} catch (err) {
				if (!cancelled) {
					setState({
						data: null,
						error: err instanceof Error ? err.message : "Erro desconhecido",
						loading: false,
						path,
					});
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [path, errorMessage]);

	// Enquanto o efeito não rodou para o caminho novo, não mostra dado do anterior.
	if (state.path !== path) return { data: null, error: null, loading: path !== null };
	return state;
}

export function useClientSessions(mac: string | null, days = 7): OnceState<{ sessions: ClientSession[] }> {
	return useApiOnce(
		mac ? `/api/network/clients/${encodeURIComponent(mac)}/sessions?days=${days}` : null,
		"Erro ao buscar o histórico",
	);
}

export function useClientEvents(
	mac: string | null,
	ip: string | null,
	limit = 15,
): OnceState<{ events: NetworkEvent[] }> {
	let path: string | null = null;
	if (mac) {
		const params = new URLSearchParams({ client_mac: mac, limit: String(limit) });
		if (ip) params.set("client_ip", ip);
		path = `/api/network/events?${params.toString()}`;
	}
	return useApiOnce(path, "Erro ao buscar os eventos do cliente");
}
