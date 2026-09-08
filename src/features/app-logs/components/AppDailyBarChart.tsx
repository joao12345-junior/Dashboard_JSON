// src/features/app-logs/components/AppDailyBarChart.tsx
import { useState } from "react";
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
import { DailyAppEntry, DailyProgramEntry, AppStats } from "../useAppStats";

interface AppDailyBarChartProps {
	data: DailyAppEntry[];
	programaData: DailyProgramEntry[];
	topProgramas: AppStats["topProgramas"];
}

const PROGRAMA_COLORS = [
	"var(--program-1)",
	"var(--program-2)",
	"var(--program-3)",
	"var(--program-4)",
	"var(--program-5)",
];

function toggleStyle(active: boolean): React.CSSProperties {
	return {
		padding: "5px 12px",
		borderRadius: 20,
		border: active ? "none" : "1px solid var(--border)",
		backgroundColor: active
			? "color-mix(in oklch, var(--primary) 15%, transparent)"
			: "transparent",
		color: active ? "var(--primary)" : "var(--muted-foreground)",
		fontSize: 11,
		fontWeight: active ? 700 : 400,
		cursor: "pointer",
		fontFamily: "inherit",
	};
}

export function AppDailyBarChart({
	data,
	programaData,
	topProgramas,
}: AppDailyBarChartProps) {
	const [view, setView] = useState<"tipo" | "programa">("tipo");

	const topNames = topProgramas.slice(0, 5).map((p) => p.name);

	const programaFlat = programaData.map((entry) => {
		const row: Record<string, string | number> = { date: entry.date };
		for (const [name, count] of Object.entries(entry.counts)) {
			if (topNames.includes(name)) row[name] = count;
		}
		return row;
	});

	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				padding: "20px 24px",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 16,
				}}
			>
				<h3
					style={{
						margin: 0,
						fontSize: 13,
						fontWeight: 700,
						color: "var(--foreground)",
						letterSpacing: "-0.02em",
					}}
				>
					Logs por dia
				</h3>
				<div style={{ display: "flex", gap: 4 }}>
					<button
						style={toggleStyle(view === "tipo")}
						onClick={() => setView("tipo")}
					>
						Por tipo
					</button>
					<button
						style={toggleStyle(view === "programa")}
						onClick={() => setView("programa")}
					>
						Por programa
					</button>
				</div>
			</div>

			<ResponsiveContainer width="100%" height={220}>
				{view === "tipo" ? (
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
				) : (
					<BarChart data={programaFlat} barSize={16} barCategoryGap="20%">
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
							interval={Math.max(0, Math.floor(programaFlat.length) - 30)}
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
						{topNames.map((name, i) => (
							<Bar
								key={name}
								dataKey={name}
								name={name}
								stackId="a"
								fill={PROGRAMA_COLORS[i]}
								radius={i === topNames.length - 1 ? [3, 3, 0, 0] : undefined}
							/>
						))}
					</BarChart>
				)}
			</ResponsiveContainer>
		</div>
	);
}
