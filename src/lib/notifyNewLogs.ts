// src/lib/notifyNewLogs.ts

import { StreamDataText } from "./subscribeToEventsStream";
import { formatCountsSummary } from "./formatCountsSummary";

/**
 * Dispara uma notificação nativa do navegador avisando sobre novos logs.
 *
 * Só notifica quando: o navegador suporta a Notification API, a permissão
 * já foi concedida (pode ter sido revogada manualmente depois do toggle),
 * e a aba não está em foco (se estiver visível, o usuário já vê o banner).
 */
export function notifyNewLogs(counts: StreamDataText): void {
	if (!("Notification" in window)) return;
	if (Notification.permission !== "granted") return;
	if (document.visibilityState === "visible") return;

	new Notification("Novos dados no LogDash", {
		body: formatCountsSummary(counts),
	});
}
