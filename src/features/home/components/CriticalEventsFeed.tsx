// src/features/home/components/CriticalEventsFeed.tsx
import { useState, useMemo } from "react";
import { Log } from "../../../lib/types/Log";
import { StatusBadge } from "../../../components/StatusBadge";
import { CriticalityBadge } from "../../../components/CriticalityBadge";
import { Page } from "../../../App";
import { AppTypeBadge } from "../../app-logs/components/AppTypeBadge";

// ── Tipos ─────────────────────────────────────────────────────────────────────

/**
 * "all" mostra todos os avisos.
 * "process" mostra apenas logs de backup/processo (logType === "process").
 * "windows" mostra apenas Windows Event Logs.
 *
 * Por que um tipo literal e não string?
 * O TypeScript vai apontar erro em qualquer lugar que receba um valor
 * inválido — muito mais seguro do que comparar strings soltas.
 */
type SourceFilter = "all" | "process" | "windows" | "app";

interface CriticalEventsFeedProps {
	events: Log[];
	onNavigate: (page: Page) => void;
	title?: string;
	subtitle?: string;
	accentColor?: string;
	/** Altura fixa da área de scroll da tabela. Default: 420px. */
	tableHeight?: number;
	/** Exibe os botões de filtro por fonte. Default: false. */
	showSourceFilter?: boolean;
}

// ── Constantes ────────────────────────────────────────────────────────────────

/**
 * Quantos itens mostrar antes de "Ver tudo".
 * 50 é suficiente para dar contexto sem travar a renderização inicial.
 */
const INITIAL_LIMIT = 50;

const ROW_HEIGHT = 52; // px — altura de cada linha da tabela

// ── Componente ────────────────────────────────────────────────────────────────

