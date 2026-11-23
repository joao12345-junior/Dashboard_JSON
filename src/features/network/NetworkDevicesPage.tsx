// src/features/network/NetworkDevicesPage.tsx
import React, { useMemo } from "react";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/Error";
import type { SharedPageProps } from "../../App";
import { btnSecondary } from "../../lib/styles/buttonStyles";
import { plural } from "../../lib/plural";
import { KpiCard } from "../../components/charts/KpiCard";
import { Router, Wifi } from "lucide-react";
import { useNetworkClients, useNetworkDevices, type NetworkDevice } from "./hooks/useNetworkState";
import { StaleDataBanner } from "./components/StaleDataBanner";
import { formatBitrate, formatSince, formatUptime } from "./format";
import { formatEventTime } from "./formatEventTime";

/** Rótulos amigáveis dos recursos do UniFi; o que não está aqui aparece como veio. */
const FEATURE_LABELS: Record<string, string> = {
	accessPoint: "Ponto de acesso",
	switching: "Switch",
	gateway: "Gateway",
};

/** Modelos de gateway/roteador UniFi: o UniFi informa só "switching" para eles. */
const GATEWAY_MODEL = /^(UCG|UDM|UDR|UXG|USG)/i;

/** Rótulos do tipo do dispositivo; gateways ganham "Gateway" no lugar de "Switch". */
function deviceKinds(d: NetworkDevice): string {
	const labels = d.features.map((f) => FEATURE_LABELS[f] ?? f);
	if (d.model && GATEWAY_MODEL.test(d.model)) {
		return ["Gateway", ...labels.filter((l) => l !== "Switch")].join(", ");
	}
	return labels.join(", ");
}

/** Gateway primeiro, depois o restante por nome; o que está offline sobe logo após o gateway. */
function sortDevices(devices: NetworkDevice[]): NetworkDevice[] {
	const rank = (d: NetworkDevice) =>
		d.model && GATEWAY_MODEL.test(d.model) ? 0 : d.state !== "ONLINE" ? 1 : 2;
	return [...devices].sort(
		(a, b) =>
			rank(a) - rank(b) ||
			(a.name ?? a.mac).localeCompare(b.name ?? b.mac, "pt-BR", { numeric: true }),
	);
}

const emptyBoxStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 6,
	textAlign: "center",
	padding: "56px 16px",
	backgroundColor: "var(--card)",
	border: "1px solid var(--border)",
	borderRadius: 8,
	color: "var(--muted-foreground)",
	fontSize: 13,
};

const labelStyle: React.CSSProperties = {
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.08em",
	marginBottom: 2,
};

/** Barra de uso (CPU/memória): a cor sobe de tom com o uso, e o número fica sempre visível. */
function UsageBar({ label, pct }: { label: string; pct: number | null }) {
	const value = pct === null ? null : Math.max(0, Math.min(100, pct));
	const color =
		value === null
			? "var(--muted-foreground)"
			: value >= 90
				? "var(--destructive)"
				: value >= 75
					? "var(--chart-4)"
					: "var(--primary)";
	return (
		<div>
			<div style={{ display: "flex", justifyContent: "space-between", ...labelStyle }}>
				<span>{label}</span>
				<span style={{ color: "var(--foreground)" }}>
					{value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}
				</span>
			</div>
			<div
				role="meter"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={value ?? undefined}
				style={{
					height: 6,
					borderRadius: 3,
					backgroundColor: "var(--muted)",
					overflow: "hidden",
				}}
			>
				<div style={{ width: `${value ?? 0}%`, height: "100%", backgroundColor: color }} />
			</div>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div style={{ minWidth: 0 }}>
			<div style={labelStyle}>{label}</div>
			<div style={{ fontSize: 13, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis" }}>
				{children}
			</div>
		</div>
	);
}

function DeviceCard({
	device: d,
	now,
	clientCount,
}: {
	device: NetworkDevice;
	now: Date;
	/** Clientes conectados diretamente neste dispositivo; null se ainda não carregou. */
	clientCount: number | null;
}) {
	const online = d.state === "ONLINE";
	const kinds = deviceKinds(d);
	return (
		<article
			style={{
				backgroundColor: "var(--card)",
				border: `1px solid ${online ? "var(--border)" : "color-mix(in oklch, var(--destructive) 55%, var(--border))"}`,
				borderRadius: 8,
				padding: 16,
				display: "flex",
				flexDirection: "column",
				gap: 14,
			}}
		>
			<header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
				<span
					aria-hidden
					style={{
						flexShrink: 0,
						width: 36,
						height: 36,
						borderRadius: "50%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: d.features.includes("accessPoint") ? "var(--foreground)" : "transparent",
						color: d.features.includes("accessPoint") ? "var(--background)" : "var(--foreground)",
						border: "1px solid var(--border)",
					}}
				>
					{d.features.includes("accessPoint") ? <Wifi size={18} /> : <Router size={18} />}
				</span>
				<div style={{ minWidth: 0, flex: 1 }}>
					<h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
						{d.name ?? d.mac}
					</h2>
					<div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
						{[d.model, kinds].filter(Boolean).join(" · ") || "—"}
					</div>
				</div>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						padding: "3px 10px",
						borderRadius: 999,
						fontSize: 11,
						fontWeight: 700,
						whiteSpace: "nowrap",
						color: online ? "var(--foreground)" : "var(--destructive-text)",
						backgroundColor: online
							? "color-mix(in oklch, var(--primary) 15%, transparent)"
							: "color-mix(in oklch, var(--destructive) 15%, transparent)",
					}}
				>
					<span
						aria-hidden
						style={{
							width: 7,
							height: 7,
							borderRadius: "50%",
							backgroundColor: online ? "var(--primary)" : "var(--destructive)",
						}}
					/>
					{online ? "Online" : (d.state ?? "Desconhecido")}
				</span>
			</header>

			<UsageBar label="CPU" pct={d.cpu_pct} />
			<UsageBar label="Memória" pct={d.memory_pct} />

			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
				<Field label="IP">
					<span style={{ fontFamily: "monospace" }}>{d.ip_address ?? "—"}</span>
				</Field>
				<Field label="Ligado há">{formatUptime(d.uptime_sec)}</Field>
				<Field label="Clientes">
					{clientCount === null ? "—" : clientCount.toLocaleString("pt-BR")}
				</Field>
				<Field label="Firmware">
					{d.firmware_version ?? "—"}
					{d.firmware_updatable ? (
						<span style={{ color: "var(--warning-text)", fontWeight: 600 }}> · atualização disponível</span>
					) : null}
				</Field>
				<Field label="Uplink">
					↑ {formatBitrate(d.uplink_tx_bps)} · ↓ {formatBitrate(d.uplink_rx_bps)}
				</Field>
				<Field label="Último sinal">
					<span title={d.last_heartbeat_at ? formatEventTime(d.last_heartbeat_at) : undefined}>
						{formatSince(d.last_heartbeat_at, now)}
					</span>
				</Field>
				<Field label="MAC">
					<span style={{ fontFamily: "monospace", fontSize: 12 }}>{d.mac}</span>
				</Field>
			</div>
		</article>
	);
}

