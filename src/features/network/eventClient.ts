// src/features/network/eventClient.ts
import type { NetworkClient } from "./hooks/useNetworkState";
import type { NetworkEvent } from "./hooks/useNetworkEvents";

/** Índices para achar o cliente citado num evento. */
export interface ClientLookup {
	byMac: ReadonlyMap<string, NetworkClient>;
	byIp: ReadonlyMap<string, NetworkClient>;
}

const MAC_IN_TEXT = /\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/gi;

/// <summary>
/// Monta os índices por MAC e por IP. Para o IP, quem está CONECTADO tem
/// prioridade: o DHCP reaproveita endereços, então um desconectado antigo pode
/// ter o mesmo IP de quem está na rede agora.
/// </summary>
export function buildClientLookup(clients: readonly NetworkClient[]): ClientLookup {
	const byMac = new Map<string, NetworkClient>();
	const byIp = new Map<string, NetworkClient>();
	for (const c of clients) {
		byMac.set(c.mac.toLowerCase(), c);
		if (!c.ip_address) continue;
		const current = byIp.get(c.ip_address);
		if (!current || (!current.connected && c.connected)) byIp.set(c.ip_address, c);
	}
	return { byMac, byIp };
}

/// <summary>
/// Cliente citado no evento: algum valor do `extension` igual a um MAC ou IP
/// conhecido (comparação exata, para 192.168.16.1 não casar com .10) ou um MAC
/// dentro da mensagem. MAC vence IP. `null` se o evento não cita cliente
/// (ex.: eventos do próprio gateway/AP, cujos endereços não são de clientes).
/// </summary>
export function findEventClient(ev: NetworkEvent, lookup: ClientLookup): NetworkClient | null {
	const values = Object.values(ev.extension ?? {}).filter((v): v is string => typeof v === "string");
	for (const v of values) {
		const hit = lookup.byMac.get(v.trim().toLowerCase());
		if (hit) return hit;
	}
	for (const mac of (ev.extension?.msg ?? "").match(MAC_IN_TEXT) ?? []) {
		const hit = lookup.byMac.get(mac.toLowerCase());
		if (hit) return hit;
	}
	for (const v of values) {
		const hit = lookup.byIp.get(v.trim());
		if (hit) return hit;
	}
	return null;
}
