// src/features/windows-event/useWindowsStats.ts
import { useMemo } from "react";
import { WindowsEventLog } from "../../lib/types/Log";

export interface WindowsStats {
	total: number;
	high: number;
	medium: number;
	low: number;
	// Top 5 providers com mais eventos — útil para identificar
	// qual serviço está gerando mais ruído
	topProviders: { name: string; count: number }[];
	// Distribuição por canal
	byChannel: { channel: string; count: number }[];
}

export function useWindowsStats(logs: WindowsEventLog[]): WindowsStats {
	return useMemo(() => {
		const total = logs.length;
		const high = logs.filter((l) => l.criticality === "High").length;
		const medium = logs.filter((l) => l.criticality === "Medium").length;
		const low = logs.filter((l) => l.criticality === "Low").length;

		// Contagem por provider usando Record como acumulador
		// Mais eficiente que filter+length para cada provider
		const providerCount: Record<string, number> = {};
		const channelCount: Record<string, number> = {};

		for (const log of logs) {
			providerCount[log.provider] = (providerCount[log.provider] ?? 0) + 1;
			channelCount[log.channel] = (channelCount[log.channel] ?? 0) + 1;
		}

		const topProviders = Object.entries(providerCount)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		const byChannel = Object.entries(channelCount)
			.map(([channel, count]) => ({ channel, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		return { total, high, medium, low, topProviders, byChannel };
	}, [logs]);
}
