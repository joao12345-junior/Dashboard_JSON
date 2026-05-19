// src/features/windows-event/useWindowsStats.ts
import { useMemo } from "react";
import { WindowsEventLog } from "../../lib/types/Log";

/**
 * Ponto de dados para o gráfico de barras empilhadas por dia.
 *
 * Cada entrada representa um dia com a contagem de eventos
 * separada por criticidade — o gráfico empilha as três barras.
 */
export interface DailyCriticalityEntry {
	date: string; // "DD/MM" — formatado para exibição
	high: number;
	medium: number;
	low: number;
	total: number;
}

export interface WindowsStats {
	total: number;
	high: number;
	medium: number;
	low: number;
	topProviders: { name: string; count: number }[];
	byChannel: { channel: string; count: number }[];
	// Distribuição diária — alimenta o Stacked Bar Chart
	dailyByCriticality: DailyCriticalityEntry[];
}

export function useWindowsStats(logs: WindowsEventLog[]): WindowsStats {
	return useMemo(() => {
		const total = logs.length;
		const high = logs.filter((l) => l.criticality === "High").length;
		const medium = logs.filter((l) => l.criticality === "Medium").length;
		const low = logs.filter((l) => l.criticality === "Low").length;

		const providerCount: Record<string, number> = {};
		const channelCount: Record<string, number> = {};
		// Acumulador por data — chave é "yyyy-mm-dd" para ordenação correta
		const byDateRaw: Record<
			string,
			{ high: number; medium: number; low: number; total: number }
		> = {};

		for (const log of logs) {
			// Providers
			providerCount[log.provider] = (providerCount[log.provider] ?? 0) + 1;

			// Channels
			channelCount[log.channel] = (channelCount[log.channel] ?? 0) + 1;

			// Distribuição diária por criticidade
			if (!byDateRaw[log.date]) {
				byDateRaw[log.date] = { high: 0, medium: 0, low: 0, total: 0 };
			}
			byDateRaw[log.date].total += 1;
			if (log.criticality === "High") byDateRaw[log.date].high += 1;
			if (log.criticality === "Medium") byDateRaw[log.date].medium += 1;
			if (log.criticality === "Low") byDateRaw[log.date].low += 1;
		}

		const topProviders = Object.entries(providerCount)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		const byChannel = Object.entries(channelCount)
			.map(([channel, count]) => ({ channel, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		// Ordena por data ISO (string sort funciona para yyyy-mm-dd),
		// limita aos últimos 30 dias e converte para formato de exibição
		const dailyByCriticality: DailyCriticalityEntry[] = Object.entries(
			byDateRaw,
		)
			.sort(([a], [b]) => a.localeCompare(b))
			.slice(-30)
			.map(([dateIso, counts]) => {
				const [, month, day] = dateIso.split("-");
				return {
					date: `${day}/${month}`,
					...counts,
				};
			});

		return {
			total,
			high,
			medium,
			low,
			topProviders,
			byChannel,
			dailyByCriticality,
		};
	}, [logs]);
}
