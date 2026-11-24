// src/features/network/components/WanHistoryPanel.tsx
import React, { useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { useNetworkPolling } from "../hooks/useNetworkPolling";
import type { WanLink } from "../hooks/useNetworkExtras";
import { formatBitrate } from "../format";
import {
	buildWanChartData,
	formatAxisTime,
	summarizeLoss,
	summarizeWan,
	WAN_PERIODS,
	type WanHistoryResponse,
	type WanPeriodKey,
} from "../wanHistory";

const DOWNLOAD_COLOR = "var(--primary)";
const UPLOAD_COLOR = "var(--chart-4)";
const LATENCY_COLOR = "var(--chart-4)";

const sectionLabel: React.CSSProperties = {
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
};

const tooltipStyle: React.CSSProperties = {
	backgroundColor: "var(--card)",
	border: "1px solid var(--border)",
	borderRadius: 6,
	fontSize: 12,
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
	return (
		<div style={{ flex: "1 1 140px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
			<span style={sectionLabel}>{label}</span>
			<span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
			{hint && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{hint}</span>}
		</div>
	);
}

function formatMs(value: number | null): string {
	return value === null ? "—" : `${Math.round(value)} ms`;
}

function formatPct(value: number | null): string {
	return value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function wanLabel(group: string, wans: readonly WanLink[]): string {
	const wan = wans.find((w) => w.wan_group === group);
	return wan?.name ?? wan?.isp_name ?? group;
}

interface WanHistoryPanelProps {
	/** Estado atual das WANs (para os nomes e a ordem dos botões). */
	wans: readonly WanLink[];
}

/// <summary>
/// Gráfico "Internet" do Rede > Painel, no estilo do UniFi: tráfego (download e
/// upload) e latência de um link por vez, em 1 h / 1 dia / 1 semana / 1 mês. Cada ponto
/// é a média das amostras do poller (uma por minuto) dentro do intervalo; o tooltip
/// mostra também o pico. Buracos na linha = poller sem amostra (não é tráfego zero).
/// As regras ficam em `wanHistory.ts`; aqui é só busca e desenho.
/// </summary>
export function WanHistoryPanel({ wans }: WanHistoryPanelProps) {
	const [period, setPeriod] = useState<WanPeriodKey>("1d");
	const [chosenWan, setChosenWan] = useState<string | null>(null);
	const history = useNetworkPolling<WanHistoryResponse>(
		`/api/network/wan/history?period=${period}`,
		"Erro ao buscar o histórico de internet",
	);

	const data = history.data;
	// Ordem dos botões: a das WANs atuais; WAN que só existe no histórico vai no fim.
	const groups = useMemo(() => {
		const fromState = wans.map((w) => w.wan_group);
		const fromHistory = Object.keys(data?.series ?? {}).filter((g) => !fromState.includes(g));
		return [...fromState, ...fromHistory];
	}, [wans, data]);
	const wanGroup = chosenWan && groups.includes(chosenWan) ? chosenWan : (groups[0] ?? null);

	const points = useMemo(
		() => (data && wanGroup ? (data.series[wanGroup] ?? []) : []),
		[data, wanGroup],
	);
	const quality = useMemo(
		() => (data && wanGroup ? (data.quality?.[wanGroup] ?? []) : []),
		[data, wanGroup],
	);
	const loss = useMemo(() => summarizeLoss(quality), [quality]);
	const until = data ? Date.parse(data.server_time) : 0;
	const since = data ? until - data.span_seconds * 1000 : 0;
	const chartData = useMemo(
		() => (data ? buildWanChartData(points, data.step_seconds, since, until, quality) : []),
		[data, points, since, until, quality],
	);
	const summary = useMemo(() => summarizeWan(points), [points]);
	const hasData = points.length > 0;
	const downBuckets = chartData.filter((p) => p.down).length;

	const xAxis = (
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
	);

	return (
		<section
			aria-label="Internet: histórico dos links"
			style={{
				minWidth: 0,
				padding: 16,
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: "var(--card)",
				display: "flex",
				flexDirection: "column",
				gap: 14,
				flexShrink: 0,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
				<h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Internet</h3>
				{groups.length > 1 && (
					<SegmentedControl
						label="Link de internet"
						options={groups.map((g) => ({ value: g, label: wanLabel(g, wans), title: g }))}
						value={wanGroup ?? ""}
						onChange={setChosenWan}
					/>
				)}
				<div style={{ marginLeft: "auto" }}>
					<SegmentedControl label="Período" options={WAN_PERIODS} value={period} onChange={setPeriod} />
				</div>
			</div>

			{history.error && !data ? (
				<p role="status" style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
					Não foi possível carregar o histórico ({history.error}).
				</p>
			) : history.loading && !data ? (
				<p role="status" style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
					Carregando…
				</p>
			) : !hasData ? (
				<p role="status" style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
					Sem histórico deste link no período. O gráfico começa a encher depois da migração 017 e do
					reinício do serviço <code>LogDashUnifiPoller</code> (um ponto por minuto).
				</p>
			) : (
				<>
					<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
						<Stat label="Download" value={formatBitrate(summary.rxAvg)} hint={`pico ${formatBitrate(summary.rxPeak)}`} />
						<Stat label="Upload" value={formatBitrate(summary.txAvg)} hint={`pico ${formatBitrate(summary.txPeak)}`} />
						<Stat label="Latência" value={formatMs(summary.latencyAvg)} hint={`máx. ${formatMs(summary.latencyMax)}`} />
						<Stat
							label="Perda de pacotes"
							value={formatPct(loss.avg)}
							hint={loss.max === null ? "sem medição ainda" : `pior intervalo ${formatPct(loss.max)}`}
						/>
						<Stat
							label="No ar"
							value={summary.uptimePct === null ? "—" : `${summary.uptimePct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
							hint={downBuckets > 0 ? `${downBuckets} intervalo(s) com queda` : "sem quedas vistas pelo poller"}
						/>
					</div>

					<div>
						<div style={{ ...sectionLabel, marginBottom: 6 }}>Tráfego (média por ponto)</div>
						<ResponsiveContainer width="100%" height={190}>
							<AreaChart data={chartData} syncId="wan-history" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
								{xAxis}
								<YAxis
									tickFormatter={(v: number) => formatBitrate(v)}
									tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
									axisLine={false}
									tickLine={false}
									width={72}
								/>
								<Tooltip
									contentStyle={tooltipStyle}
									labelFormatter={(t) => formatAxisTime(Number(t), "1h") + " · " + formatAxisTime(Number(t), "1m")}
									formatter={(value, name) => [formatBitrate(typeof value === "number" ? value : null), name]}
								/>
								<Area
									type="monotone"
									dataKey="rx"
									name="Download"
									stroke={DOWNLOAD_COLOR}
									fill={DOWNLOAD_COLOR}
									fillOpacity={0.25}
									strokeWidth={1.5}
									connectNulls={false}
									isAnimationActive={false}
								/>
								<Area
									type="monotone"
									dataKey="tx"
									name="Upload"
									stroke={UPLOAD_COLOR}
									fill={UPLOAD_COLOR}
									fillOpacity={0.2}
									strokeWidth={1.5}
									connectNulls={false}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>

					<div>
						<div style={{ ...sectionLabel, marginBottom: 6 }}>Latência (ms) e perda de pacotes (%)</div>
						<ResponsiveContainer width="100%" height={120}>
							<LineChart data={chartData} syncId="wan-history" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
								<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
								{xAxis}
								<YAxis
									yAxisId="loss"
									orientation="right"
									domain={[0, (max: number) => Math.max(5, Math.ceil(max))]}
									tickFormatter={(v: number) => `${v}%`}
									tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
									axisLine={false}
									tickLine={false}
									width={36}
								/>
								<YAxis
									tickFormatter={(v: number) => `${v} ms`}
									tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
									axisLine={false}
									tickLine={false}
									width={72}
								/>
								<Tooltip
									contentStyle={tooltipStyle}
									labelFormatter={(t) => formatAxisTime(Number(t), "1h") + " · " + formatAxisTime(Number(t), "1m")}
									formatter={(value, name) => [
										name === "Perda de pacotes"
											? formatPct(typeof value === "number" ? value : null)
											: formatMs(typeof value === "number" ? value : null),
										name,
									]}
								/>
								<Line
									type="monotone"
									dataKey="latency"
									name="Média"
									stroke={LATENCY_COLOR}
									strokeWidth={1.5}
									dot={false}
									connectNulls={false}
									isAnimationActive={false}
								/>
								<Line
									yAxisId="loss"
									type="stepAfter"
									dataKey="loss"
									name="Perda de pacotes"
									stroke="var(--destructive)"
									strokeWidth={1.5}
									dot={false}
									// Medição de 5 em 5 min: liga os pontos (null entre eles é "não medido", não falha).
									connectNulls
									isAnimationActive={false}
								/>
								<Line
									type="monotone"
									dataKey="latencyMax"
									name="Máxima"
									stroke="var(--muted-foreground)"
									strokeWidth={1}
									strokeDasharray="3 3"
									dot={false}
									connectNulls={false}
									isAnimationActive={false}
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				</>
			)}

			<p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)" }}>
				Tráfego e latência: amostra a cada minuto pelo poller. Perda de pacotes: medida pelo UniFi em intervalos de 5
				min, copiada a cada 15 min. Histórico de 31 dias a partir do deploy.
			</p>
		</section>
	);
}
