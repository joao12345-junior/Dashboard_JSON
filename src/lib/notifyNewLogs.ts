// src/lib/notifyNewLogs.ts

import { StreamDataText } from "./subscribeToEventsStream";
import { formatCountsSummary } from "./formatCountsSummary";

/**
 * Dispara uma notificação nativa do navegador avisando sobre novos logs.
 *
 * Só notifica quando: o navegador suporta a Notification API e a permissão
 * já foi concedida (pode ter sido revogada manualmente depois do toggle).
 *
 * Antes só notificava com a aba fora de foco -- a lógica era "se a aba tá
 * visível, o usuário já vê o banner". Com a remoção do banner (2026-09-28,
 * atualização virou 100% automática/silenciosa) essa suposição caiu: com a
 * aba em foco mas olhando outra coisa na tela, o usuário não tinha mais
 * nenhum sinal de que chegou dado novo. Agora notifica sempre, com a aba em
 * foco ou não.
 */
export function notifyNewLogs(counts: StreamDataText): void {
	if (!("Notification" in window)) return;
	if (Notification.permission !== "granted") return;

	new Notification("Novos dados no LogDash", {
		body: formatCountsSummary(counts),
	});
}
