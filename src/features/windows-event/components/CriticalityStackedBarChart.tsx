// src/features/windows-event/components/CriticalityStackedBarChart.tsx
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
import { DailyCriticalityEntry } from "../useWindowsStats";

interface CriticalityStackedBarChartProps {
	data: DailyCriticalityEntry[];
}

/**
 * Gráfico de barras empilhadas — distribuição de criticidade por dia.
 *
 * Por que barras empilhadas e não o Donut original?
 *
 * O Donut mostra apenas proporção total (High/Medium/Low de todos os logs).
 * Para alta cardinalidade de eventos Windows, isso esconde informação crítica:
 * - Quando ocorreu o pico de eventos?
 * - A criticidade aumentou ao longo do tempo?
 * - Há dias anômalos que precisam de investigação?
 *
 * O Stacked Bar responde todas essas perguntas simultaneamente:
 * - Eixo X = tempo (tendência visível)
 * - Altura total da barra = volume do dia
 * - Segmentos coloridos = severidade de cada dia
 *
 * É o formato recomendado pela literatura de análise operacional de logs
 * (ex: Elastic/Kibana usa exatamente este padrão por padrão).
 */
export function CriticalityStackedBarChart({
	data,
}: CriticalityStackedBarChartProps) {
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

	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				padding: "20px 24px",
			}}
		>
			{/* Cabeçalho */}
			<div style={{ marginBottom: 20 }}>
				<div
					style={{
						fontSize: 14,
						fontWeight: 700,
						color: "var(--foreground)",
					}}
				>
					Distribuição de Criticidade por Dia
				</div>
				<div
					style={{
						fontSize: 11,
						color: "var(--muted-foreground)",
						marginTop: 2,
					}}
				>
					Últimos {data.length} dias com eventos registrados
				</div>
			</div>

			<ResponsiveContainer width="100%" height={260}>
				<BarChart
					data={data}
					barSize={data.length > 30 ? 8 : 12}
					barCategoryGap="30%"
				>
					<CartesianGrid
						strokeDasharray="3 3"
						stroke="var(--border)"
						vertical={false}
					/>
					<XAxis
						dataKey="date"
						tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
						axisLine={false}
						tickLine={false}
						// Limita o número de ticks visíveis para não poluir o eixo X
						interval={Math.max(0, Math.floor(data.length) - 31)}
					/>
					<YAxis
						tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
						axisLine={false}
						tickLine={false}
						width={36}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: "var(--card)",
							border: "1px solid var(--border)",
							borderRadius: 6,
							fontSize: 12,
						}}
						labelStyle={{ fontWeight: 700, marginBottom: 4 }}
					/>
					<Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
					{/*
						stackId="criticality" faz as três barras empilharem no mesmo slot.
						A ordem importa visualmente: Alta fica no topo (mais urgente).
					*/}
					<Bar
						dataKey="low"
						name="Baixa"
						stackId="criticality"
						fill="var(--chart-4)"
						radius={[0, 0, 0, 0]}
					/>
					<Bar
						dataKey="medium"
						name="Média"
						stackId="criticality"
						fill="var(--chart-5)"
						radius={[0, 0, 0, 0]}
					/>
					<Bar
						dataKey="high"
						name="Alta"
						stackId="criticality"
						fill="var(--destructive)"
						radius={[3, 3, 0, 0]} // borda arredondada só no topo da pilha
					/>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
