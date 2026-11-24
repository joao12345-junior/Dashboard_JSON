// src/features/network/components/InfrastructureView.tsx
import React from "react";
import { Globe, Router, Wifi } from "lucide-react";
import type { NetworkDevice } from "../hooks/useNetworkState";
import type { WanLink } from "../hooks/useNetworkExtras";
import { isGateway } from "../topologyLayout";
import { formatBitrate, formatUptime } from "../format";
import { plural } from "../../../lib/plural";
import { WanHistoryPanel } from "./WanHistoryPanel";

const CARD_W = 300;
const CARD_H = 76;
const COL_GAP = 40;
const ROW_GAP = 96;
const PAD = 24;

interface InfrastructureViewProps {
	wans: WanLink[];
	/** Erro ao buscar a WAN (ex.: migração 015 não aplicada). */
	wanError: string | null;
	devices: NetworkDevice[];
	/** Clientes conectados por MAC do dispositivo. */
	clientsByDevice: ReadonlyMap<string, number>;
}

/** Centro X do item `i` de uma linha com `n` itens, numa largura `width`. */
const columnX = (i: number, n: number, width: number) =>
	width / 2 + (i - (n - 1) / 2) * (CARD_W + COL_GAP);

/// <summary>
/// Visão "Infraestrutura" (como no UniFi): links de internet no topo, curvas até o
/// gateway, e abaixo os APs/switches. Só infraestrutura, sem clientes. Embaixo, o
/// gráfico "Internet" (histórico de tráfego e latência de cada link).
/// </summary>
export function InfrastructureView({ wans, wanError, devices, clientsByDevice }: InfrastructureViewProps) {
	const gateway = devices.find(isGateway) ?? null;
	const others = devices.filter((d) => d !== gateway);
	const columns = Math.max(wans.length, others.length, 1);
	const width = columns * CARD_W + (columns - 1) * COL_GAP + PAD * 2;
	const wanY = PAD;
	const gatewayY = wans.length > 0 ? wanY + CARD_H + ROW_GAP : PAD;
	const devicesY = gatewayY + CARD_H + ROW_GAP;
	const height = (others.length > 0 ? devicesY + CARD_H : gatewayY + CARD_H) + PAD;
	const gx = width / 2;

	return (
		<div
			style={{
				flex: 1,
				minHeight: 420,
				overflow: "auto",
				borderRadius: 8,
				border: "1px solid var(--border)",
				backgroundColor: "var(--card)",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{(wanError || wans.length === 0) && (
				<div role="status" style={{ padding: "10px 16px", fontSize: 12, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
					Sem dados dos links de internet ainda. No servidor: aplicar a migração 015 e reiniciar o serviço{" "}
					<code>LogDashUnifiPoller</code>.
				</div>
			)}
			<div style={{ position: "relative", width, height, margin: "24px auto", flexShrink: 0 }}>
				<svg width={width} height={height} style={{ position: "absolute", inset: 0 }} aria-hidden>
					{gateway &&
						wans.map((w, i) => {
							const x = columnX(i, wans.length, width);
							// Cada WAN chega num ponto diferente do topo do gateway, como no UniFi.
							const tx = gx + (i - (wans.length - 1) / 2) * 60;
							const y1 = wanY + CARD_H;
							const y2 = gatewayY;
							const mid = (y1 + y2) / 2;
							return (
								<path
									key={w.wan_group}
									d={`M ${x} ${y1} C ${x} ${mid}, ${tx} ${mid}, ${tx} ${y2}`}
									fill="none"
									stroke={w.is_up === false ? "var(--destructive)" : "var(--primary)"}
									strokeWidth={1.5}
									strokeDasharray={w.is_up === false ? "5 4" : undefined}
								/>
							);
						})}
					{gateway &&
						others.map((d, i) => {
							const x = columnX(i, others.length, width);
							const y1 = gatewayY + CARD_H;
							const mid = (y1 + devicesY) / 2;
							return (
								<path
									key={d.mac}
									d={`M ${gx} ${y1} C ${gx} ${mid}, ${x} ${mid}, ${x} ${devicesY}`}
									fill="none"
									stroke={d.state === "ONLINE" ? "var(--primary)" : "var(--destructive)"}
									strokeWidth={1.5}
								/>
							);
						})}
				</svg>

				{wans.map((w, i) => (
					<Positioned key={w.wan_group} x={columnX(i, wans.length, width)} y={wanY}>
						<WanCard wan={w} />
					</Positioned>
				))}
				{gateway && (
					<Positioned x={gx} y={gatewayY}>
						<GatewayCard device={gateway} />
					</Positioned>
				)}
				{others.map((d, i) => (
					<Positioned key={d.mac} x={columnX(i, others.length, width)} y={devicesY}>
						<DeviceCard device={d} clients={clientsByDevice.get(d.mac) ?? 0} />
					</Positioned>
				))}
			</div>
			<WanHistoryPanel wans={wans} />
		</div>
	);
}

function Positioned({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
	return <div style={{ position: "absolute", left: x - CARD_W / 2, top: y, width: CARD_W, height: CARD_H }}>{children}</div>;
}

const cardStyle = (borderColor: string): React.CSSProperties => ({
	boxSizing: "border-box",
	height: "100%",
	padding: "10px 14px",
	borderRadius: 8,
	border: `1px solid ${borderColor}`,
	backgroundColor: "var(--background)",
	display: "flex",
	alignItems: "center",
	gap: 12,
});

const titleStyle: React.CSSProperties = {
	fontSize: 15,
	fontWeight: 700,
	color: "var(--foreground)",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const subStyle: React.CSSProperties = {
	fontSize: 12,
	color: "var(--muted-foreground)",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

function WanCard({ wan: w }: { wan: WanLink }) {
	const down = w.is_up === false;
	const disabled = w.is_enabled === false;
	const title = w.name ?? w.isp_name ?? w.wan_group;
	const role = [w.wan_group, w.failover_only ? "Somente failover" : null].filter(Boolean).join(" · ");
	const statusText = disabled ? "Desativada" : down ? "Offline" : w.availability_pct !== null ? `${round(w.availability_pct)}%` : "Online";
	const statusColor = disabled ? "var(--muted-foreground)" : down ? "var(--destructive-text)" : "var(--foreground)";
	const tooltip = [
		w.isp_name && w.isp_name !== title ? `Provedor: ${w.isp_name}` : null,
		w.availability_pct !== null ? `Disponibilidade (24 h): ${round(w.availability_pct)}%` : null,
		w.latency_ms !== null ? `Latência média: ${Math.round(w.latency_ms)} ms` : null,
		w.rx_bps !== null || w.tx_bps !== null ? `Agora: ↓ ${formatBitrate(w.rx_bps)} · ↑ ${formatBitrate(w.tx_bps)}` : null,
	]
		.filter(Boolean)
		.join("\n");
	return (
		<div style={{ ...cardStyle(down ? "var(--destructive)" : "var(--border)"), opacity: disabled ? 0.6 : 1 }} title={tooltip || undefined}>
			<Globe size={20} style={{ flexShrink: 0, color: down ? "var(--destructive-text)" : "var(--foreground)" }} />
			<div style={{ minWidth: 0, flex: 1 }}>
				<div style={titleStyle}>{title}</div>
				<div style={subStyle}>{role}</div>
			</div>
			<div style={{ textAlign: "right", flexShrink: 0 }}>
				<div style={{ fontSize: 14, fontWeight: 700, color: statusColor }}>{statusText}</div>
				<div style={{ ...subStyle, fontFamily: "monospace" }}>
					{w.ip_address ?? "—"}
					{w.latency_ms !== null && !down ? ` · ${Math.round(w.latency_ms)} ms` : ""}
				</div>
			</div>
		</div>
	);
}

function GatewayCard({ device: d }: { device: NetworkDevice }) {
	const online = d.state === "ONLINE";
	return (
		<div style={cardStyle(online ? "var(--primary)" : "var(--destructive)")} title={[d.model, d.ip_address, d.firmware_version].filter(Boolean).join(" · ")}>
			<Router size={22} style={{ flexShrink: 0, color: "var(--foreground)" }} />
			<div style={{ minWidth: 0, flex: 1 }}>
				<div style={titleStyle}>{d.name ?? d.mac}</div>
				<div style={subStyle}>{[d.model, d.firmware_version].filter(Boolean).join(" · ")}</div>
			</div>
			<div style={{ textAlign: "right", fontSize: 12, color: "var(--foreground)", lineHeight: 1.6, flexShrink: 0 }}>
				<div>CPU {d.cpu_pct === null ? "—" : `${Math.round(d.cpu_pct)}%`}</div>
				<div>Mem {d.memory_pct === null ? "—" : `${Math.round(d.memory_pct)}%`}</div>
			</div>
		</div>
	);
}

function DeviceCard({ device: d, clients }: { device: NetworkDevice; clients: number }) {
	const online = d.state === "ONLINE";
	const ap = d.features.includes("accessPoint");
	return (
		<div style={cardStyle(online ? "var(--border)" : "var(--destructive)")} title={[d.model, d.firmware_version].filter(Boolean).join(" · ")}>
			{ap ? <Wifi size={20} style={{ flexShrink: 0 }} /> : <Router size={20} style={{ flexShrink: 0 }} />}
			<div style={{ minWidth: 0, flex: 1 }}>
				<div style={titleStyle}>{d.name ?? d.mac}</div>
				<div style={subStyle}>{online ? plural(clients, "cliente", "clientes") : "Offline"}</div>
			</div>
			<div style={{ textAlign: "right", fontSize: 12, color: "var(--foreground)", flexShrink: 0 }}>
				<div>Ativo há {formatUptime(d.uptime_sec)}</div>
				<div style={{ ...subStyle, fontFamily: "monospace" }}>{d.ip_address ?? "—"}</div>
			</div>
		</div>
	);
}

function round(n: number): string {
	return n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 99.95 ? 0 : 1 });
}
