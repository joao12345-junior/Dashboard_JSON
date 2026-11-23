// src/features/network/components/NetworkSummaryCard.tsx
import React from "react";
import { Network } from "lucide-react";
import type { Page } from "../../../App";
import { useNetworkClients, useNetworkDevices } from "../hooks/useNetworkState";
import { useLatestNetworkAlert, useNetworkWan } from "../hooks/useNetworkExtras";
import { formatSince, isPollerStale } from "../format";
import { SeverityBadge } from "./SeverityBadge";

const ALERT_WINDOW_MS = 24 * 60 * 60 * 1000;

const itemStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 2,
	minWidth: 0,
};

const labelStyle: React.CSSProperties = {
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
};

const valueStyle: React.CSSProperties = {
	fontSize: 14,
	fontWeight: 700,
	color: "var(--foreground)",
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
};

/// <summary>
/// Resumo da rede na Home: links de internet, clientes conectados, dispositivos
/// online e o último alerta (gravidade média/alta) das últimas 24 h. Cada pedaço
/// carrega sozinho; se a rede não responder, o card avisa sem derrubar a Home.
/// </summary>
export function NetworkSummaryCard({ onNavigate, isMobile }: { onNavigate: (page: Page) => void; isMobile: boolean }) {
	const wan = useNetworkWan();
	const devices = useNetworkDevices();
	const clients = useNetworkClients("connected", "");
	const alert = useLatestNetworkAlert();

	const deviceList = devices.data?.devices ?? [];
	const online = deviceList.filter((d) => d.state === "ONLINE").length;
	const now = new Date();
	const latest = alert.data?.events[0] ?? null;
	const latestWhen = latest ? (latest.event_time ?? latest.created_at) : null;
	const recentAlert = latest && latestWhen && now.getTime() - new Date(latestWhen).getTime() < ALERT_WINDOW_MS ? latest : null;
	const stale = devices.data ? isPollerStale(devices.data.polled_at, now) : false;
	const failed = devices.error && !devices.data;

	return (
		<section
			aria-label="Resumo da rede"
			style={{
				flexShrink: 0,
				padding: "14px 20px",
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				display: "grid",
				gridTemplateColumns: isMobile ? "1fr 1fr" : "auto minmax(180px, 1.4fr) 1fr 1fr minmax(200px, 1.6fr) auto",
				gap: isMobile ? 12 : 24,
				alignItems: "center",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: isMobile ? "1 / -1" : undefined }}>
				<Network size={18} />
				<strong style={{ fontSize: 14, color: "var(--foreground)" }}>Rede</strong>
				{(stale || failed) && (
					<span style={{ fontSize: 11, color: "var(--warning-text)", fontWeight: 600 }}>
						{failed ? "sem resposta" : "dados desatualizados"}
					</span>
				)}
			</div>

			<div style={itemStyle}>
				<span style={labelStyle}>Internet</span>
				{wan.data && wan.data.wans.length > 0 ? (
					<span style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
						{wan.data.wans.map((w) => {
							const down = w.is_up === false;
							return (
								<span key={w.wan_group} style={{ ...valueStyle, fontSize: 13, color: down ? "var(--destructive-text)" : "var(--foreground)" }} title={w.ip_address ?? undefined}>
									{down ? "○" : "●"} {w.name ?? w.isp_name ?? w.wan_group}
									<span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>
										{down ? " offline" : w.latency_ms !== null ? ` ${Math.round(w.latency_ms)} ms` : ""}
									</span>
								</span>
							);
						})}
					</span>
				) : (
					<span style={{ ...valueStyle, color: "var(--muted-foreground)", fontWeight: 400, fontSize: 12 }}>—</span>
				)}
			</div>

			<div style={itemStyle}>
				<span style={labelStyle}>Clientes</span>
				<span style={valueStyle}>{clients.data ? `${clients.data.connected_count.toLocaleString("pt-BR")} conectados` : "—"}</span>
			</div>

			<div style={itemStyle}>
				<span style={labelStyle}>Dispositivos</span>
				<span style={{ ...valueStyle, color: devices.data && online < deviceList.length ? "var(--destructive-text)" : "var(--foreground)" }}>
					{devices.data ? `${online}/${deviceList.length} online` : "—"}
				</span>
			</div>

			<div style={{ ...itemStyle, gridColumn: isMobile ? "1 / -1" : undefined }}>
				<span style={labelStyle}>Último alerta (24 h)</span>
				{recentAlert ? (
					<span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }} title={recentAlert.extension.msg ?? undefined}>
						<SeverityBadge severity={recentAlert.severity} />
						<span style={{ ...valueStyle, fontSize: 12 }}>
							{recentAlert.name ?? "Sem nome"}
							<span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}> · {formatSince(latestWhen, now)}</span>
						</span>
					</span>
				) : (
					<span style={{ ...valueStyle, fontWeight: 400, fontSize: 12, color: "var(--muted-foreground)" }}>
						{alert.data ? "Nenhum alerta" : "—"}
					</span>
				)}
			</div>

			<div style={{ display: "flex", gap: 8, justifyContent: isMobile ? "flex-start" : "flex-end", gridColumn: isMobile ? "1 / -1" : undefined }}>
				<button type="button" className="ld-link-btn" onClick={() => onNavigate("network-topology")} style={linkStyle}>
					Topologia →
				</button>
				<button type="button" className="ld-link-btn" onClick={() => onNavigate("network-events")} style={linkStyle}>
					Eventos →
				</button>
			</div>
		</section>
	);
}

const linkStyle: React.CSSProperties = {
	background: "none",
	border: "none",
	padding: 0,
	cursor: "pointer",
	fontFamily: "inherit",
	fontSize: 12,
	fontWeight: 600,
	color: "var(--foreground)",
	whiteSpace: "nowrap",
};
