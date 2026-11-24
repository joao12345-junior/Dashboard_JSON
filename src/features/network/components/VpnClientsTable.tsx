// src/features/network/components/VpnClientsTable.tsx
import React from "react";
import { ShieldCheck } from "lucide-react";
import { Highlighted } from "../../app-logs/components/AppLogFeed";
import { formatBytes, formatSince } from "../format";
import { formatEventTime } from "../formatEventTime";
import { vpnTypeLabel, type VpnClient } from "../vpnClients";

const COLUMNS = "minmax(180px, 1.3fr) 120px minmax(150px, 1fr) 150px 170px";

const headerStyle: React.CSSProperties = {
	position: "sticky",
	top: 0,
	display: "grid",
	gridTemplateColumns: COLUMNS,
	gap: 12,
	padding: "10px 16px",
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
	backgroundColor: "var(--card)",
	borderBottom: "1px solid var(--border)",
	zIndex: 1,
};

const muted: React.CSSProperties = { color: "var(--muted-foreground)" };

interface VpnClientsTableProps {
	clients: VpnClient[];
	isMobile: boolean;
	/** Texto buscado, para destacar. */
	highlight: string;
	now: Date;
}

/// <summary>
/// Lista dos usuários de VPN (no lugar da lista de clientes quando o filtro "VPN"
/// está ativo). Não reaproveita a linha dos clientes comuns porque o dado é outro:
/// não há MAC, AP nem sinal, e sim usuário, IP do túnel e IP de origem.
/// </summary>
export function VpnClientsTable({ clients, isMobile, highlight, now }: VpnClientsTableProps) {
	return (
		<>
			{!isMobile && (
				<div style={headerStyle}>
					<span>Usuário</span>
					<span>IP na VPN</span>
					<span>Conectou de</span>
					<span>Tráfego</span>
					<span>Estado</span>
				</div>
			)}
			{clients.map((c) => {
				const traffic =
					c.rx_bytes === null && c.tx_bytes === null ? null : (c.rx_bytes ?? 0) + (c.tx_bytes ?? 0);
				const state = c.connected
					? `Conectado ${formatSince(c.connected_since, now)}`
					: `Saiu ${formatSince(c.disconnected_at, now)}`;
				const stateTitle = c.connected
					? c.connected_since && `Desde ${formatEventTime(c.connected_since)}`
					: c.disconnected_at && `Em ${formatEventTime(c.disconnected_at)}`;
				return (
					<div
						key={c.client_key}
						style={{
							display: isMobile ? "flex" : "grid",
							flexDirection: "column",
							gridTemplateColumns: COLUMNS,
							gap: isMobile ? 2 : 12,
							alignItems: isMobile ? "flex-start" : "center",
							padding: "10px 16px",
							borderBottom: "1px solid var(--border)",
							fontSize: 13,
							opacity: c.connected ? 1 : 0.7,
						}}
					>
						<span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0, fontWeight: 600 }}>
							<ShieldCheck size={16} aria-hidden="true" style={{ flexShrink: 0, ...muted }} />
							<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
								<Highlighted text={c.username} term={highlight} />
							</span>
							<span style={{ fontSize: 11, fontWeight: 500, ...muted }}>{vpnTypeLabel(c.vpn_type)}</span>
						</span>
						<span style={{ fontFamily: "monospace", fontSize: 12 }}>
							<Highlighted text={c.tunnel_ip ?? "—"} term={highlight} />
						</span>
						<span style={{ fontFamily: "monospace", fontSize: 12, ...muted }}>
							{isMobile && "de "}
							<Highlighted text={c.remote_ip ?? "—"} term={highlight} />
						</span>
						<span
							title={`↓ recebido ${formatBytes(c.rx_bytes)} · ↑ enviado ${formatBytes(c.tx_bytes)}`}
							style={{ fontVariantNumeric: "tabular-nums" }}
						>
							{formatBytes(traffic)}
						</span>
						<span title={stateTitle || undefined} style={{ color: c.connected ? "var(--foreground)" : "var(--muted-foreground)" }}>
							{state}
						</span>
					</div>
				);
			})}
		</>
	);
}
