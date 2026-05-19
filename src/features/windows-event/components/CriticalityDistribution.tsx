// src/features/windows-event/components/CriticalityDistribution.tsx
import { CriticalityStackedBarChart } from "./CriticalityStackedBarChart";
import { WindowsStats } from "../useWindowsStats";

interface CriticalityDistributionProps {
	stats: WindowsStats;
}

/**
 * Container de distribuição de criticidade.
 *
 * Foi removido: StatusDonutChart — inadequado para alto volume de dados.
 * Foi adicionado: CriticalityStackedBarChart — mostra tendência temporal
 * e volume simultâneo, o que é essencial para análise operacional.
 */
export function CriticalityDistribution({
	stats,
}: CriticalityDistributionProps) {
	return <CriticalityStackedBarChart data={stats.dailyByCriticality} />;
}
