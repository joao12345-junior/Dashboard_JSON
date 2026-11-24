// src/features/network/NetworkDashboardPage.tsx
import React, { useMemo } from "react";
import { Globe, Router, Wifi, Cable } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/Error";
import type { Page, SharedPageProps } from "../../App";
import { btnSecondary } from "../../lib/styles/buttonStyles";
import { plural } from "../../lib/plural";
import { useNetworkClients, useNetworkDevices, type NetworkDevice } from "./hooks/useNetworkState";
import { useNetworkWan, type WanLink } from "./hooks/useNetworkExtras";
import { useNetworkPolling } from "./hooks/useNetworkPolling";
import type { NetworkEvent } from "./hooks/useNetworkEvents";
import { StaleDataBanner } from "./components/StaleDataBanner";
import { WanHistoryPanel } from "./components/WanHistoryPanel";
import { formatBitrate, formatBytes, formatUptime } from "./format";
import { formatEventTime } from "./formatEventTime";
import { clientTitle } from "./sortClients";
import { severityBarColor, severityLabel } from "./severity";
import {
	clientTraffic,
	clientsPerDevice,
	countNetwork,
	splitGateway,
	topClientsByTraffic,
} from "./networkDashboard";

const TOP_CLIENTS = 8;
const RECENT_ALERTS = 6;

const cardStyle: React.CSSProperties = {
	borderRadius: 8,
	border: "1px solid var(--border)",
	backgroundColor: "var(--card)",
	padding: 16,
	display: "flex",
	flexDirection: "column",
	gap: 12,
	minWidth: 0,
};

const cardTitle: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700 };

const sectionLabel: React.CSSProperties = {
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
};

const rowStyle: React.CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "baseline",
	gap: 12,
	fontSize: 13,
};

const muted: React.CSSProperties = { color: "var(--muted-foreground)" };

const linkButton: React.CSSProperties = {
	background: "none",
	border: "none",
	padding: 0,
	fontFamily: "inherit",
	fontSize: 12,
	fontWeight: 600,
	color: "var(--primary)",
	cursor: "pointer",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div style={rowStyle}>
			<span style={muted}>{label}</span>
			<span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", minWidth: 0, overflowWrap: "anywhere" }}>
				{children}
			</span>
		</div>
	);
}

function CardHeader({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
	return (
		<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
			<h3 style={cardTitle}>{title}</h3>
			{action && (
				<button type="button" className="ld-link-btn" style={linkButton} onClick={action.onClick}>
					{action.label} →
				</button>
			)}
		</div>
	);
}

/** Uma WAN no cartão do gateway: status, IP, latência e taxa agora. */
function WanRow({ wan }: { wan: WanLink }) {
	const down = wan.is_up === false;
	const disabled = wan.is_enabled === false;
	const status = disabled ? "Desativada" : down ? "Offline" : "Online";
	const color = disabled ? "var(--muted-foreground)" : down ? "var(--destructive)" : "var(--primary)";
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 4,
				padding: "8px 10px",
				borderRadius: 6,
				border: `1px solid ${down ? "var(--destructive)" : "var(--border)"}`,
				opacity: disabled ? 0.6 : 1,
			}}
		>
			<div style={{ ...rowStyle, alignItems: "center" }}>
				<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, minWidth: 0 }}>
					<span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color, flexShrink: 0 }} />
					<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
						{wan.name ?? wan.wan_group}
					</span>
				</span>
				<span style={{ fontSize: 12, fontWeight: 600, color: down ? "var(--destructive-text)" : "var(--foreground)" }}>
					{status}
					{!down && !disabled && wan.availability_pct !== null ? ` · ${Math.round(wan.availability_pct)}%` : ""}
				</span>
			</div>
			<div style={{ ...rowStyle, fontSize: 12 }}>
				<span style={muted}>
					{[wan.isp_name, wan.failover_only ? "somente failover" : null].filter(Boolean).join(" · ") || wan.wan_group}
				</span>
				<span style={{ fontFamily: "monospace", ...muted }}>{wan.ip_address ?? "—"}</span>
			</div>
			{!down && !disabled && (
				<div style={{ ...rowStyle, fontSize: 12 }}>
					<span>
						↓ {formatBitrate(wan.rx_bps)} · ↑ {formatBitrate(wan.tx_bps)}
					</span>
					<span style={muted}>{wan.latency_ms !== null ? `${Math.round(wan.latency_ms)} ms` : "—"}</span>
				</div>
			)}
		</div>
	);
}

function DeviceRow({ device, clients }: { device: NetworkDevice; clients: number }) {
	const online = device.state === "ONLINE";
	return (
		<li style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
			<Wifi size={16} aria-hidden="true" style={{ flexShrink: 0, color: online ? "var(--foreground)" : "var(--destructive-text)" }} />
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
					{device.name ?? device.mac}
				</div>
				<div style={{ fontSize: 11, ...muted }}>
					{[device.model, device.ip_address].filter(Boolean).join(" · ")}
				</div>
			</div>
			<div style={{ textAlign: "right", fontSize: 12, flexShrink: 0 }}>
				<div style={{ fontWeight: 600, color: online ? "var(--foreground)" : "var(--destructive-text)" }}>
					{online ? plural(clients, "cliente", "clientes") : (device.state ?? "Desconhecido")}
				</div>
				<div style={muted}>{online ? `ativo há ${formatUptime(device.uptime_sec)}` : ""}</div>
			</div>
		</li>
	);
}