/// <summary>
/// Página "Rede — Dispositivos": gateway, APs e switches do UniFi com estado,
/// CPU, memória, uptime e tráfego do uplink. Atualiza sozinha a cada 30 s.
/// </summary>
export function NetworkDevicesPage({ isMobile }: SharedPageProps) {
	const { data, loading, error, lastRefresh, reload } = useNetworkDevices();
	const { data: clientsData } = useNetworkClients("connected", "");
	const devices = useMemo(() => sortDevices(data?.devices ?? []), [data]);
	const now = new Date();

	// Clientes conectados por dispositivo (uplink_mac), para o card e o KPI.
	const clientsByUplink = useMemo(() => {
		const map = new Map<string, number>();
		for (const c of clientsData?.clients ?? []) {
			if (c.uplink_mac) map.set(c.uplink_mac, (map.get(c.uplink_mac) ?? 0) + 1);
		}
		return map;
	}, [clientsData]);

	const onlineCount = devices.filter((d) => d.state === "ONLINE").length;
	const updatableCount = devices.filter((d) => d.firmware_updatable).length;

	return (
		<div
			style={{
				display: "flex",
				flex: 1,
				minWidth: 0,
				height: "100vh",
				overflow: "hidden",
				backgroundColor: "var(--background)",
			}}
		>
			<main
				style={{
					flex: 1,
					padding: isMobile ? "64px 16px 16px" : "32px",
					display: "flex",
					flexDirection: "column",
					gap: 16,
					minHeight: 0,
					overflowY: "auto",
					overflowX: "hidden",
				}}
			>
				<PageHeader
					title="Rede — Dispositivos"
					subtitle={
						loading && !data
							? "Carregando…"
							: `UniFi · ${plural(devices.length, "dispositivo", "dispositivos")}${
									lastRefresh
										? ` · atualizado às ${lastRefresh.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
										: ""
								}`
					}
					spacing="compact"
					wrap
				>
					<button onClick={reload} style={btnSecondary}>
						↺ Recarregar
					</button>
				</PageHeader>

				<StaleDataBanner polledAt={data?.polled_at ?? null} />

				{error && !data ? (
					<ErrorState title="Erro ao carregar dispositivos de rede" message={error} onRetry={reload} />
				) : !data ? (
					<div role="status" style={emptyBoxStyle}>
						Carregando dispositivos de rede…
					</div>
				) : devices.length === 0 ? (
					<div role="status" style={emptyBoxStyle}>
						<strong style={{ color: "var(--foreground)", fontSize: 14 }}>
							Nenhum dispositivo ainda
						</strong>
						<span>
							Confira se o serviço <code>LogDashUnifiPoller</code> está rodando no servidor.
						</span>
					</div>
				) : (
					<>
						{error && (
							<div role="alert" style={{ fontSize: 12, color: "var(--destructive-text)" }}>
								Não foi possível atualizar agora ({error}). Mostrando os últimos dados.
							</div>
						)}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
								gap: 12,
							}}
						>
							<KpiCard
								label="Dispositivos online"
								value={`${onlineCount}/${devices.length}`}
								accentColor={onlineCount === devices.length ? "var(--primary)" : "var(--destructive-text)"}
							/>
							<KpiCard
								label="Clientes conectados"
								value={clientsData ? clientsData.connected_count : "—"}
								accentColor="var(--chart-4)"
							/>
							<KpiCard
								label="Atualizações"
								value={updatableCount}
								accentColor={updatableCount > 0 ? "var(--warning-text)" : "var(--muted-foreground)"}
								subtitle={updatableCount > 0 ? "firmware disponível" : "tudo em dia"}
							/>
						</div>
						<div
							aria-busy={loading}
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
								gap: 16,
								alignItems: "start",
							}}
						>
							{devices.map((d) => (
								<DeviceCard key={d.mac} device={d} now={now} clientCount={clientsData ? (clientsByUplink.get(d.mac) ?? 0) : null} />
							))}
						</div>
					</>
				)}
			</main>
		</div>
	);
}
