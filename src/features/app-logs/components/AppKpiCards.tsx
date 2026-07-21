// src/features/app-logs/components/AppKpiCards.tsx
import { KpiCard } from "../../../components/charts/KpiCard";
import { AppStats } from "../useAppStats";

interface AppKpiCardsProps {
	stats: AppStats;
	isMobile: boolean;
}

export function AppKpiCards({ stats, isMobile }: AppKpiCardsProps) {
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
				gap: 16,
			}}
		>
			<KpiCard
				label="Total de Logs"
				value={stats.total}
				accentColor="var(--foreground)"
			/>
			<KpiCard
				label="Erros"
				value={stats.erros}
				accentColor="var(--destructive)"
				subtitle={
					stats.errorRate > 0 ? `${stats.errorRate}% do total` : undefined
				}
			/>
			<KpiCard
				label="Avisos"
				value={stats.avisos}
				accentColor="var(--chart-4)"
			/>
			<KpiCard label="Info" value={stats.infos} accentColor="var(--primary)" />
		</div>
	);
}
