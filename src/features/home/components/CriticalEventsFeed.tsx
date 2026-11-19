// src/features/home/components/CriticalEventsFeed.tsx
import { useId, useMemo, useState } from "react";
import type { Log } from "../../../lib/types/Log";
import { StatusBadge } from "../../../components/StatusBadge";
import { CriticalityBadge } from "../../../components/CriticalityBadge";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { AppTypeBadge } from "../../app-logs/components/AppTypeBadge";
import { formatWhen } from "../../../lib/dayOverview";
import { plural } from "../../../lib/plural";
import type { DataState } from "../../../lib/loadStatus";

type SourceFilter = "all" | "process" | "windows" | "app";

interface CriticalEventsFeedProps {
	events: Log[];
	/** Data de hoje (yyyy-mm-dd) — usada para "Hoje 13:46" / "Ontem 16:18". */
	todayIso: string;
	isMobile: boolean;
	/** Evita dizer "Nenhum evento" enquanto os dados ainda estão chegando (ou falharam). */
	dataState: DataState;
	/** Abre a lista da fonte do evento, já filtrada nele (decidido pela página). */
	onOpenEvent: (log: Log) => void;
	title: string;
	subtitle?: string;
	/** Cor de preenchimento/borda (barra lateral, badge). */
	accentColor?: string;
	/** Cor de TEXTO com contraste ≥ 4.5:1 (accentColor sozinha falha no tema claro). */
	accentTextColor?: string;
	/** Altura máxima da área de rolagem. */
	tableHeight?: number;
	showSourceFilter?: boolean;
}

/** Itens renderizados antes de "Ver todos". */
const INITIAL_LIMIT = 50;

const SOURCE_OPTIONS: ReadonlyArray<{ value: SourceFilter; label: string }> = [
	{ value: "all", label: "Todos" },
	{ value: "process", label: "Backup" },
	{ value: "windows", label: "Windows" },
	{ value: "app", label: "Gerais" },
];

const SOURCE_NAME: Record<Log["logType"], string> = {
	process: "Backup",
	"windows-event": "Windows",
	app: "Logs Gerais",
};

/** Texto da coluna Origem. */
function originOf(log: Log): string {
	if (log.logType === "windows-event") return `${log.computer} · ${log.channel}`;
	if (log.logType === "app") return log.programa ?? log.classe;
	return "Log de Backup";
}

function matchesSource(log: Log, filter: SourceFilter): boolean {
	if (filter === "all") return true;
	if (filter === "windows") return log.logType === "windows-event";
	return log.logType === filter;
}

/**
 * Lista rolável dos eventos críticos / avisos da Home.
 *
 * É uma tabela só (cabeçalho `sticky`), então as colunas alinham com o corpo
 * mesmo com a barra de rolagem. A entrada por teclado/leitor de tela é o BOTÃO
 * da mensagem; o clique na linha inteira é só conveniência para o mouse
 * (padrão "redundant click event" — ver docs/2026-11-19-home-…).
 */
