// src/features/app-logs/components/AppDailyBarChart.tsx
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} from "recharts";
import { DailyAppEntry } from "../useAppStats";

interface AppDailyBarChartProps {
	data: DailyAppEntry[];
}

export function AppDailyBarChart({ data }: AppDailyBarChartProps) {
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
				Logs por dia
			</h3>
			<ResponsiveContainer width="100%" height={220}>
				<BarChart data={data} barSize={8} barCategoryGap="30%">
					<CartesianGrid
						strokeDasharray="3 3"
						stroke="var(--border)"
						vertical={false}
					/>
					<XAxis
						dataKey="date"
						tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
						axisLine={false}
						tickLine={false}
						interval={Math.max(0, Math.floor(data.length) - 30)}
					/>
					<YAxis
						tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
						axisLine={false}
						tickLine={false}
						width={28}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: "var(--card)",
							border: "1px solid var(--border)",
							borderRadius: 6,
							fontSize: 12,
						}}
					/>
					<Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
					<Bar
						dataKey="erro"
						name="Erros"
						fill="var(--destructive)"
						radius={[3, 3, 0, 0]}
					/>
					<Bar
						dataKey="aviso"
						name="Avisos"
						fill="var(--chart-4)"
						radius={[3, 3, 0, 0]}
					/>
					<Bar
						dataKey="info"
						name="Info"
						fill="var(--primary)"
						radius={[3, 3, 0, 0]}
					/>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
