// src/features/network/components/DeviceHistoryPanel.tsx
import React, { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { useNetworkPolling } from "../hooks/useNetworkPolling";
import type { NetworkDevice } from "../hooks/useNetworkState";
import { formatAxisTime, WAN_PERIODS, type WanPeriodKey } from "../wanHistory";
import {
	buildDeviceChartData,
	formatDelta,
	summarizeDevice,
	type DeviceHistoryResponse,
} from "../deviceHistory";

const sectionLabel: React.CSSProperties = {
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
};

function pct(value: number | null): string {
	return value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
	return (
		<div style={{ flex: "1 1 120px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
			<span style={sectionLabel}>{label}</span>
			<span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
			{hint && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{hint}</span>}
		</div>
	);
}

interface DeviceHistoryPanelProps {
	/** Gateway primeiro, depois os demais (ordem dos botões). Não pode ser vazio: o pai só renderiza com dispositivos. */
	devices: readonly [NetworkDevice, ...NetworkDevice[]];
}

/// <summary>
/// CPU e memória de um dispositivo UniFi ao longo do tempo (Rede > Painel), com os
/// mesmos períodos do gráfico de Internet. Criado para acompanhar a carga do gateway
/// (24/11: memória e CPU subiram a partir das 14:55). O poller já recebia esses números
/// a cada ciclo; agora também os guarda (migração 020), sem chamada nova ao UCG.
/// Histórico só a partir do deploy.
/// </summary>
export function DeviceHistoryPanel({ devices }: DeviceHistoryPanelProps) {
	const [period, setPeriod] = useState<WanPeriodKey>("1d");
	const [chosenMac, setChosenMac] = useState<string | null>(null);
	const mac = chosenMac && devices.some((d) => d.mac === chosenMac) ? chosenMac : devices[0].mac;

	const history = useNetworkPolling<DeviceHistoryResponse>(
		`/api/network/devices/${encodeURIComponent(mac)}/history?period=${period}`,
		"Erro ao buscar o histórico do dispositivo",
	);
	// Troca de dispositivo: até chegar a resposta nova, não mostra a do anterior.
	const data = history.data && history.data.mac === mac ? history.data : null;
	const points = useMemo(() => data?.points ?? [], [data]);
	const until = data ? Date.parse(data.server_time) : 0;
	const since = data ? until - data.span_seconds * 1000 : 0;
	const chartData = useMemo(
		() => (data ? buildDeviceChartData(points, data.step_seconds, since, until) : []),
		[data, points, since, until],
	);
	const summary = useMemo(() => summarizeDevice(points), [points]);

	return (
		<section
			aria-label="CPU e memória dos dispositivos"
			style={{
				minWidth: 0,
				padding: 16,
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: "var(--card)",
				display: "flex",
				flexDirection: "column",
				gap: 14,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
				<h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>CPU e memória</h3>
				{devices.length > 1 && (
					<SegmentedControl
						label="Dispositivo"
						options={devices.map((d) => ({ value: d.mac, label: d.name ?? d.mac, title: d.model ?? undefined }))}
						value={mac}
						onChange={setChosenMac}
					/>
				)}
				<div style={{ marginLeft: "auto" }}>
					<SegmentedControl label="Período de CPU e memória" options={WAN_PERIODS} value={period} onChange={setPeriod} />
				</div>
			</div>

			{history.error && !data ? (
				<p role="status" style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
					Não foi possível carregar o histórico ({history.error}).
				</p>
			) : !data ? (
				<p role="status" style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
					Carregando…
				</p>
			) : points.length === 0 ? (
				<p role="status" style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
					Sem histórico ainda. Começa a encher depois da migração 020 e do reinício do{" "}
					<code>LogDashUnifiPoller</code> (um ponto por minuto).
				</p>
			) : (
				<>
					<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
						<Stat label="CPU" value={pct(summary.cpuAvg)} hint={`máx. ${pct(summary.cpuMax)}`} />
						<Stat label="Memória" value={pct(summary.memoryAvg)} hint={`máx. ${pct(summary.memoryMax)}`} />
						<Stat
							label="Memória no período"
							value={formatDelta(summary.memoryDelta)}
							hint="do primeiro ao último ponto"
						/>
					</div>
					<ResponsiveContainer width="100%" height={170}>
						<LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
							<XAxis
								dataKey="t"
								type="number"
								scale="time"
								domain={[since, until]}
								tickFormatter={(t: number) => formatAxisTime(t, period)}
								tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
								axisLine={false}
								tickLine={false}
								minTickGap={40}
							/>
							<YAxis
								domain={[0, 100]}
								tickFormatter={(v: number) => `${v}%`}
								tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
								axisLine={false}
								tickLine={false}
								width={44}
							/>
							<Tooltip
								contentStyle={{
									backgroundColor: "var(--card)",
									border: "1px solid var(--border)",
									borderRadius: 6,
									fontSize: 12,
								}}
								labelFormatter={(t) => formatAxisTime(Number(t), "1h") + " · " + formatAxisTime(Number(t), "1m")}
								formatter={(value, name) => [pct(typeof value === "number" ? value : null), name]}
							/>
							<Line
								type="monotone"
								dataKey="memory"
								name="Memória"
								stroke="var(--primary)"
								strokeWidth={1.5}
								dot={false}
								connectNulls={false}
								isAnimationActive={false}
							/>
							<Line
								type="monotone"
								dataKey="cpu"
								name="CPU"
								stroke="var(--chart-4)"
								strokeWidth={1.5}
								dot={false}
								connectNulls={false}
								isAnimationActive={false}
							/>
						</LineChart>
					</ResponsiveContainer>
				</>
			)}

			<p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)" }}>
				Média por ponto (uma amostra por minuto do poller, sem chamada extra ao UniFi). Histórico de 31 dias a partir do
				deploy.
			</p>
		</section>
	);
}
