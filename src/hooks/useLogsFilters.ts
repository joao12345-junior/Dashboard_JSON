// src/hooks/useLogsFilters.ts — versão corrigida

import { useState, useMemo, useCallback } from "react";
import { START_STATUS, INITIAL_FILTERS } from "../lib/Variables";
import { ProcessLog } from "../lib/types/Log";

// Exportar o tipo dos filtros permite que outros arquivos o reusem
export type LogFilterState = typeof INITIAL_FILTERS;

export function useLogFilters(logs: ProcessLog[]) {
	const [filters, setFilters] = useState<LogFilterState>({
		...INITIAL_FILTERS,
	});

	const filteredLogs = useMemo(() => {
		// Filtra PRIMEIRO — descarta os inválidos antes de ordenar
		const filtered = logs.filter((log) => {
			const matchMessage = log.message
				.toLowerCase()
				.includes(filters.message.toLowerCase());
			const matchDate = filters.date ? log.date === filters.date : true;
			const matchStart =
				filters.start === START_STATUS.ALL
					? true
					: filters.start === START_STATUS.STARTED
						? log.status === 1
						: filters.start === START_STATUS.FINISHED
							? log.status === 0
							: filters.start === START_STATUS.ERRO
								? log.status === 2
								: true;

			return matchMessage && matchDate && matchStart;
		});

		// Ordena DEPOIS — só os registros que sobreviveram ao filtro
		return filtered.sort((a, b) =>
			`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
		);
	}, [logs, filters]);

	// keyof LogFilterState: se você chamar updateFilter("typo", "x"),
	// o TypeScript vai reclamar em tempo de compilação — não em runtime
	const updateFilter = useCallback(
		(key: keyof LogFilterState, value: string) =>
			setFilters((prev) => ({ ...prev, [key]: value })),
		[],
	);

	const resetFilters = useCallback(
		() => setFilters({ ...INITIAL_FILTERS }),
		[],
	);

	const stats = useMemo(
		() => ({
			total: logs.length,
			started: logs.filter((l) => l.status === 1).length,
			finished: logs.filter((l) => l.status === 0).length,
			erro: logs.filter((l) => l.status === 2).length,
		}),
		[logs],
	);

	return { filters, filteredLogs, stats, updateFilter, resetFilters };
}
