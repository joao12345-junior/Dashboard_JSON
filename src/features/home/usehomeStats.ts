// src/features/home/useHomeStats.ts
import { useMemo } from "react";
import { Log, ProcessLog, WindowsEventLog } from "../../lib/types/Log";

// src/features/home/useHomeStats.ts

export interface HomeStats {
	// ── Totais globais ──────────────────────────────────────────
	totalErrors: number; // status === 2 em qualquer tipo
	totalWarnings: number; // status === 0 em WindowsEventLog com level "3"
	totalLogs: number;

	// ── Por tipo de log ─────────────────────────────────────────
	byType: {
		process: {
			errors: number;
			warnings: number;
			total: number;
		};
		windowsEvent: {
			high: number; // criticality === "High"
			medium: number; // criticality === "Medium"
			total: number;
		};
	};

	// ── Feed de eventos críticos recentes ───────────────────────
	// Os últimos N eventos que precisam de atenção imediata,
	// independente do tipo — a Home só precisa renderizá-los
	recentCritical: Log[];
}

const RECENT_CRITICAL_LIMIT = 10;

export function useHomeStats(logs: Log[]): HomeStats {
	return useMemo(() => {
		// ── Separação por tipo ───────────────────────────────────────────
		// A união discriminada garante que dentro de cada branch
		// o TypeScript conhece os campos disponíveis com certeza.
		const processLogs = logs.filter(
			(l): l is ProcessLog => l.logType === "process",
		);
		const windowsLogs = logs.filter(
			(l): l is WindowsEventLog => l.logType === "windows-event",
		);

		// ── Métricas de ProcessLog ───────────────────────────────────────
		const processErrors = processLogs.filter((l) => l.status === 2).length;
		const processWarnings = processLogs.filter((l) => l.status === 0).length;

		// ── Métricas de WindowsEventLog ──────────────────────────────────
		const windowsHigh = windowsLogs.filter(
			(l) => l.criticality === "High",
		).length;
		const windowsMedium = windowsLogs.filter(
			(l) => l.criticality === "Medium",
		).length;

		// ── Totais globais ───────────────────────────────────────────────
		// "Erro" no contexto da Home = qualquer coisa que precisa de atenção
		const totalErrors = processErrors + windowsHigh;
		const totalWarnings = processWarnings + windowsMedium;

		// ── Feed de eventos críticos recentes ────────────────────────────
		// Ordena por data+hora desc e pega os N mais recentes
		// que representam problemas — status 2 ou criticality High/Medium
		const critical = logs
			.filter(
				(l) =>
					l.status === 2 ||
					(l.logType === "windows-event" &&
						(l.criticality === "High" || l.criticality === "Medium")),
			)
			.sort((a, b) =>
				`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
			)
			.slice(0, RECENT_CRITICAL_LIMIT);

		return {
			totalErrors,
			totalWarnings,
			totalLogs: logs.length,
			byType: {
				process: {
					errors: processErrors,
					warnings: processWarnings,
					total: processLogs.length,
				},
				windowsEvent: {
					high: windowsHigh,
					medium: windowsMedium,
					total: windowsLogs.length,
				},
			},
			recentCritical: critical,
		};
	}, [logs]);
}
