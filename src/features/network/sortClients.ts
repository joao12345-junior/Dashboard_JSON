// src/features/network/sortClients.ts
import type { NetworkClient } from "./hooks/useNetworkState";

export type ClientSortKey = "name" | "ip" | "connection" | "state";
export type SortDirection = "asc" | "desc";

/** Nome exibido do cliente: o que o UniFi chama, senão hostname, senão MAC. */
export function clientTitle(c: NetworkClient): string {
	return c.name ?? c.hostname ?? c.mac;
}

/** IPv4 como número (a.b.c.d); `null` se não for um IPv4 válido. */
function ipToNumber(ip: string | null): number | null {
	if (!ip) return null;
	const parts = ip.split(".");
	if (parts.length !== 4) return null;
	let value = 0;
	for (const part of parts) {
		const n = Number(part);
		if (!Number.isInteger(n) || n < 0 || n > 255) return null;
		value = value * 256 + n;
	}
	return value;
}

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** Instante (ms) usado na ordenação por "Estado": quando conectou ou quando saiu. */
function stateTime(c: NetworkClient): number {
	const iso = c.connected ? c.connected_since : (c.disconnected_at ?? c.last_seen_at);
	return iso ? new Date(iso).getTime() : 0;
}

/** Valor que ordena a coluna "Conexão": cabo antes de Wi-Fi, depois o SSID. */
function connectionKey(c: NetworkClient): string {
	return `${c.is_wired ? "0" : "1"} ${c.ssid ?? ""}`;
}

/// <summary>
/// Ordena uma CÓPIA da lista. Nome e conexão usam comparação natural em pt-BR
/// ("OPT2" antes de "OPT10"); IP compara os números do endereço (192.168.16.9 antes
/// de 192.168.16.10); sem IP vai sempre para o fim. O desempate é o nome, para a
/// ordem não "pular" entre atualizações.
/// </summary>
export function sortClients(
	clients: readonly NetworkClient[],
	key: ClientSortKey,
	direction: SortDirection,
): NetworkClient[] {
	const sign = direction === "asc" ? 1 : -1;
	return [...clients].sort((a, b) => {
		let result: number;
		if (key === "name") {
			result = collator.compare(clientTitle(a), clientTitle(b));
		} else if (key === "ip") {
			const ia = ipToNumber(a.ip_address);
			const ib = ipToNumber(b.ip_address);
			if (ia === null && ib === null) result = 0;
			else if (ia === null) return 1; // sem IP: sempre no fim, em qualquer direção
			else if (ib === null) return -1;
			else result = ia - ib;
		} else if (key === "connection") {
			result = collator.compare(connectionKey(a), connectionKey(b));
		} else {
			result = stateTime(a) - stateTime(b);
		}
		if (result !== 0) return result * sign;
		return collator.compare(clientTitle(a), clientTitle(b));
	});
}
