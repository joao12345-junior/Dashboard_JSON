// src/features/network/components/NetworkClientDetailsModal.tsx
import React, { useMemo, useState } from "react";
import { Modal } from "../../../components/Modal";
import type { NetworkClient } from "../hooks/useNetworkState";
import { clientTitle } from "../sortClients";
import { formatBytes, isWeakSignal, signalQuality } from "../format";
import { formatEventTime } from "../formatEventTime";
import { useClientEvents, useClientSessions, type ClientSession } from "../hooks/useNetworkExtras";
import { buildTimeline, formatMinutes } from "../sessionTimeline";
import { SeverityBadge } from "./SeverityBadge";
import { buildClientLookup, findEventClient } from "../eventClient";


interface NetworkClientDetailsModalProps {
	/** Cliente clicado na lista. `null` = modal fechado (mesmo padrão que `Modal.isOpen`). */
	client: NetworkClient | null;
	onClose: () => void;
}

const fieldLabelStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
	marginBottom: 4,
};

const pillButtonStyle: React.CSSProperties = {
	padding: "2px 10px",
	borderRadius: 999,
	border: "1px solid var(--border)",
	backgroundColor: "transparent",
	color: "var(--foreground)",
	fontSize: 11,
	fontWeight: 600,
	cursor: "pointer",
	fontFamily: "inherit",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div style={{ minWidth: 0 }}>
			<div style={fieldLabelStyle}>{label}</div>
			<div style={{ fontSize: 14, color: "var(--foreground)", wordBreak: "break-word" }}>
				{children}
			</div>
		</div>
	);
}

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 13 };

