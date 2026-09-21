// src/lib/formatCountsSummary.ts

import { StreamDataText } from "./subscribeToEventsStream";
import { getRegisteredTypes } from "./data/LogMapperRegistry";

/**
 * Monta um texto a partir dos counts por tipo de log, reaproveitando os
 * labels do LogMapperRegistry (mesma nomenclatura usada no resto do app)
 * em vez de duplicar os nomes em cada consumidor (banner, notificação, etc.).
 */
export function formatCountsSummary(counts: StreamDataText | null): string {
	const fallback = "Registros foram adicionados desde a última atualização.";
	if (!counts) return fallback;

	const labelByType = new Map(
		getRegisteredTypes().map((descriptor) => [descriptor.key, descriptor.label]),
	);

	const parts = Object.entries(counts)
		.filter(([, count]) => count > 0)
		.map(([logType, count]) => `${count} ${labelByType.get(logType) ?? logType}`);

	return parts.length > 0 ? `${parts.join(", ")} desde a última atualização.` : fallback;
}
