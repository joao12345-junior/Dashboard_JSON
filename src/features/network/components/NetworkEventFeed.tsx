// src/features/network/components/NetworkEventFeed.tsx
import React, { useEffect, useRef } from "react";
import type { NetworkEvent } from "../hooks/useNetworkEvents";
import { formatDayLabel } from "../../../lib/dayLabel";
import { plural } from "../../../lib/plural";
import { btnSecondary } from "../../../lib/styles/buttonStyles";
import { Highlighted } from "../../app-logs/components/AppLogFeed";
import { eventClock, eventDayKey } from "../formatEventTime";
import {
	severityBarColor,
	severityRowTipo,
	severityTone,
} from "../severity";
import { SeverityBadge } from "./SeverityBadge";

interface NetworkEventFeedProps {
	/** Eventos carregados, do mais novo para o mais antigo. */
	events: NetworkEvent[];
	isMobile: boolean;
	onSelect: (event: NetworkEvent) => void;
	/** Id do evento aberto no modal: a linha fica marcada. */
	selectedId: number | null;
	/** Quando muda (filtro), a rolagem volta ao topo. */
	resetScrollKey: unknown;
	/** Quebra mensagens longas em várias linhas em vez de cortar com "…". */
	wrapLines: boolean;
	/** Termo da busca — destacado na mensagem e no nome. */
	highlight: string;
	/** Clique no nome do evento → filtra a busca por ele. */
	onFilterName: (name: string) => void;
	/** Ação do estado vazio com filtros ligados. */
	onClearFilters?: () => void;
	/** Há filtro ligado (muda o texto do estado vazio). */
	filtered: boolean;
	loading: boolean;
}

interface DayGroup {
	day: string;
	events: NetworkEvent[];
}

/** Colunas da linha no desktop; o cabeçalho de colunas usa a mesma grade. */
const DESKTOP_COLUMNS = "72px 104px minmax(140px, 240px) 1fr";
const COLUMN_HEADER_HEIGHT = 32;

const columnHeaderStyle: React.CSSProperties = {
	position: "sticky",
	top: 0,
	zIndex: 2,
	display: "grid",
	gridTemplateColumns: DESKTOP_COLUMNS,
	columnGap: 12,
	alignItems: "center",
	height: COLUMN_HEADER_HEIGHT,
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

function dayHeaderStyle(isMobile: boolean): React.CSSProperties {
	return {
		position: "sticky",
		top: isMobile ? 0 : COLUMN_HEADER_HEIGHT,
		zIndex: 1,
		display: "flex",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: 12,
		flexWrap: "wrap",
		padding: "8px 16px",
		backgroundColor: "var(--card)",
		borderBottom: "1px solid var(--border)",
		fontSize: 12,
		fontWeight: 700,
		color: "var(--foreground)",
	};
}

const linkButtonStyle: React.CSSProperties = {
	background: "none",
	border: "none",
	padding: 0,
	margin: 0,
	font: "inherit",
	color: "inherit",
	textAlign: "left",
	cursor: "pointer",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	maxWidth: "100%",
};

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

/** Agrupa eventos consecutivos do mesmo dia (a entrada já vem ordenada). */
function groupByDay(events: NetworkEvent[]): DayGroup[] {
	const groups: DayGroup[] = [];
	for (const ev of events) {
		const day = eventDayKey(ev.event_time ?? ev.created_at);
		const last = groups[groups.length - 1];
		if (last && last.day === day) last.events.push(ev);
		else groups.push({ day, events: [ev] });
	}
	return groups;
}

/// <summary>
/// Lista de eventos de rede agrupada por dia, no mesmo padrão da lista de Logs
/// Gerais: cabeçalho de colunas e de dia fixos, faixa lateral de gravidade,
/// termo buscado destacado e clique na linha para abrir os detalhes. Os totais
/// por dia contam só o que já foi carregado ("Carregar mais" traz os antigos).
/// </summary>
export function NetworkEventFeed({
	events,
	isMobile,
	onSelect,
	selectedId,
	resetScrollKey,
	wrapLines,
	highlight,
	onFilterName,
	onClearFilters,
	filtered,
	loading,
}: NetworkEventFeedProps) {
	const scrollRef = useRef<HTMLDivElement>(null);

	// Sincroniza com o DOM (posição de rolagem), não é estado derivável no render.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
	}, [resetScrollKey]);

	if (events.length === 0 && loading) {
		return (
			<div role="status" style={emptyBoxStyle}>
				Carregando eventos de rede…
			</div>
		);
	}

	if (events.length === 0) {
		return (
			<div role="status" style={emptyBoxStyle}>
				<strong style={{ color: "var(--foreground)", fontSize: 14 }}>
					{filtered ? "Nenhum evento com esses filtros" : "Nenhum evento de rede ainda"}
				</strong>
				<span>
					{filtered
						? "Amplie o período ou remova algum filtro para ver mais."
						: "Confira se o coletor syslog está rodando e se o UniFi aponta para ele."}
				</span>
				{filtered && onClearFilters && (
					<button
						type="button"
						className="ld-chip"
						onClick={onClearFilters}
						style={{ ...btnSecondary, marginTop: 10 }}
					>
						Limpar filtros
					</button>
				)}
			</div>
		);
	}

	const groups = groupByDay(events);
	const now = new Date();

	return (
		<div
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
			<div ref={scrollRef} style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
				{!isMobile && (
					<div style={columnHeaderStyle}>
						<span>Hora</span>
						<span>Gravidade</span>
						<span>Evento</span>
						<span>Mensagem</span>
					</div>
				)}
				{groups.map((group) => {
					const high = group.events.filter(
						(e) => severityTone(e.severity) === "high",
					).length;
					const medium = group.events.filter(
						(e) => severityTone(e.severity) === "medium",
					).length;
					return (
						<section key={group.day}>
							<div style={dayHeaderStyle(isMobile)}>
								<span>{formatDayLabel(group.day, now)}</span>
								<span
									style={{
										fontSize: 11,
										fontWeight: 600,
										color: "var(--muted-foreground)",
									}}
								>
									{plural(group.events.length, "evento", "eventos")}
									{high > 0 && (
										<span style={{ color: "var(--destructive-text)" }}>
											{" "}
											· {plural(high, "alta", "altas")}
										</span>
									)}
									{medium > 0 && (
										<span style={{ color: "var(--warning-text)" }}>
											{" "}
											· {plural(medium, "média", "médias")}
										</span>
									)}
								</span>
							</div>
							{group.events.map((ev) => (
								<EventRow
									key={ev.id}
									ev={ev}
									isMobile={isMobile}
									wrapLines={wrapLines}
									highlight={highlight}
									selected={ev.id === selectedId}
									onSelect={onSelect}
									onFilterName={onFilterName}
								/>
							))}
						</section>
					);
				})}
			</div>
		</div>
	);
}

