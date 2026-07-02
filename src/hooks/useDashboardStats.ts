// src/hooks/useDashboardStats.ts
import { useMemo } from "react";
import { Log } from "../lib/types/Log";

export interface DailyStats {
	date: string;
	started: number;
	finished: number;
	erro: number;
	total: number;
}

// Campo renomeado de "color" para "fill" — Recharts lê "fill" nativamente
export interface StatusEntry {
	name: string;
	value: number;
	fill: string;
}

export interface DashboardMetrics {
	total: number;
	started: number;
	finished: number;
	erro: number;
	errorRate: number;
	dailyStats: DailyStats[];
	statusDistribution: StatusEntry[]; // ← usa StatusEntry agora, não inline
}

export function useDashboardStats(logs: Log[]): DashboardMetrics {
	return useMemo(() => {
		const total = logs.length;
		const started = logs.filter((l) => l.status === 1).length;
		const finished = logs.filter((l) => l.status === 0).length;
		const erro = logs.filter((l) => l.status === 2).length;
		const errorRate = total > 0 ? Math.round((erro / total) * 100) : 0;

		const byDate: Record<string, DailyStats> = {};

		for (const log of logs) {
			if (!byDate[log.date]) {
				const [, month, day] = log.date.split("-"); // "year" removido — não é usado
				byDate[log.date] = {
					date: `${day}/${month}`,
					started: 0,
					finished: 0,
					erro: 0,
					total: 0,
				};
			}
			byDate[log.date].total += 1;
			if (log.status === 1) byDate[log.date].started += 1;
			if (log.status === 0) byDate[log.date].finished += 1;
			if (log.status === 2) byDate[log.date].erro += 1;
		}

		const dailyStats = Object.entries(byDate)
			.sort(([a], [b]) => a.localeCompare(b))
			.slice(-15)
			.map(([, stats]) => stats);

		// "fill" em vez de "color" — Recharts injeta esse campo no shape automaticamente
		const statusDistribution: StatusEntry[] = [
			{ name: "Iniciados", value: started, fill: "var(--primary)" },
			{ name: "Finalizados", value: finished, fill: "var(--chart-4)" },
			{ name: "Erros", value: erro, fill: "var(--destructive)" },
		].filter((s) => s.value > 0);

		return {
			total,
			started,
			finished,
			erro,
			errorRate,
			dailyStats,
			statusDistribution,
		};
	}, [logs]);
}
