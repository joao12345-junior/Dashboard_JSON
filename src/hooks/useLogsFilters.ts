import { useState, useMemo, useCallback } from "react";
import { START_STATUS, INITIAL_FILTERS } from "../lib/Variables";

// ─── useLogFilters ────────────────────────────────────────────────────────────
export function useLogFilters(logs) {
	const [filters, setFilters] = useState({ ...INITIAL_FILTERS });

	const filteredLogs = useMemo(() => {
		const sorted = [...logs].sort((a, b) =>
			`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
		);

		return sorted.filter((log) => {
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
	}, [logs, filters]);

	const stats = useMemo(
		() => ({
			total: logs.length,
			started: logs.filter((l) => l.status === 1).length,
			finished: logs.filter((l) => l.status === 0).length,
			erro: logs.filter((l) => l.status === 2).length,
		}),
		[logs],
	);

	const updateFilter = useCallback(
		(key, value) => setFilters((prev) => ({ ...prev, [key]: value })),
		[],
	);

	const resetFilters = useCallback(
		() => setFilters({ ...INITIAL_FILTERS }),
		[],
	);

	return { filters, filteredLogs, stats, updateFilter, resetFilters };
}