/// <summary>
/// Modal com os dados completos de um cliente da rede: identificação (nome, nota,
/// MAC, IP, fabricante), como está ligado (Wi-Fi/cabo, AP, sinal), tráfego e datas.
/// Os contadores de tráfego são os acumulados do UniFi na sessão atual do cliente.
/// </summary>
export function NetworkClientDetailsModal({ client, onClose }: NetworkClientDetailsModalProps) {
	const [copied, setCopied] = useState(false);
	// Hooks antes do "return null": o React exige a mesma ordem em todo render.
	const sessions = useClientSessions(client?.mac ?? null);
	const events = useClientEvents(client?.mac ?? null, client?.ip_address ?? null);
	// Confere no navegador também: uma API antiga (sem o filtro client_mac) devolveria
	// todos os eventos, e a lista ficaria enganosa.
	const clientEvents = useMemo(() => {
		if (!client || !events.data) return [];
		const lookup = buildClientLookup([client]);
		return events.data.events.filter((ev) => findEventClient(ev, lookup) !== null);
	}, [client, events.data]);
	if (!client) return null;
	const c = client;

	const connection = c.is_wired ? "Cabo" : c.ssid ? `Wi-Fi · ${c.ssid}` : "Wi-Fi";
	const weak = isWeakSignal(c.signal_dbm);

	async function handleCopy() {
		const text = [
			clientTitle(c),
			c.note ? `Nota: ${c.note}` : "",
			`MAC: ${c.mac}`,
			`IP: ${c.ip_address ?? "—"}`,
			`Conexão: ${connection}${c.uplink_name ? ` (${c.uplink_name})` : ""}`,
		]
			.filter(Boolean)
			.join("\n");
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Sem permissão de área de transferência: sem feedback falso.
			setCopied(false);
		}
	}

	return (
		<Modal isOpen onClose={onClose} title="Detalhes do Cliente">
			<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
					<div style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", minWidth: 0, wordBreak: "break-word" }}>
						{clientTitle(c)}
						<span
							style={{
								marginLeft: 10,
								fontSize: 12,
								fontWeight: 600,
								color: c.connected ? "var(--foreground)" : "var(--muted-foreground)",
							}}
						>
							{c.connected ? "● Conectado" : "○ Desconectado"}
						</span>
					</div>
					<button type="button" onClick={() => void handleCopy()} style={pillButtonStyle}>
						{copied ? "✓ Copiado" : "Copiar"}
					</button>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
						gap: 16,
					}}
				>
					<Field label="Nota">{c.note ?? "—"}</Field>
					<Field label="MAC">
						<span style={mono}>{c.mac}</span>
					</Field>
					<Field label="IP">
						<span style={mono}>{c.ip_address ?? "—"}</span>
					</Field>
					<Field label="Hostname">{c.hostname ?? "—"}</Field>
					<Field label="Fabricante">{c.vendor ?? "—"}</Field>
					<Field label="Rede">
						{c.network_name ?? "—"}
						{c.is_guest ? " · Convidado" : ""}
					</Field>
					<Field label="Conexão">{connection}</Field>
					<Field label="Ligado em">{c.uplink_name ?? c.uplink_mac ?? "—"}</Field>
					{!c.is_wired && (
						<Field label="Sinal">
							{c.signal_dbm === null ? (
								"—"
							) : (
								<span style={{ color: weak ? "var(--warning-text)" : undefined, fontWeight: weak ? 700 : undefined }}>
									{c.signal_dbm} dBm · {signalQuality(c.signal_dbm)}
								</span>
							)}
						</Field>
					)}
					<Field label="Enviado (↑)">{formatBytes(c.tx_bytes)}</Field>
					<Field label="Recebido (↓)">{formatBytes(c.rx_bytes)}</Field>
					<Field label="Conectou em">{c.connected_since ? formatEventTime(c.connected_since) : "—"}</Field>
					{!c.connected && (
						<Field label="Desconectou em">
							{c.disconnected_at ? formatEventTime(c.disconnected_at) : "—"}
						</Field>
					)}
					<Field label="Visto por último">{formatEventTime(c.last_seen_at)}</Field>
				</div>

				<Section title="Conexões nos últimos 7 dias">
					{sessions.loading ? (
						<Muted>Carregando…</Muted>
					) : sessions.error ? (
						<Muted>Histórico indisponível ({sessions.error}).</Muted>
					) : (
						<SessionTimeline sessions={sessions.data?.sessions ?? []} />
					)}
				</Section>

				<Section title="Eventos de rede deste cliente">
					{events.loading ? (
						<Muted>Carregando…</Muted>
					) : events.error ? (
						<Muted>Eventos indisponíveis ({events.error}).</Muted>
					) : clientEvents.length === 0 ? (
						<Muted>Nenhum evento do UniFi cita este cliente.</Muted>
					) : (
						<ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
							{clientEvents.map((ev) => {
								const when = ev.event_time ?? ev.created_at;
								return (
									<li key={ev.id} style={{ display: "grid", gridTemplateColumns: "150px auto 1fr", gap: 8, alignItems: "center", fontSize: 12 }}>
										<span style={{ fontFamily: "monospace", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{formatEventTime(when)}</span>
										<SeverityBadge severity={ev.severity} />
										<span style={{ color: "var(--foreground)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ev.extension.msg ?? ev.name ?? ""}>
											{ev.name ?? "Sem nome"}
											{ev.extension.msg ? <span style={{ color: "var(--muted-foreground)" }}> · {ev.extension.msg}</span> : null}
										</span>
									</li>
								);
							})}
						</ul>
					)}
				</Section>
			</div>
		</Modal>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
			<h3 style={{ ...fieldLabelStyle, margin: 0, borderTop: "1px solid var(--border)", paddingTop: 14 }}>{title}</h3>
			{children}
		</section>
	);
}

function Muted({ children }: { children: React.ReactNode }) {
	return <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{children}</span>;
}

/** "Hoje", "Ontem" ou "seg 17/11". */
function shortDay(day: Date, today: Date): string {
	const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
	if (diff === 0) return "Hoje";
	if (diff === 1) return "Ontem";
	const weekday = day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
	return `${weekday} ${day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

const HOUR_TICKS = [0, 6, 12, 18, 24];

/// <summary>
/// Uma faixa de 24 h por dia: trecho preenchido = conectado. Passe o mouse no
/// trecho para ver os horários. O histórico só existe desde a migração 015.
/// </summary>
function SessionTimeline({ sessions }: { sessions: ClientSession[] }) {
	const days = useMemo(() => buildTimeline(sessions, new Date(), 7), [sessions]);
	if (sessions.length === 0) {
		return <Muted>Sem histórico ainda. O LogDash começou a registrar conexões com a migração 015.</Muted>;
	}
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			{days.map((d) => {
				const iso = d.dayStart.toISOString();
				const label = shortDay(d.dayStart, days[0].dayStart);
				return (
					<div key={iso} style={{ display: "grid", gridTemplateColumns: "64px 1fr 84px", gap: 8, alignItems: "center", fontSize: 11 }}>
						<span style={{ color: "var(--muted-foreground)" }}>{label}</span>
						<div
							role="img"
							aria-label={`${label}: conectado ${formatMinutes(d.connectedMinutes)}`}
							style={{ position: "relative", height: 12, borderRadius: 3, backgroundColor: "var(--muted)", overflow: "hidden" }}
						>
							{d.segments.map((seg, i) => (
								<span
									key={i}
									style={{
										position: "absolute",
										top: 0,
										bottom: 0,
										left: `${seg.startPct}%`,
										width: `${Math.max(seg.endPct - seg.startPct, 0.4)}%`,
										backgroundColor: "var(--primary)",
									}}
								/>
							))}
						</div>
						<span style={{ color: "var(--foreground)", textAlign: "right" }}>{formatMinutes(d.connectedMinutes)}</span>
					</div>
				);
			})}
			<div style={{ display: "grid", gridTemplateColumns: "64px 1fr 84px", gap: 8, fontSize: 10, color: "var(--muted-foreground)" }}>
				<span />
				<div style={{ display: "flex", justifyContent: "space-between" }}>
					{HOUR_TICKS.map((h) => (
						<span key={h}>{String(h).padStart(2, "0")}h</span>
					))}
				</div>
				<span />
			</div>
		</div>
	);
}
