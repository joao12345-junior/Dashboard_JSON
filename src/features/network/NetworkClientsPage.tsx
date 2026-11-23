// src/features/network/NetworkClientsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/Error";
import type { SharedPageProps } from "../../App";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import { plural } from "../../lib/plural";
import { downloadCsv, toCsv } from "../../lib/exportCsv";
import { Highlighted } from "../app-logs/components/AppLogFeed";
import { useNetworkClients, type ClientStatus, type NetworkClient } from "./hooks/useNetworkState";
import { StaleDataBanner } from "./components/StaleDataBanner";
import { formatBytes, formatSince } from "./format";
import { eventDayKey, formatEventTime } from "./formatEventTime";

/** Espera o usuário parar de digitar antes de buscar na API. */
const SEARCH_DEBOUNCE_MS = 350;

type ConnectionFilter = "all" | "wifi" | "wired";

const STATUS_OPTIONS: Array<{ value: ClientStatus; label: string }> = [
	{ value: "connected", label: "Conectados" },
	{ value: "disconnected", label: "Desconectados" },
	{ value: "all", label: "Todos" },
];

const CONNECTION_OPTIONS: Array<{ value: ConnectionFilter; label: string }> = [
	{ value: "all", label: "Wi-Fi e cabo" },
	{ value: "wifi", label: "Wi-Fi" },
	{ value: "wired", label: "Cabo" },
];

/** Colunas no desktop; o cabeçalho usa a mesma grade. */
const DESKTOP_COLUMNS = "minmax(200px, 1.4fr) 130px minmax(170px, 1.2fr) 110px 150px";

const columnHeaderStyle: React.CSSProperties = {
	position: "sticky",
	top: 0,
	zIndex: 2,
	display: "grid",
	gridTemplateColumns: DESKTOP_COLUMNS,
	columnGap: 12,
	alignItems: "center",
	height: 32,
	boxSizing: "border-box",
	padding: "0 16px",
	backgroundColor: "var(--muted)",
	borderBottom: "1px solid var(--border)",
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
};

