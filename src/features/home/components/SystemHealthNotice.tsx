// src/features/home/components/SystemHealthNotice.tsx
import { formatAge, type HealthItem } from "../../system/healthStatus";
import { HomeNotice } from "./HomeNotice";

interface SystemHealthNoticeProps {
	/** Serviços atrasados ou parados (ver `serviceAlerts`). */
	alerts: HealthItem[];
	onOpenSettings: () => void;
}

/// <summary>
/// Aviso da Home quando um serviço do próprio LogDash (poller, checagem de sites)
/// deixa de gravar dados. Sem ele, a tela mostraria números velhos como se fossem
/// atuais. Não renderiza nada se está tudo em dia.
/// </summary>
export function SystemHealthNotice({ alerts, onOpenSettings }: SystemHealthNoticeProps) {
	if (alerts.length === 0) return null;
	const anyStale = alerts.some((a) => a.level === "stale");

	return (
		<HomeNotice
			tone={anyStale ? "danger" : "warn"}
			actionLabel="Ver saúde do sistema"
			onAction={onOpenSettings}
		>
			{alerts
				.map((a) => `${a.label} ${a.level === "stale" ? "parada" : "atrasada"} (último dado ${formatAge(a.ageMs)})`)
				.join(" · ")}
			. Os números abaixo podem estar desatualizados.
		</HomeNotice>
	);
}