/// <summary>
/// Rede > Painel: a "home" da rede, no espírito da tela inicial do UniFi. Junta o que
/// hoje está espalhado em Clientes, Dispositivos, Topologia e Eventos:
///  - à esquerda, o gateway (modelo, IP, tempo ligado, CPU/memória), os totais e cada
///    link de internet com estado, IP, latência e taxa atual;
///  - à direita, o gráfico "Internet" (histórico de tráfego e latência);
///  - embaixo, os clientes que mais usaram a rede, os APs/switches e os últimos alertas.
/// Só lê das rotas que já existem; a lógica de resumo está em `networkDashboard.ts`.
/// "Principais aplicativos" (DPI) ainda não tem fonte: depende da saída do probe.
/// </summary>
export function NetworkDashboardPage({ isMobile, onNavigate }: SharedPageProps) {
	const devicesState = useNetworkDevices();
	const clientsState = useNetworkClients("connected", "");
	const wanState = useNetworkWan();
	const alertsState = useNetworkPolling<{ events: NetworkEvent[] }>(
		`/api/network/events?limit=${RECENT_ALERTS}&min_severity=4`,
		"Erro ao buscar alertas de rede",
	);

	const devices = useMemo(() => devicesState.data?.devices ?? [], [devicesState.data]);
	const clients = useMemo(() => clientsState.data?.clients ?? [], [clientsState.data]);
	const wans = wanState.data?.wans ?? [];
	const alerts = alertsState.data?.events ?? [];

	const { gateway, others } = useMemo(() => splitGateway(devices), [devices]);
	const counts = useMemo(() => countNetwork(devices, clients), [devices, clients]);
	const perDevice = useMemo(() => clientsPerDevice(clients), [clients]);
	const topClients = useMemo(() => topClientsByTraffic(clients, TOP_CLIENTS), [clients]);
	const maxTraffic = topClients.length > 0 ? (clientTraffic(topClients[0]) ?? 0) : 0;

	function reload() {
		devicesState.reload();
		clientsState.reload();
		wanState.reload();
		alertsState.reload();
	}

	const go = (page: Page) => () => onNavigate(page);
	const firstLoad = devicesState.loading && !devicesState.data;

	return (
		<div style={{ display: "flex", flex: 1, minWidth: 0, height: "100vh", overflow: "hidden", backgroundColor: "var(--background)" }}>
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
					title="Rede — Painel"
					subtitle={
						firstLoad
							? "Carregando…"
							: `UniFi · ${plural(counts.clientsConnected, "cliente conectado", "clientes conectados")} · ${counts.devicesOnline}/${counts.devicesTotal} dispositivos online`
					}
					spacing="compact"
					wrap
				>
					<button onClick={reload} style={btnSecondary}>
						↺ Recarregar
					</button>
				</PageHeader>

				<StaleDataBanner polledAt={devicesState.data?.polled_at ?? null} />

				{devicesState.error && !devicesState.data ? (
					<ErrorState title="Erro ao carregar a rede" message={devicesState.error} onRetry={reload} />
				) : (
					<>
						{/* Gateway + gráfico */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 320px) minmax(0, 1fr)",
								gap: 16,
								alignItems: "start",
							}}
						>
							<section aria-label="Gateway e links de internet" style={cardStyle}>
								<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
									<Router size={22} aria-hidden="true" style={{ flexShrink: 0 }} />
									<div style={{ minWidth: 0 }}>
										<h3 style={cardTitle}>{gateway?.name ?? "Gateway"}</h3>
										<div style={{ fontSize: 12, ...muted }}>
											{[gateway?.model, gateway?.firmware_version].filter(Boolean).join(" · ") || "sem dados do gateway"}
										</div>
									</div>
								</div>

								<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
									{[
										{ icon: Cable, value: counts.wired, label: "com fio" },
										{ icon: Wifi, value: counts.wifi, label: "Wi-Fi" },
										{ icon: Router, value: `${counts.devicesOnline}/${counts.devicesTotal}`, label: "dispositivos" },
									].map(({ icon: Icon, value, label }) => (
										<div key={label} style={{ padding: "8px 4px", borderRadius: 6, backgroundColor: "var(--muted)" }}>
											<Icon size={14} aria-hidden="true" style={muted} />
											<div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
											<div style={{ fontSize: 11, ...muted }}>{label}</div>
										</div>
									))}
								</div>

								{gateway && (
									<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
										<Row label="Tempo ligado">{formatUptime(gateway.uptime_sec)}</Row>
										<Row label="CPU / memória">
											{gateway.cpu_pct !== null ? `${Math.round(gateway.cpu_pct)}%` : "—"} /{" "}
											{gateway.memory_pct !== null ? `${Math.round(gateway.memory_pct)}%` : "—"}
										</Row>
										<Row label="Firmware">
											{gateway.firmware_updatable ? (
												<span style={{ color: "var(--warning-text)", fontWeight: 600 }}>atualização disponível</span>
											) : (
												"atualizado"
											)}
										</Row>
										{counts.guests > 0 && <Row label="Convidados">{counts.guests}</Row>}
									</div>
								)}

								<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
									<span style={{ ...sectionLabel, display: "inline-flex", alignItems: "center", gap: 6 }}>
										<Globe size={12} aria-hidden="true" /> Internet
									</span>
									{wans.length === 0 ? (
										<span style={{ fontSize: 12, ...muted }}>
											{wanState.error ? `Indisponível (${wanState.error}).` : "Sem dados dos links ainda."}
										</span>
									) : (
										wans.map((w) => <WanRow key={w.wan_group} wan={w} />)
									)}
								</div>

								<div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
									<button type="button" className="ld-link-btn" style={linkButton} onClick={go("network-topology")}>
										Topologia →
									</button>
									<button type="button" className="ld-link-btn" style={linkButton} onClick={go("network-devices")}>
										Dispositivos →
									</button>
								</div>
							</section>

							<WanHistoryPanel wans={wans} />
						</div>

						{/* Clientes, dispositivos, alertas */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))",
								gap: 16,
								alignItems: "start",
							}}
						>
							<section aria-label="Principais clientes" style={cardStyle}>
								<CardHeader title="Principais clientes" action={{ label: "Todos", onClick: go("network-clients") }} />
								<span style={{ fontSize: 11, ...muted, marginTop: -6 }}>tráfego desde que cada um conectou</span>
								{topClients.length === 0 ? (
									<span style={{ fontSize: 13, ...muted }}>Nenhum cliente com tráfego informado.</span>
								) : (
									<ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
										{topClients.map((c) => {
											const traffic = clientTraffic(c) ?? 0;
											return (
												<li key={c.mac} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
													<div style={{ ...rowStyle, fontSize: 12 }}>
														<span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
															{c.is_wired ? (
																<Cable size={12} aria-label="com fio" style={{ flexShrink: 0, ...muted }} />
															) : (
																<Wifi size={12} aria-label="Wi-Fi" style={{ flexShrink: 0, ...muted }} />
															)}
															<span
																title={c.note ?? undefined}
																style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
															>
																{clientTitle(c)}
															</span>
														</span>
														<span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{formatBytes(traffic)}</span>
													</div>
													<div
														aria-hidden="true"
														style={{ height: 4, borderRadius: 2, backgroundColor: "color-mix(in oklch, var(--muted-foreground) 15%, transparent)" }}
													>
														<div
															style={{
																height: "100%",
																width: `${maxTraffic > 0 ? Math.max(2, (traffic / maxTraffic) * 100) : 0}%`,
																borderRadius: 2,
																backgroundColor: "var(--primary)",
															}}
														/>
													</div>
												</li>
											);
										})}
									</ol>
								)}
							</section>

							<section aria-label="Dispositivos" style={cardStyle}>
								<CardHeader title="Dispositivos" action={{ label: "Todos", onClick: go("network-devices") }} />
								{others.length === 0 ? (
									<span style={{ fontSize: 13, ...muted }}>Nenhum AP ou switch além do gateway.</span>
								) : (
									<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
										{others.map((d) => (
											<DeviceRow key={d.mac} device={d} clients={perDevice.get(d.mac) ?? 0} />
										))}
									</ul>
								)}
							</section>

							<section aria-label="Alertas recentes" style={cardStyle}>
								<CardHeader title="Alertas recentes" action={{ label: "Eventos", onClick: go("network-events") }} />
								<span style={{ fontSize: 11, ...muted, marginTop: -6 }}>gravidade média ou alta</span>
								{alertsState.error && !alertsState.data ? (
									<span style={{ fontSize: 13, ...muted }}>Indisponível ({alertsState.error}).</span>
								) : alerts.length === 0 ? (
									<span style={{ fontSize: 13, ...muted }}>Nenhum alerta registrado.</span>
								) : (
									<ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
										{alerts.map((ev) => (
											<li
												key={ev.id}
												style={{ paddingLeft: 10, borderLeft: `3px solid ${severityBarColor(ev.severity)}`, fontSize: 12 }}
											>
												<div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
													{ev.extension.msg ?? ev.name ?? "Evento de rede"}
												</div>
												<div style={muted}>
													{formatEventTime(ev.event_time ?? ev.created_at)} · {severityLabel(ev.severity)}
													{ev.extension.UNIFIdeviceName ? ` · ${ev.extension.UNIFIdeviceName}` : ""}
												</div>
											</li>
										))}
									</ul>
								)}
							</section>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