export function CriticalEventsFeed({
	events,
	todayIso,
	isMobile,
	dataState,
	onOpenEvent,
	title,
	subtitle,
	accentColor = "var(--destructive)",
	accentTextColor = "var(--destructive-text)",
	tableHeight = 380,
	showSourceFilter = false,
}: CriticalEventsFeedProps) {
	const titleId = useId();
	const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
	const [showAll, setShowAll] = useState(false);

	// useMemo: só refiltra quando a lista ou a fonte mudam.
	const filtered = useMemo(
		() => events.filter((log) => matchesSource(log, sourceFilter)),
		[events, sourceFilter],
	);

	const visible = showAll ? filtered : filtered.slice(0, INITIAL_LIMIT);
	const hiddenCount = filtered.length - visible.length;
	const count = filtered.length.toLocaleString("pt-BR");
	// No mobile o espaçamento lateral encolhe para sobrar largura para a mensagem.
	const th: React.CSSProperties = { ...thStyle, padding: isMobile ? "8px 10px" : thStyle.padding };
	const td: React.CSSProperties = { ...tdStyle, padding: isMobile ? "0 10px" : tdStyle.padding };

	if (events.length === 0) {
		return (
			<div
				role="status"
				style={{
					backgroundColor: "var(--card)",
					border: "1px solid var(--border)",
					borderLeft: `3px solid ${accentColor}`,
					borderRadius: 10,
					padding: "32px 24px",
					textAlign: "center",
					color: "var(--muted-foreground)",
					fontSize: 13,
				}}
			>
				<strong style={{ color: "var(--foreground)" }}>{title}</strong>
				<br />
				{dataState === "loading"
					? "Carregando registros…"
					: dataState === "error"
						? "Dados indisponíveis no momento."
						: "Nenhum evento nesta categoria."}
			</div>
		);
	}

	/** Clique do mouse na linha; ignora botões internos e seleção de texto. */
	function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>, log: Log) {
		if ((e.target as HTMLElement).closest("button")) return;
		if (window.getSelection()?.toString()) return;
		onOpenEvent(log);
	}

	return (
		<section
			aria-labelledby={titleId}
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderLeft: `3px solid ${accentColor}`,
				borderRadius: 10,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				minWidth: 0,
			}}
		>
			<header
				style={{
					padding: "14px 20px",
					borderBottom: "1px solid var(--border)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 12,
					flexWrap: "wrap",
				}}
			>
				<div>
					<h2
						id={titleId}
						style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}
					>
						{title}
					</h2>
					<p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>
						{subtitle ?? `${count} de ${events.length.toLocaleString("pt-BR")} eventos`}
					</p>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					{showSourceFilter && (
						<SegmentedControl<SourceFilter>
							label="Filtrar por fonte"
							options={SOURCE_OPTIONS}
							value={sourceFilter}
							onChange={(value) => {
								setSourceFilter(value);
								setShowAll(false);
							}}
						/>
					)}
					<span
						title={plural(filtered.length, "evento", "eventos")}
						style={{
							padding: "2px 10px",
							borderRadius: 999,
							backgroundColor: `color-mix(in oklch, ${accentColor} 15%, transparent)`,
							color: accentTextColor,
							fontSize: 11,
							fontWeight: 700,
							fontVariantNumeric: "tabular-nums",
							flexShrink: 0,
						}}
					>
						{count}
					</span>
				</div>
			</header>

			{/* Região rolável focável: permite rolar com o teclado. */}
			<div
				role="region"
				aria-labelledby={titleId}
				tabIndex={0}
				className="feed-scroll"
				style={{ maxHeight: tableHeight, overflow: "auto" }}
			>
				<table
					style={{
						width: "100%",
						borderCollapse: "separate",
						borderSpacing: 0,
						tableLayout: "fixed",
					}}
				>
					<caption className="sr-only">
						{title}. Use o botão da mensagem para abrir a lista já filtrada.
					</caption>
					<colgroup>
						<col style={{ width: isMobile ? 100 : 120 }} />
						<col />
						{!isMobile && <col style={{ width: 180 }} />}
						<col style={{ width: isMobile ? 84 : 110 }} />
					</colgroup>
					<thead>
						<tr>
							<th scope="col" style={th}>Status</th>
							<th scope="col" style={th}>Mensagem</th>
							{!isMobile && <th scope="col" style={th}>Origem</th>}
							<th scope="col" style={th}>Quando</th>
						</tr>
					</thead>
					<tbody>
						{visible.length === 0 && (
							<tr>
								<td
									colSpan={isMobile ? 3 : 4}
									style={{
										padding: "28px 16px",
										textAlign: "center",
										fontSize: 12,
										color: "var(--muted-foreground)",
									}}
								>
									Nenhum evento desta fonte nesta lista.
								</td>
							</tr>
						)}
						{visible.map((log, i) => {
							const origin = originOf(log);
							const when = formatWhen(log.date, log.time, todayIso);
							return (
								<tr
									key={`${log.logType}-${log.id}-${log.date}-${log.time}-${i}`}
									className="feed-row"
									onClick={(e) => handleRowClick(e, log)}
								>
									<td style={td}>
										{log.logType === "windows-event" ? (
											<CriticalityBadge
												criticality={log.criticality}
												levelLabel={log.levelLabel}
											/>
										) : log.logType === "app" ? (
											<AppTypeBadge tipo={log.tipo} />
										) : (
											<StatusBadge status={log.status ?? 0} />
										)}
									</td>
									<td style={{ ...td, overflow: "hidden" }}>
										<button
											type="button"
											className="feed-open"
											title={log.message}
											aria-label={`Abrir ${SOURCE_NAME[log.logType]} de ${when}: ${log.message.slice(0, 80)}`}
											onClick={() => onOpenEvent(log)}
										>
											{log.message}
										</button>
									</td>
									{!isMobile && (
										<td
											title={origin}
											style={{
												...td,
												color: "var(--muted-foreground)",
												fontSize: 11,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}}
										>
											{origin}
										</td>
									)}
									<td
										title={`${log.date.split("-").reverse().join("/")} ${log.time}`}
										style={{
											...td,
											color: "var(--muted-foreground)",
											fontFamily: "var(--font-mono)",
											fontSize: 11,
											whiteSpace: "nowrap",
										}}
									>
										{when}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<footer
				style={{
					padding: "10px 20px",
					borderTop: "1px solid var(--border)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 8,
				}}
			>
				<span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
					{visible.length.toLocaleString("pt-BR")} de{" "}
					{plural(filtered.length, "evento", "eventos")}
				</span>
				{hiddenCount > 0 && (
					<button
						type="button"
						className="ld-chip"
						onClick={() => setShowAll(true)}
						style={{
							padding: "5px 14px",
							borderRadius: 6,
							border: `1px solid ${accentColor}`,
							backgroundColor: `color-mix(in oklch, ${accentColor} 10%, transparent)`,
							color: accentTextColor,
							fontSize: 11,
							fontWeight: 600,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						Ver {hiddenCount === 1 ? "o" : "os"}{" "}
						{plural(hiddenCount, "restante", "restantes")}
					</button>
				)}
			</footer>
		</section>
	);
}

// ── Estilos compartilhados entre células ─────────────────────────────────────

const thStyle: React.CSSProperties = {
	position: "sticky",
	top: 0,
	zIndex: 1,
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
	height: 52,
	verticalAlign: "middle",
	fontSize: 12,
	borderBottom: "1px solid var(--border)",
};
