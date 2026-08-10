// src/features/app-logs/useAppStats.ts
import { useMemo } from "react";
import { AppLog } from "../../lib/types/Log";

export interface DailyAppEntry {
	date: string;
	erro: number;
	aviso: number;
	info: number;
	debug: number;
	total: number;
}

export interface AppStats {
	total: number;
	erros: number;
	avisos: number;
	infos: number;
	debugs: number;
	errorRate: number;
	dailyStats: DailyAppEntry[];
	topProgramas: { name: string; count: number }[];
}

export function useAppStats(logs: AppLog[]): AppStats {
	return useMemo(() => {
		const total = logs.length;
		const erros = logs.filter((l) => l.tipo === "erro").length;
		const avisos = logs.filter((l) => l.tipo === "aviso").length;
		const infos = logs.filter((l) => l.tipo === "info").length;
		const debugs = logs.filter((l) => l.tipo === "debug").length;
		const errorRate = total > 0 ? Math.round((erros / total) * 100) : 0;

		const programaCount: Record<string, number> = {};
		const byDate: Record<string, DailyAppEntry> = {};

		for (const log of logs) {
			if (log.programa) {
				programaCount[log.programa] = (programaCount[log.programa] ?? 0) + 1;
			}

			if (!byDate[log.date]) {
				const [, month, day] = log.date.split("-");
				byDate[log.date] = {
					date: `${day}/${month}`,
					erro: 0,
					aviso: 0,
					info: 0,
					debug: 0,
					total: 0,
				};
			}
			byDate[log.date][log.tipo] += 1;
			byDate[log.date].total += 1;
		}

		const topProgramas = Object.entries(programaCount)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		const dailyStats = Object.entries(byDate)
			.sort(([a], [b]) => a.localeCompare(b))
			.slice(-15)
			.map(([, stats]) => stats);

		return {
			total,
			erros,
			avisos,
			infos,
			debugs,
			errorRate,
			dailyStats,
			topProgramas,
		};
	}, [logs]);
}
