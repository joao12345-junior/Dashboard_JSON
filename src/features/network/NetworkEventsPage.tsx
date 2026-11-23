// src/features/network/NetworkEventsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/Error";
import type { SharedPageProps } from "../../App";
import { useNetworkEvents, type NetworkEvent } from "./hooks/useNetworkEvents";
import { NetworkEventDetailsModal } from "./components/NetworkEventDetailsModal";
import { NetworkEventFeed } from "./components/NetworkEventFeed";
import { NetworkClientDetailsModal } from "./components/NetworkClientDetailsModal";
import { useNetworkClients, type NetworkClient } from "./hooks/useNetworkState";
import { buildClientLookup, findEventClient } from "./eventClient";
import { eventClock, eventDayKey } from "./formatEventTime";
import { SEVERITY_FILTER_OPTIONS, severityLabel } from "./severity";
import { formatDayLabel } from "../../lib/dayLabel";
import { downloadCsv, toCsv } from "../../lib/exportCsv";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";

/** Espera o usuário parar de digitar antes de buscar na API. */
const SEARCH_DEBOUNCE_MS = 350;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Pílula pequena usada nos filtros rápidos e nas opções de leitura. */
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

const searchLabelStyle: React.CSSProperties = {
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
};

/// <summary>
/// Página "Rede": eventos do UniFi recebidos por syslog (CEF), do mais novo para
/// o mais antigo, no mesmo padrão da lista de Logs Gerais (chips de período e
/// gravidade, busca, lista por dia). Dia, gravidade e busca são filtros no
/// servidor (a tabela pode ter muitos milhares de linhas); "Carregar mais" pagina
/// por cursor. Clique na linha (ou no horário, para teclado) abre os detalhes.
/// </summary>
export function NetworkEventsPage({ isMobile }: SharedPageProps) {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [minSeverity, setMinSeverity] = useState<number | null>(null);
	const [date, setDate] = useState("");
	const [wrapLines, setWrapLines] = useState(false);
	const [selected, setSelected] = useState<NetworkEvent | null>(null);
	const [selectedClient, setSelectedClient] = useState<NetworkClient | null>(null);
	// Todos os clientes (inclusive desconectados) para ligar evento → cliente.
	const { data: clientsData } = useNetworkClients("all", "");
	const clientLookup = useMemo(() => buildClientLookup(clientsData?.clients ?? []), [clientsData]);

	useEffect(() => {
		const timer = setTimeout(
			() => setDebouncedSearch(search.trim()),
			SEARCH_DEBOUNCE_MS,
		);
		return () => clearTimeout(timer);
	}, [search]);

	const { events, hasMore, loading, loadingMore, error, lastRefresh, reload, loadMore } =
		useNetworkEvents({ q: debouncedSearch, minSeverity, date });

	const filtered = debouncedSearch !== "" || minSeverity !== null || date !== "";
	const hasData = events.length > 0;

	// "Hoje"/"Ontem" no fuso de Brasília (o mesmo usado nas horas da lista).
	const now = new Date();
	const todayKey = eventDayKey(now.toISOString());
	const yesterdayKey = eventDayKey(new Date(now.getTime() - DAY_MS).toISOString());

	function clearFilters() {
		setSearch("");
		setDebouncedSearch("");
		setMinSeverity(null);
		setDate("");
	}

	/** Exporta o que está carregado na lista (já com os filtros do servidor). */
	function handleExportCsv() {
		const rows = events.map((ev) => {
			const when = ev.event_time ?? ev.created_at;
			return [
				eventDayKey(when),
				eventClock(when),
				ev.severity === null ? "" : `${severityLabel(ev.severity)} (${ev.severity})`,
				ev.name ?? "",
				ev.extension.UNIFIdeviceName ?? ev.source_ip ?? "",
				ev.extension.msg ?? "",
			];
		});
		const csv = toCsv(
			["data", "hora", "gravidade", "evento", "dispositivo", "mensagem"],
			rows,
		);
		downloadCsv(`eventos-rede-${eventDayKey(new Date().toISOString())}.csv`, csv);
	}

	return (
		<div
			style={{
				display: "flex",
				// flex:1 + minWidth:0: sem isso a página encolhe ao tamanho do conteúdo.
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
					// No mobile o botão de menu (Sidebar, fixo) cobriria o título.
					padding: isMobile ? "64px 16px 16px" : "32px",
					display: "flex",
					flexDirection: "column",
					gap: 16,
					minHeight: 0,
					overflowY: isMobile ? "auto" : "hidden",
					overflowX: "hidden",
				}}
			>
				<PageHeader
					title="Rede — Eventos"
					subtitle={
						loading && !hasData
							? "Carregando…"
							: `UniFi · ${events.length.toLocaleString("pt-BR")} carregados${hasMore ? " (há mais antigos)" : ""}${
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

				<>
						<div
							style={{
								display: "flex",
								gap: 8,
								flexWrap: "wrap",
								alignItems: "center",
								flexShrink: 0,
							}}
						>
							{[
								{ label: "Todos os dias", value: "" },
								{ label: "Hoje", value: todayKey },
								{ label: "Ontem", value: yesterdayKey },
							].map((chip) => {
								const active = date === chip.value;
								return (
									<button
										key={chip.label}
										type="button"
										className="ld-chip"
										title={chip.value ? formatDayLabel(chip.value, now) : undefined}
										aria-pressed={active}
										onClick={() => setDate(chip.value)}
										style={active ? btnPrimary : btnSecondary}
									>
										{chip.label}
									</button>
								);
							})}
							<span
								aria-hidden
								style={{ width: 1, height: 20, backgroundColor: "var(--border)" }}
							/>
							{SEVERITY_FILTER_OPTIONS.map((opt) => {
								const active = minSeverity === opt.value;
								return (
									<button
										key={opt.label}
										type="button"
										className="ld-chip"
										aria-pressed={active}
										title={`Gravidade: ${opt.label.toLowerCase()}`}
										onClick={() => setMinSeverity(opt.value)}
										style={chipStyle(active)}
									>
										{opt.label}
									</button>
								);
							})}
							<span style={{ flex: 1 }} />
							<button
								type="button"
								className="ld-chip"
								aria-pressed={wrapLines}
								title="Mostra a mensagem inteira em várias linhas"
								onClick={() => setWrapLines((v) => !v)}
								style={chipStyle(wrapLines)}
							>
								{wrapLines ? "✓ " : ""}
								Quebrar linhas
							</button>
							<button
								type="button"
								className="ld-chip"
								title="Baixa os eventos carregados na lista (CSV)"
								onClick={handleExportCsv}
								disabled={!hasData}
								style={{ ...chipStyle(false), opacity: hasData ? 1 : 0.5 }}
							>
								Exportar CSV
							</button>
						</div>

						<div
							style={{
								display: "flex",
								gap: 12,
								alignItems: "flex-end",
								flexShrink: 0,
							}}
						>
							<label
								style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 520 }}
							>
								<span style={searchLabelStyle}>Buscar</span>
								<input
									type="search"
									className="ld-control"
									placeholder="Nome ou mensagem do evento"
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
								<button
									type="button"
									className="ld-chip"
									onClick={clearFilters}
									style={btnSecondary}
								>
									Limpar filtros
								</button>
							)}
						</div>

						{error && !hasData ? (
							<ErrorState
								title="Erro ao carregar eventos de rede"
								message={error}
								onRetry={reload}
							/>
						) : (
						<NetworkEventFeed
							events={events}
							isMobile={isMobile}
							onSelect={setSelected}
							selectedId={selected?.id ?? null}
							resetScrollKey={`${date}|${debouncedSearch}|${minSeverity}`}
							wrapLines={wrapLines}
							highlight={debouncedSearch}
							onFilterName={setSearch}
							onClearFilters={clearFilters}
							filtered={filtered}
							loading={loading}
							clientFor={(ev) => findEventClient(ev, clientLookup)}
							onOpenClient={setSelectedClient}
						/>
						)}

						{(hasMore || (error && hasData)) && (
							<div
								style={{
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									gap: 12,
									flexShrink: 0,
								}}
							>
								{error && hasData && (
									<span role="alert" style={{ fontSize: 12, color: "var(--destructive-text)" }}>
										{error}
									</span>
								)}
								{hasMore && (
									<button
										type="button"
										className="ld-chip"
										onClick={loadMore}
										disabled={loadingMore}
										style={{
											...btnSecondary,
											opacity: loadingMore ? 0.6 : 1,
											cursor: loadingMore ? "default" : "pointer",
										}}
									>
										{loadingMore ? "Carregando…" : "Carregar mais antigos"}
									</button>
								)}
							</div>
						)}

						<NetworkEventDetailsModal
							event={selected}
							onClose={() => setSelected(null)}
						/>
						<NetworkClientDetailsModal
							client={selectedClient}
							onClose={() => setSelectedClient(null)}
						/>
				</>
			</main>
		</div>
	);
}
