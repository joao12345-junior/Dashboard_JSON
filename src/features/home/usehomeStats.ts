// src/features/home/useHomeStats.ts
import { useMemo } from "react";
import { Log, ProcessLog, WindowsEventLog } from "../../lib/types/Log";

export interface HomeStats {
	totalLogs: number;
	totalErrors: number;
	totalWarnings: number;

	byType: {
		process: { errors: number; warnings: number; total: number };
		windowsEvent: { high: number; medium: number; total: number };
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
	return log.status === 2;
}

/**
 * Aviso = qualquer evento que merece atenção mas não é crítico.
 * - ProcessLog:     status 0  (finalizado com aviso de backup)
 * - WindowsEventLog: criticality "Medium" (nível 3 = Warning do Windows)
 */
function isMediumCritical(log: Log): boolean {
	if (log.logType === "windows-event") return log.criticality === "Medium";
	return log.status === 0;
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

		const processErrors = processLogs.filter((l) => l.status === 2).length;
		const processWarnings = processLogs.filter((l) => l.status === 0).length;
		const windowsHigh = windowsLogs.filter(
			(l) => l.criticality === "High",
		).length;
		const windowsMedium = windowsLogs.filter(
			(l) => l.criticality === "Medium",
		).length;

		// Sem .slice() — retorna todos. Paginação é responsabilidade do componente.
		const criticalEvents = logs.filter(isCritical).sort(byDateTimeDesc);
		const mediumCriticalEvents = logs
			.filter(isMediumCritical)
			.sort(byDateTimeDesc);

		return {
			totalLogs: logs.length,
			totalErrors: processErrors + windowsHigh,
			totalWarnings: processWarnings + windowsMedium,
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
			criticalEvents,
			mediumCriticalEvents,
		};
	}, [logs]);
}
