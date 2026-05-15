// src/components/charts/StatusDonutChart.tsx
import {
	PieChart,
	Pie,
	Sector,
	Tooltip,
	ResponsiveContainer,
	Legend,
} from "recharts";
import type { SectorProps } from "recharts"; // ← Recharts exporta esse tipo

interface StatusDonutChartProps {
	data: { name: string; value: number; fill: string }[];
}

export function StatusDonutChart({ data }: StatusDonutChartProps) {
	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				padding: "20px 24px",
			}}
		>
			<h3
				style={{
					margin: "0 0 20px",
					fontSize: 13,
					fontWeight: 700,
					color: "var(--foreground)",
					letterSpacing: "-0.02em",
				}}
			>
				Distribuição por status
			</h3>

			<ResponsiveContainer width="100%" height={220}>
				<PieChart>
					<Pie
						data={data}
						cx="50%"
						cy="50%"
						innerRadius={60}
						outerRadius={90}
						paddingAngle={3}
						dataKey="value"
						shape={(props: SectorProps) => (
							<Sector {...props} fill={props.fill} />
						)}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: "var(--card)",
							border: "1px solid var(--border)",
							borderRadius: 6,
							fontSize: 12,
						}}
					/>
					<Legend wrapperStyle={{ fontSize: 11 }} />
				</PieChart>
			</ResponsiveContainer>
		</div>
	);
}