const subLineStyle: React.CSSProperties = {
	fontSize: 11,
	color: "var(--muted-foreground)",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

function chipStyle(active: boolean): React.CSSProperties {
	return {
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
		padding: "5px 12px",
		borderRadius: 999,
		border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
		backgroundColor: active
			? "color-mix(in oklch, var(--primary) 18%, transparent)"
			: "transparent",
		color: "var(--foreground)",
		fontSize: 12,
		fontWeight: 600,
		cursor: "pointer",
		fontFamily: "inherit",
	};
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

/** Nome principal do cliente: o que o UniFi chama, senão hostname, senão MAC. */
function clientTitle(c: NetworkClient): string {
	return c.name ?? c.hostname ?? c.mac;
}

/** "Wi-Fi · optare" ou "Cabo". */
function connectionLabel(c: NetworkClient): string {
	if (c.is_wired) return "Cabo";
	return c.ssid ? `Wi-Fi · ${c.ssid}` : "Wi-Fi";
}

/** "Ap 409 · -61 dBm" (Wi-Fi) ou "Switch X" (cabo); vazio se não souber. */
function connectionDetail(c: NetworkClient): string {
	const parts: string[] = [];
	if (c.uplink_name) parts.push(c.uplink_name);
	if (!c.is_wired && c.signal_dbm !== null) parts.push(`${c.signal_dbm} dBm`);
	return parts.join(" · ");
}

/// <summary>
/// Página "Rede — Clientes": quem está (ou esteve) conectado ao UniFi, no mesmo
/// padrão visual de Logs Gerais. Estado e busca são filtros no servidor; o tipo
/// de conexão (Wi-Fi/cabo) filtra a lista já carregada. Atualiza sozinha a cada
/// 30 s (o coletor grava a cada 60 s).
/// </summary>
export function NetworkClientsPage({ isMobile }: SharedPageProps) {
	const [status, setStatus] = useState<ClientStatus>("connected");
	const [connection, setConnection] = useState<ConnectionFilter>("all");
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");

	useEffect(() => {
		const timer = setTimeout(
			() => setDebouncedSearch(search.trim()),
			SEARCH_DEBOUNCE_MS,
		);
		return () => clearTimeout(timer);
	}, [search]);

	const { data, loading, error, lastRefresh, reload } = useNetworkClients(
		status,
		debouncedSearch,
	);

	const clients = useMemo(() => {
		const all = data?.clients ?? [];
		if (connection === "all") return all;
		return all.filter((c) => (connection === "wired" ? c.is_wired : !c.is_wired));
	}, [data, connection]);

	const filtered = status !== "connected" || connection !== "all" || debouncedSearch !== "";
	const now = new Date();

	function clearFilters() {
		setStatus("connected");
		setConnection("all");
		setSearch("");
		setDebouncedSearch("");
	}

	function handleExportCsv() {
		const rows = clients.map((c) => [
			clientTitle(c),
			c.note ?? "",
			c.mac,
			c.ip_address ?? "",
			connectionLabel(c),
			c.uplink_name ?? "",
			c.network_name ?? "",
			c.connected ? "conectado" : "desconectado",
			c.connected_since ?? "",
			c.disconnected_at ?? "",
		]);
		const csv = toCsv(
			["cliente", "nota", "mac", "ip", "conexao", "ligado_em", "rede", "estado", "conectado_desde", "desconectado_em"],
			rows,
		);
		downloadCsv(`clientes-rede-${eventDayKey(new Date().toISOString())}.csv`, csv);
	}

	const subtitle =
		loading && !data
			? "Carregando…"
			: `UniFi · ${plural(data?.connected_count ?? 0, "conectado", "conectados")}${
					lastRefresh
						? ` · atualizado às ${lastRefresh.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
						: ""
				}`;

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
					overflowY: isMobile ? "auto" : "hidden",
					overflowX: "hidden",
				}}
			>
				<PageHeader title="Rede — Clientes" subtitle={subtitle} spacing="compact" wrap>
					<button onClick={reload} style={btnSecondary}>
						↺ Recarregar
					</button>
				</PageHeader>

				<StaleDataBanner polledAt={data?.polled_at ?? null} />

				<div
					style={{
						display: "flex",
						gap: 8,
						flexWrap: "wrap",
						alignItems: "center",
						flexShrink: 0,
					}}
				>
					{STATUS_OPTIONS.map((opt) => {
						const active = status === opt.value;
						return (
							<button
								key={opt.value}
								type="button"
								className="ld-chip"
								aria-pressed={active}
								onClick={() => setStatus(opt.value)}
								style={active ? btnPrimary : btnSecondary}
							>
								{opt.label}
								{opt.value === "connected" && data
									? ` (${data.connected_count.toLocaleString("pt-BR")})`
									: ""}
							</button>
						);
					})}
					<span
						aria-hidden
						style={{ width: 1, height: 20, backgroundColor: "var(--border)" }}
					/>
					{CONNECTION_OPTIONS.map((opt) => (
						<button
							key={opt.value}
							type="button"
							className="ld-chip"
							aria-pressed={connection === opt.value}
							onClick={() => setConnection(opt.value)}
							style={chipStyle(connection === opt.value)}
						>
							{opt.label}
						</button>
					))}
					<span style={{ flex: 1 }} />
					<button
						type="button"
						className="ld-chip"
						title="Baixa a lista que está na tela (CSV)"
						onClick={handleExportCsv}
						disabled={clients.length === 0}
						style={{ ...chipStyle(false), opacity: clients.length === 0 ? 0.5 : 1 }}
					>
						Exportar CSV
					</button>
				</div>

				<div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexShrink: 0 }}>
					<label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 520 }}>
						<span
							style={{
								fontSize: 10,
								fontWeight: 700,
								color: "var(--muted-foreground)",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
							}}
						>
							Buscar
						</span>
						<input
							type="search"
							className="ld-control"
							placeholder="Nome, nota, IP, MAC ou fabricante"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							style={{
								padding: "7px 10px",
								borderRadius: 6,
								border: "1px solid var(--border)",
								backgroundColor: "var(--card)",
								color: "var(--foreground)",
								fontSize: 13,
								fontFamily: "inherit",
							}}
						/>
					</label>
					{filtered && (
						<button type="button" className="ld-chip" onClick={clearFilters} style={btnSecondary}>
							Limpar filtros
						</button>
					)}
				</div>

				{error && !data ? (
					<ErrorState title="Erro ao carregar clientes de rede" message={error} onRetry={reload} />
				) : !data ? (
					<div role="status" style={emptyBoxStyle}>
						Carregando clientes de rede…
					</div>
				) : clients.length === 0 ? (
					<div role="status" style={emptyBoxStyle}>
						<strong style={{ color: "var(--foreground)", fontSize: 14 }}>
							{filtered ? "Nenhum cliente com esses filtros" : "Nenhum cliente conectado agora"}
						</strong>
						{filtered && (
							<button
								type="button"
								className="ld-chip"
								onClick={clearFilters}
								style={{ ...btnSecondary, marginTop: 10 }}
							>
								Limpar filtros
							</button>
						)}
					</div>
				) : (
					<div
						aria-busy={loading}
						style={{
							backgroundColor: "var(--card)",
							border: "1px solid var(--border)",
							borderRadius: 8,
							overflow: "hidden",
							flex: 1,
							minHeight: isMobile ? 360 : 0,
							display: "flex",
							flexDirection: "column",
						}}
					>
						<div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
							{!isMobile && (
								<div style={columnHeaderStyle}>
									<span>Cliente</span>
									<span>IP</span>
									<span>Conexão</span>
									<span>Rede</span>
									<span>Estado</span>
								</div>
							)}
							{clients.map((c) => (
								<ClientRow key={c.mac} client={c} isMobile={isMobile} highlight={debouncedSearch} now={now} />
							))}
						</div>
						{error && (
							<div
								role="alert"
								style={{
									padding: "6px 16px",
									borderTop: "1px solid var(--border)",
									fontSize: 12,
									color: "var(--destructive-text)",
								}}
							>
								Não foi possível atualizar agora ({error}). Mostrando os últimos dados.
							</div>
						)}
					</div>
				)}
			</main>
		</div>
	);
}

interface ClientRowProps {
	client: NetworkClient;
	isMobile: boolean;
	highlight: string;
	now: Date;
}

function ClientRow({ client: c, isMobile, highlight, now }: ClientRowProps) {
	const title = clientTitle(c);
	const detail = connectionDetail(c);
	const stateText = c.connected ? "Conectado" : "Desconectado";
	const sinceIso = c.connected ? c.connected_since : (c.disconnected_at ?? c.last_seen_at);
	const sinceText = c.connected
		? c.connected_since
			? `conectou ${formatSince(c.connected_since, now)}`
			: ""
		: `saiu ${formatSince(sinceIso, now)}`;
	const traffic =
		c.tx_bytes !== null || c.rx_bytes !== null
			? `↑ ${formatBytes(c.tx_bytes)} · ↓ ${formatBytes(c.rx_bytes)}`
			: undefined;

	const identity = (
		<span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
			<span
				title={title}
				style={{
					fontSize: 13,
					fontWeight: 600,
					color: "var(--foreground)",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				<Highlighted text={title} term={highlight} />
			</span>
			<span style={subLineStyle} title={c.mac}>
				{c.note ? <Highlighted text={`${c.note} · `} term={highlight} /> : null}
				<span style={{ fontFamily: "monospace" }}>{c.mac}</span>
			</span>
		</span>
	);

	const state = (
		<span style={{ display: "flex", flexDirection: "column", minWidth: 0 }} title={sinceIso ? formatEventTime(sinceIso) : undefined}>
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					fontSize: 12,
					fontWeight: 600,
					color: c.connected ? "var(--foreground)" : "var(--muted-foreground)",
				}}
			>
				<span
					aria-hidden
					style={{
						width: 8,
						height: 8,
						borderRadius: "50%",
						backgroundColor: c.connected ? "var(--primary)" : "var(--muted-foreground)",
					}}
				/>
				{stateText}
			</span>
			{sinceText && <span style={subLineStyle}>{sinceText}</span>}
		</span>
	);

	if (isMobile) {
		return (
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr auto",
					columnGap: 12,
					rowGap: 4,
					padding: "10px 16px",
					borderBottom: "1px solid var(--border)",
				}}
			>
				{identity}
				{state}
				<span style={{ ...subLineStyle, gridColumn: "1 / -1", whiteSpace: "normal" }}>
					<span style={{ fontFamily: "monospace" }}>{c.ip_address ?? "sem IP"}</span>
					{" · "}
					{connectionLabel(c)}
					{detail ? ` (${detail})` : ""}
					{c.network_name ? ` · ${c.network_name}` : ""}
					{c.is_guest ? " · Convidado" : ""}
				</span>
			</div>
		);
	}

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: DESKTOP_COLUMNS,
				columnGap: 12,
				alignItems: "center",
				padding: "8px 16px",
				borderBottom: "1px solid var(--border)",
			}}
		>
			{identity}
			<span
				style={{ fontFamily: "monospace", fontSize: 12, color: "var(--foreground)" }}
				title={c.vendor ?? undefined}
			>
				<Highlighted text={c.ip_address ?? "—"} term={highlight} />
			</span>
			<span style={{ display: "flex", flexDirection: "column", minWidth: 0 }} title={traffic}>
				<span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
					{connectionLabel(c)}
					{c.is_guest ? " · Convidado" : ""}
				</span>
				{detail && <span style={subLineStyle}>{detail}</span>}
			</span>
			<span style={{ fontSize: 12, color: "var(--foreground)" }}>{c.network_name ?? "—"}</span>
			{state}
		</div>
	);
}
