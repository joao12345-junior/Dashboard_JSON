// src/features/windows-event/components/CriticalityDistribution.tsx
import { StatusDonutChart } from "../../../components/charts/StatusDonutCard";
import { WindowsStats } from "../useWindowsStats";

interface CriticalityDistributionProps {
	stats: WindowsStats;
}

export function CriticalityDistribution({
	stats,
}: CriticalityDistributionProps) {
	// Converte as métricas de criticidade para o formato que o StatusDonutChart espera
	// Filtra valores zero para não poluir o gráfico com fatias invisíveis
	const data = [
		{ name: "Alta", value: stats.high, fill: "var(--destructive)" },
		{ name: "Média", value: stats.medium, fill: "var(--chart-5)" },
		{ name: "Baixa", value: stats.low, fill: "var(--chart-4)" },
	].filter((entry) => entry.value > 0);

	if (data.length === 0) {
		return (
			<div
				style={{
					backgroundColor: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 10,
					padding: "40px 24px",
					textAlign: "center",
					color: "var(--muted-foreground)",
					fontSize: 13,
				}}
			>
				Nenhum dado para exibir
			</div>
		);
	}

	return <StatusDonutChart data={data} />;
}
