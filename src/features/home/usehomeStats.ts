// src/features/home/useHomeStats.ts
import { useMemo } from "react";
import { Log, ProcessLog, WindowsEventLog, AppLog } from "../../lib/types/Log";

export interface HomeStats {
	totalLogs: number;
	totalErrors: number;
	totalWarnings: number;

	byType: {
		process: { errors: number; total: number };
		windowsEvent: { high: number; medium: number; total: number };
		app: { errors: number; avisos: number; total: number };
	};

	criticalEvents: Log[];

	/**
	 * mediumCriticalEvents agora inclui TODOS os avisos de ambas as fontes.
	 *
	 * O feed na Home precisa exibir o conjunto completo com um botão de
	 * filtro por fonte — portanto o hook entrega tudo e o componente filtra.
	 * Separar aqui (process vs windows) quebraria esse contrato.
	 */
	mediumCriticalEvents: Log[];
}

function isCritical(log: Log): boolean {
	if (log.logType === "windows-event") return log.criticality === "High";
	if (log.logType === "app") return log.tipo === "erro";
	return log.status === 2;
}

/**
 * Aviso = qualquer evento que merece atenção mas não é crítico.
 * - ProcessLog:     status 0  (finalizado com aviso de backup)
 * - WindowsEventLog: criticality "Medium" (nível 3 = Warning do Windows)
 */
function isMediumCritical(log: Log): boolean {
	if (log.logType === "windows-event") return log.criticality === "Medium";
	if (log.logType === "app") return log.tipo === "aviso";
	return false;
}

const byDateTimeDesc = (a: Log, b: Log): number =>
	`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);

export function useHomeStats(logs: Log[]): HomeStats {
	return useMemo(() => {
		const processLogs = logs.filter(
			(l): l is ProcessLog => l.logType === "process",
		);
		const windowsLogs = logs.filter(
			(l): l is WindowsEventLog => l.logType === "windows-event",
		);
		const appLogs = logs.filter((l): l is AppLog => l.logType === "app");

		const processErrors = processLogs.filter((l) => l.status === 2).length;

		const windowsHigh = windowsLogs.filter(
			(l) => l.criticality === "High",
		).length;
		const windowsMedium = windowsLogs.filter(
			(l) => l.criticality === "Medium",
		).length;

		const appErrors = appLogs.filter((l) => l.tipo === "erro").length;
		const appAvisos = appLogs.filter((l) => l.tipo === "aviso").length;

		// Sem .slice() — retorna todos. Paginação é responsabilidade do componente.
		const criticalEvents = logs.filter(isCritical).sort(byDateTimeDesc);
		const mediumCriticalEvents = logs
			.filter(isMediumCritical)
			.sort(byDateTimeDesc);

		return {
			totalLogs: logs.length,
			totalErrors: processErrors + windowsHigh + appErrors,
			totalWarnings: windowsMedium + appAvisos,
			byType: {
				process: {
					errors: processErrors,
					total: processLogs.length,
				},
				windowsEvent: {
					high: windowsHigh,
					medium: windowsMedium,
					total: windowsLogs.length,
				},
				app: {
					errors: appErrors,
					avisos: appAvisos,
					total: appLogs.length,
				},
			},
			criticalEvents,
			mediumCriticalEvents,
		};
	}, [logs]);
}
