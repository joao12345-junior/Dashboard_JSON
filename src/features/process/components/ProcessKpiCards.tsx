// src/features/process/components/ProcessKpiCards.tsx
import { KpiCard } from "../../../components/charts/KpyCard";
import { ProcessStats } from "../useProcessStats";

interface ProcessKpiCardsProps {
	stats: ProcessStats;
	isMobile: boolean;
}

export function ProcessKpiCards({ stats, isMobile }: ProcessKpiCardsProps) {
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
				value={stats.errors}
				accentColor="var(--destructive)"
				subtitle={
					stats.errorRate > 0 ? `${stats.errorRate}% do total` : undefined
				}
			/>
			<KpiCard
				label="Ativos"
				value={stats.active}
				accentColor="var(--primary)"
			/>
			<KpiCard
				label="Finalizados"
				value={stats.finished}
				accentColor="var(--chart-4)"
			/>
		</div>
	);
}