interface EventRowProps {
	ev: NetworkEvent;
	isMobile: boolean;
	wrapLines: boolean;
	highlight: string;
	selected: boolean;
	onSelect: (event: NetworkEvent) => void;
	onFilterName: (name: string) => void;
}

function EventRow({
	ev,
	isMobile,
	wrapLines,
	highlight,
	selected,
	onSelect,
	onFilterName,
}: EventRowProps) {
	const when = ev.event_time ?? ev.created_at;
	const name = ev.name ?? "Sem nome";
	const device = ev.extension.UNIFIdeviceName ?? ev.source_ip ?? null;
	const message = ev.extension.msg ?? "";

	return (
		<div
			className="app-log-row"
			data-tipo={severityRowTipo(ev.severity)}
			aria-current={selected ? "true" : undefined}
			onClick={(e) => {
				// Cliques em botões internos têm ação própria; seleção de texto não abre.
				if ((e.target as HTMLElement).closest("button")) return;
				if (window.getSelection()?.toString()) return;
				onSelect(ev);
			}}
			style={{
				display: "grid",
				gridTemplateColumns: isMobile ? "auto auto 1fr" : DESKTOP_COLUMNS,
				columnGap: 12,
				rowGap: 4,
				alignItems: wrapLines ? "start" : "center",
				position: "relative",
				padding: "8px 16px",
				borderBottom: "1px solid var(--border)",
				cursor: "pointer",
			}}
		>
			<span
				aria-hidden
				style={{
					position: "absolute",
					left: 4,
					top: 8,
					bottom: 8,
					width: 3,
					borderRadius: 2,
					backgroundColor: severityBarColor(ev.severity),
				}}
			/>
			{/* Ponto de entrada por teclado e leitor de tela (a linha em si não é botão). */}
			<button
				type="button"
				className="app-log-open"
				title="Ver detalhes do evento"
				aria-label={`Abrir evento das ${eventClock(when)}: ${name}`}
				onClick={(e) => {
					e.stopPropagation();
					onSelect(ev);
				}}
				style={{
					...linkButtonStyle,
					fontFamily: "monospace",
					fontSize: 12,
					color: "var(--muted-foreground)",
				}}
			>
				{eventClock(when)}
			</button>
			<span>
				<SeverityBadge severity={ev.severity} />
			</span>
			<span
				style={{
					display: "flex",
					flexDirection: "column",
					minWidth: 0,
					gridColumn: isMobile ? "1 / -1" : undefined,
				}}
			>
				{ev.name ? (
					<button
						type="button"
						className="ld-link-btn"
						title={`Filtrar por evento: ${name}`}
						onClick={(e) => {
							e.stopPropagation();
							onFilterName(name);
						}}
						style={{
							...linkButtonStyle,
							fontSize: 13,
							fontWeight: 600,
							color: "var(--foreground)",
						}}
					>
						<Highlighted text={name} term={highlight} />
					</button>
				) : (
					<span
						style={{
							fontSize: 13,
							fontWeight: 600,
							color: "var(--muted-foreground)",
						}}
					>
						{name}
					</span>
				)}
				{device && (
					<span
						style={{
							fontSize: 11,
							color: "var(--muted-foreground)",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
						title={ev.device_product ? `${device} · ${ev.device_product}` : device}
					>
						{device}
					</span>
				)}
			</span>
			<span
				title={wrapLines ? undefined : message}
				style={{
					minWidth: 0,
					gridColumn: isMobile ? "1 / -1" : undefined,
					fontFamily: "monospace",
					fontSize: 12,
					color: "var(--foreground)",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: wrapLines || isMobile ? "normal" : "nowrap",
					wordBreak: "break-word",
				}}
			>
				{message ? <Highlighted text={message} term={highlight} /> : "—"}
			</span>
		</div>
	);
}
