// src/features/process/useProcessStats.ts
import { useMemo } from "react";
import { ProcessLog } from "../../lib/types/Log";
import { DailyStats } from "../../hooks/useDashboardStats";

export interface ProcessStats {
	total: number;
	errors: number;
	active: number;
	finished: number;
	errorRate: number;
	dailyStats: DailyStats[];
}

export function useProcessStats(logs: ProcessLog[]): ProcessStats {
	return useMemo(() => {
		const total = logs.length;
		const errors = logs.filter((l) => l.status === 2).length;
		const active = logs.filter((l) => l.status === 1).length;
		const finished = logs.filter((l) => l.status === 0).length;
		const errorRate = total > 0 ? Math.round((errors / total) * 100) : 0;

		// Agrupa por data para o gráfico de histórico
		const byDate: Record<string, ProcessStats["dailyStats"][0]> = {};

		for (const log of logs) {
			if (!byDate[log.date]) {
				const [, month, day] = log.date.split("-");
				byDate[log.date] = {
					date: `${day}/${month}`,
					started: 0, // ← era "active"
					finished: 0,
					erro: 0, // ← era "errors"
					total: 0,
				};
			}
			if (log.status === 1) byDate[log.date].started += 1; // ← era active
			if (log.status === 0) byDate[log.date].finished += 1;
			if (log.status === 2) byDate[log.date].erro += 1; // ← era errors
			byDate[log.date].total += 1;
		}

		const dailyStats = Object.entries(byDate)
			.sort(([a], [b]) => a.localeCompare(b))
			.slice(-15)
			.map(([, stats]) => stats);

		return { total, errors, active, finished, errorRate, dailyStats };
	}, [logs]);
}
