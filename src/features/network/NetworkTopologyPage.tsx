// src/features/network/NetworkTopologyPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/Error";
import type { SharedPageProps } from "../../App";
import { btnSecondary } from "../../lib/styles/buttonStyles";
import { plural } from "../../lib/plural";
import { useNetworkClients, useNetworkDevices, type NetworkClient } from "./hooks/useNetworkState";
import { StaleDataBanner } from "./components/StaleDataBanner";
import { NetworkClientDetailsModal } from "./components/NetworkClientDetailsModal";
import { TopologyCanvas } from "./components/TopologyCanvas";
import { InfrastructureView } from "./components/InfrastructureView";
import { useNetworkWan } from "./hooks/useNetworkExtras";
import { buildTopologyLayout } from "./topologyLayout";
import { clientTitle } from "./sortClients";

type ConnectionFilter = "all" | "wired" | "wifi";
type View = "topology" | "infrastructure";

const SEARCH_DEBOUNCE_MS = 200;

function chipStyle(active: boolean): React.CSSProperties {
	return {
		padding: "5px 12px",
		borderRadius: 999,
		border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
		backgroundColor: active ? "color-mix(in oklch, var(--primary) 18%, transparent)" : "transparent",
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

function LegendLine({ dash, color, label }: { dash?: string; color: string; label: string }) {
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
			<svg width={26} height={6} aria-hidden>
				<line x1={0} y1={3} x2={26} y2={3} stroke={color} strokeWidth={2} strokeDasharray={dash} />
			</svg>
			{label}
		</span>
	);
}

/** O cliente casa com a busca (nome, nota, IP, MAC ou fabricante)? */
function matchesSearch(c: NetworkClient, term: string): boolean {
	const t = term.toLocaleLowerCase("pt-BR");
	return [clientTitle(c), c.note, c.ip_address, c.mac, c.vendor, c.hostname]
		.filter(Boolean)
		.some((v) => v!.toLocaleLowerCase("pt-BR").includes(t));
}

/// <summary>
/// Página "Rede — Topologia", no estilo do mapa do UniFi: Internet → gateway →
/// barramento com AP/switches e clientes de cabo → clientes Wi-Fi de cada AP
/// (linha tracejada). Arrastar move, roda/botões dão zoom; filtros e busca
/// apagam o que não casa em vez de esconder, para o desenho não "pular".
/// </summary>
export function NetworkTopologyPage({ isMobile }: SharedPageProps) {
	const devicesState = useNetworkDevices();
	const clientsState = useNetworkClients("connected", "");
	const wanState = useNetworkWan();
	const [view, setView] = useState<View>("topology");
	const [selected, setSelected] = useState<NetworkClient | null>(null);
	const [connection, setConnection] = useState<ConnectionFilter>("all");
	const [search, setSearch] = useState("");
	const [term, setTerm] = useState("");

	useEffect(() => {
		const timer = setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [search]);

	const devices = useMemo(() => devicesState.data?.devices ?? [], [devicesState.data]);
	const clients = useMemo(() => clientsState.data?.clients ?? [], [clientsState.data]);
	const layout = useMemo(() => buildTopologyLayout(devices, clients), [devices, clients]);

	const counts = useMemo(() => {
		const wired = clients.filter((c) => c.is_wired).length;
		return { all: clients.length, wired, wifi: clients.length - wired };
	}, [clients]);

	// null = nada filtrado. Com filtro, só os clientes que casam (e a infraestrutura) ficam acesos.
	const matches = useMemo(() => {
		if (connection === "all" && term === "") return null;
		const set = new Set<string>();
		for (const n of layout.nodes) {
			if (!n.client) {
				set.add(n.id);
				continue;
			}
			const c = n.client;
			const okConn = connection === "all" || (connection === "wired" ? c.is_wired : !c.is_wired);
			if (okConn && (term === "" || matchesSearch(c, term))) set.add(n.id);
		}
		return set;
	}, [layout, connection, term]);

	const clientsByDevice = useMemo(() => {
		const map = new Map<string, number>();
		for (const c of clients) if (c.uplink_mac) map.set(c.uplink_mac, (map.get(c.uplink_mac) ?? 0) + 1);
		return map;
	}, [clients]);

	const { data, error, loading, lastRefresh } = devicesState;
	const reload = () => {
		devicesState.reload();
		clientsState.reload();
		wanState.reload();
	};
	const unlinked = layout.nodes.filter((n) => n.client && n.inferred).length;

	return (
		<div style={{ display: "flex", flex: 1, minWidth: 0, height: "100vh", overflow: "hidden", backgroundColor: "var(--background)" }}>
			<main
				style={{
					flex: 1,
					padding: isMobile ? "64px 16px 16px" : "32px",
					display: "flex",
					flexDirection: "column",
					gap: 12,
					minHeight: 0,
					minWidth: 0,
					overflow: "hidden",
				}}
			>
				<PageHeader
					title="Rede — Topologia"
					subtitle={
						loading && !data
							? "Carregando…"
							: `UniFi · ${plural(devices.length, "dispositivo", "dispositivos")} · ${plural(clients.length, "cliente", "clientes")}${
									lastRefresh ? ` · atualizado às ${lastRefresh.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""
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

				<div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
					<div role="tablist" aria-label="Visão" style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
						{(
							[
								["topology", "Topologia"],
								["infrastructure", "Infraestrutura"],
							] as const
						).map(([value, label]) => (
							<button
								key={value}
								type="button"
								role="tab"
								aria-selected={view === value}
								onClick={() => setView(value)}
								style={{
									padding: "6px 14px",
									border: "none",
									backgroundColor: view === value ? "color-mix(in oklch, var(--primary) 22%, transparent)" : "transparent",
									color: "var(--foreground)",
									fontSize: 12,
									fontWeight: view === value ? 700 : 500,
									cursor: "pointer",
									fontFamily: "inherit",
								}}
							>
								{label}
							</button>
						))}
					</div>
					{view === "topology" && (<>
					{(
						[
							["all", "Todos"],
							["wired", "Com fio"],
							["wifi", "Wi-Fi"],
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type="button"
							className="ld-chip"
							aria-pressed={connection === value}
							onClick={() => setConnection(value)}
							style={chipStyle(connection === value)}
						>
							{label} ({counts[value].toLocaleString("pt-BR")})
						</button>
					))}
					<input
						type="search"
						className="ld-control"
						aria-label="Destacar clientes"
						placeholder="Destacar: nome, IP, MAC…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						style={{
							flex: "1 1 200px",
							maxWidth: 320,
							padding: "6px 10px",
							borderRadius: 6,
							border: "1px solid var(--border)",
							backgroundColor: "var(--card)",
							color: "var(--foreground)",
							fontSize: 13,
							fontFamily: "inherit",
						}}
					/>
					</>)}
					<span style={{ flex: 1 }} />
					{!isMobile && view === "topology" && (
						<span style={{ display: "inline-flex", gap: 14, fontSize: 11, color: "var(--muted-foreground)" }}>
							<LegendLine color="color-mix(in oklch, var(--primary) 75%, transparent)" label="Cabo" />
							<LegendLine color="var(--chart-4)" dash="5 4" label="Wi-Fi" />
							{unlinked > 0 && (
								<LegendLine color="color-mix(in oklch, var(--primary) 75%, transparent)" dash="1 4" label="Ligação não identificada" />
							)}
						</span>
					)}
				</div>

				{error && !data ? (
					<ErrorState title="Erro ao carregar a topologia" message={error} onRetry={reload} />
				) : !data ? (
					<div role="status" style={emptyBoxStyle}>
						Carregando topologia…
					</div>
				) : devices.length === 0 ? (
					<div role="status" style={emptyBoxStyle}>
						<strong style={{ color: "var(--foreground)", fontSize: 14 }}>Nenhum dispositivo ainda</strong>
						<span>
							Confira se o serviço <code>LogDashUnifiPoller</code> está rodando no servidor.
						</span>
					</div>
				) : view === "infrastructure" ? (
					<InfrastructureView
						wans={wanState.data?.wans ?? []}
						wanError={wanState.error}
						devices={devices}
						clientsByDevice={clientsByDevice}
					/>
				) : (
					<TopologyCanvas layout={layout} matches={matches} onOpenClient={setSelected} />
				)}

				{view === "topology" && <p style={{ margin: 0, fontSize: 11, color: "var(--muted-foreground)", flexShrink: 0 }}>
					Arraste para mover · roda do mouse para zoom · passe o mouse num item para ver o caminho até a Internet · clique num cliente para detalhes.
				</p>}
			</main>
			<NetworkClientDetailsModal client={selected} onClose={() => setSelected(null)} />
		</div>
	);
}
