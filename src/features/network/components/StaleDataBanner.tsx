// src/features/network/components/StaleDataBanner.tsx
import { formatEventTime } from "../formatEventTime";
import { isPollerStale } from "../format";

/// <summary>
/// Aviso quando o último ciclo do poller é velho (serviço parado, UCG fora do ar
/// ou chave expirada): sem isso a tela mostraria dados antigos como se fossem de agora.
/// </summary>
export function StaleDataBanner({ polledAt }: { polledAt: string | null }) {
	if (!isPollerStale(polledAt)) return null;
	return (
		<div
			role="alert"
			style={{
				flexShrink: 0,
				padding: "10px 14px",
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: "color-mix(in oklch, var(--chart-4) 12%, transparent)",
				color: "var(--warning-text)",
				fontSize: 13,
			}}
		>
			<strong>Dados possivelmente desatualizados.</strong> O último ciclo do coletor foi em{" "}
			{formatEventTime(polledAt as string)}. Confira o serviço{" "}
			<code>LogDashUnifiPoller</code> no servidor (log <code>unifi-poller.log</code>).
		</div>
	);
}