export function CriticalEventsFeed({
	events,
	onNavigate,
	title = "Eventos Críticos Recentes",
	subtitle,
	accentColor = "var(--destructive)",
	tableHeight = 420,
	showSourceFilter = false,
}: CriticalEventsFeedProps) {
	const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
	const [showAll, setShowAll] = useState(false);

	/**
	 * Filtragem por fonte.
	 *
	 * useMemo aqui é importante: sem ele, a filtragem rodaria a cada render
	 * causado por qualquer outro estado da página. Com useMemo, ela só roda
	 * quando `events` ou `sourceFilter` mudam — que é exatamente quando precisa.
	 */
	const filteredEvents = useMemo(() => {
		if (sourceFilter === "all") return events;
		if (sourceFilter === "process")
			return events.filter((l) => l.logType === "process");
		if (sourceFilter === "app")
			return events.filter((l) => l.logType === "app");
		return events.filter((l) => l.logType === "windows-event");
	}, [events, sourceFilter]);

	/**
	 * Lista final renderizada.
	 *
	 * Quando showAll é false, limitamos a INITIAL_LIMIT itens.
	 * Quando showAll é true, renderizamos tudo.
	 *
	 * Por que não virtualizar aqui como o LogTable?
	 * Para 253 itens o DOM aguenta bem. Virtualização traria
	 * complexidade sem benefício mensurável nesse volume.
	 * Se o volume crescer para >2000, aí vale virtualizar.
	 */
	const visibleEvents = showAll
		? filteredEvents
		: filteredEvents.slice(0, INITIAL_LIMIT);

	const hasMore = !showAll && filteredEvents.length > INITIAL_LIMIT;
	const hiddenCount = filteredEvents.length - INITIAL_LIMIT;

	if (events.length === 0) {
		return (
			<div
				style={{
					backgroundColor: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 10,
					padding: "40px 24px",
					textAlign: "center",
					color: "var(--muted-foreground)",
					fontSize: 13,
				}}
			>
				Nenhum evento nesta categoria. Carregue arquivos de log para começar.
			</div>
		);
	}

	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderLeft: `3px solid ${accentColor}`,
				borderRadius: 10,
				// O componente tem altura definida — não cresce com o conteúdo.
				// O scroll acontece DENTRO, não na página.
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			{/* ── Cabeçalho ────────────────────────────────────────────────── */}
			<div
				style={{
					padding: "14px 20px",
					borderBottom: "1px solid var(--border)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					flexShrink: 0, // cabeçalho nunca encolhe
					gap: 12,
					flexWrap: "wrap",
				}}
			>
				<div>
					<div
						style={{
							fontSize: 13,
							fontWeight: 700,
							color: "var(--foreground)",
						}}
					>
						{title}
					</div>
					<div
						style={{
							fontSize: 11,
							color: "var(--muted-foreground)",
							marginTop: 2,
						}}
					>
						{subtitle ??
							`${filteredEvents.length.toLocaleString("pt-BR")} de ${events.length.toLocaleString("pt-BR")} eventos`}
					</div>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					{/* Filtro por fonte — só aparece se showSourceFilter=true */}
					{showSourceFilter && (
						<div
							style={{
								display: "flex",
								gap: 4,
								padding: "3px",
								backgroundColor: "var(--muted)",
								borderRadius: 6,
							}}
						>
							{(
								[
									{ value: "all", label: "Todos" },
									{ value: "process", label: "Backup" },
									{ value: "windows", label: "Windows" },
									{ value: "app", label: "Gerais" },
								] as { value: SourceFilter; label: string }[]
							).map(({ value, label }) => (
								<button
									key={value}
									onClick={() => {
										setSourceFilter(value);
										setShowAll(false); // volta ao limite ao trocar o filtro
									}}
									style={{
										padding: "3px 10px",
										borderRadius: 4,
										border: "none",
										backgroundColor:
											sourceFilter === value ? "var(--card)" : "transparent",
										color:
											sourceFilter === value
												? "var(--foreground)"
												: "var(--muted-foreground)",
										fontSize: 11,
										fontWeight: sourceFilter === value ? 700 : 400,
										cursor: "pointer",
										fontFamily: "inherit",
										boxShadow:
											sourceFilter === value
												? "0 1px 3px rgba(0,0,0,0.12)"
												: "none",
										transition: "all 0.12s",
									}}
								>
									{label}
								</button>
							))}
						</div>
					)}

					{/* Badge de total */}
					<span
						style={{
							padding: "2px 10px",
							borderRadius: 999,
							backgroundColor: `color-mix(in oklch, ${accentColor} 15%, transparent)`,
							color: accentColor,
							fontSize: 11,
							fontWeight: 700,
							fontVariantNumeric: "tabular-nums",
							flexShrink: 0,
						}}
					>
						{filteredEvents.length.toLocaleString("pt-BR")}
					</span>
				</div>
			</div>

			{/* ── Tabela com scroll fixo ────────────────────────────────────── */}
			{/*
				Esta div tem altura fixa e overflow: auto.
				É ela que cria o scroll — não a página.
				O conteúdo cresce dentro dela e a div não cresce.

				Por que não usar um <table> com thead sticky aqui?
				Porque thead sticky requer que o scroll seja no próprio <table>
				ou em um elemento ancestral específico — o que complica o layout.
				Usar div separada para cabeçalho + div com scroll para o corpo
				é o padrão mais confiável para tabelas de altura fixa.
			*/}
			<div style={{ flexShrink: 0, overflowX: "auto" }}>
				{/* Cabeçalho da tabela — fixo, fora da área de scroll */}
				<table
					style={{
						width: "100%",
						borderCollapse: "collapse",
						tableLayout: "fixed",
					}}
				>
					<thead>
						<tr>
							<th style={{ ...thStyle, width: 120 }}>Status</th>
							<th style={thStyle}>Mensagem</th>
							<th style={{ ...thStyle, width: 180, display: "table-cell" }}>
								Origem
							</th>
							<th style={{ ...thStyle, width: 130 }}>Data / Hora</th>
						</tr>
					</thead>
				</table>
			</div>

			{/* Corpo com scroll */}
			<div
				style={{
					height: tableHeight,
					overflowY: "auto",
					overflowX: "auto",
					flex: "none", // altura fixa, sem crescer
				}}
			>
				<table
					style={{
						width: "100%",
						borderCollapse: "collapse",
						tableLayout: "fixed",
					}}
				>
					<tbody>
						{visibleEvents.map((log, i) => (
							<tr
								key={`${log.date}-${log.time}-${i}`}
								onClick={() =>
									onNavigate(
										log.logType === "windows-event"
											? "windows-list"
											: log.logType === "app"
												? "app-list"
												: "process-list",
									)
								}
								style={{
									cursor: "pointer",
									borderBottom: "1px solid var(--border)",
									backgroundColor:
										i % 2 === 0
											? "var(--card)"
											: "color-mix(in oklch, var(--muted) 30%, var(--card))",
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.backgroundColor = "var(--accent)")
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.backgroundColor =
										i % 2 === 0
											? "var(--card)"
											: "color-mix(in oklch, var(--muted) 30%, var(--card))")
								}
							>
								{/* Coluna: badge de status */}
								<td style={{ ...tdStyle, width: 120 }}>
									{log.logType === "windows-event" ? (
										<CriticalityBadge
											criticality={log.criticality}
											levelLabel={log.levelLabel}
										/>
									) : log.logType === "app" ? (
										<AppTypeBadge tipo={log.tipo} />
									) : (
										<StatusBadge status={log.status ?? 0}></StatusBadge>
									)}
								</td>

								{/* Coluna: mensagem */}
								<td
									title={log.message}
									style={{
										...tdStyle,
										color: "var(--foreground)",
										fontWeight: 500,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{log.message}
								</td>

								{/* Coluna: origem (computer · channel ou "Processo") */}
								<td
									title={
										log.logType === "windows-event"
											? `${log.computer} · ${log.channel}`
											: log.logType === "app"
												? (log.programa ?? log.classe)
												: "Log de Processo"
									}
									style={{
										...tdStyle,
										width: 180,
										color: "var(--muted-foreground)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										fontSize: 11,
									}}
								>
									{log.logType === "windows-event"
										? `${log.computer} · ${log.channel}`
										: log.logType === "app"
											? (log.programa ?? log.classe)
											: "Log de Processo"}
								</td>

								{/* Coluna: data e hora */}
								<td
									title={`${log.date} ${log.time}`}
									style={{
										...tdStyle,
										width: 130,
										color: "var(--muted-foreground)",
										fontFamily: "var(--font-mono)",
										fontSize: 11,
										whiteSpace: "nowrap",
									}}
								>
									{log.date.split("-").reverse().join("/")} {log.time}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* ── Rodapé ───────────────────────────────────────────────────── */}
			<div
				style={{
					padding: "10px 20px",
					borderTop: "1px solid var(--border)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					flexShrink: 0,
				}}
			>
				<span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
					{visibleEvents.length.toLocaleString("pt-BR")} de{" "}
					{filteredEvents.length.toLocaleString("pt-BR")} eventos
				</span>

				{hasMore ? (
					<button
						onClick={() => setShowAll(true)}
						style={{
							padding: "5px 14px",
							borderRadius: 6,
							border: `1px solid ${accentColor}`,
							backgroundColor: `color-mix(in oklch, ${accentColor} 10%, transparent)`,
							color: accentColor,
							fontSize: 11,
							fontWeight: 600,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						Ver todos os {hiddenCount.toLocaleString("pt-BR")} restantes
					</button>
				) : (
					<span
						style={{
							fontSize: 11,
							color: "var(--muted-foreground)",
							fontStyle: "italic",
						}}
					>
						Todos os eventos exibidos
					</span>
				)}
			</div>
		</div>
	);
}

// ── Estilos compartilhados entre células ──────────────────────────────────────

const thStyle: React.CSSProperties = {
	padding: "8px 16px",
	textAlign: "left",
	fontSize: 10,
	fontWeight: 700,
	color: "var(--muted-foreground)",
	textTransform: "uppercase",
	letterSpacing: "0.1em",
	borderBottom: "1px solid var(--border)",
	backgroundColor: "var(--muted)",
	whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
	padding: "0 16px",
	height: ROW_HEIGHT,
	verticalAlign: "middle",
	fontSize: 12,
};
