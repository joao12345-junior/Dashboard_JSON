// src/features/app-logs/components/AppLogFeed.tsx
import React, { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import type { AppLog } from "../../../lib/types/Log";
import { formatDayLabel } from "../../../lib/dayLabel";
import { collapseRepeats, maskNumbers } from "../../../lib/collapseRepeats";
import type { CollapsedEntry } from "../../../lib/collapseRepeats";
import { AppTypeBadge } from "./AppTypeBadge";
import { COLOR_BY_TIPO } from "../appTypeColors";

/** Totais de um dia considerando TODOS os registros filtrados (não só a página). */
export interface DayTotals {
	total: number;
	erros: number;
	avisos: number;
}

interface AppLogFeedProps {
	/** Registros da página atual, já filtrados e ordenados (mais recente primeiro). */
	logs: AppLog[];
	/** Chave = "AAAA-MM-DD". Usado no cabeçalho de cada dia. */
	dayTotals: Map<string, DayTotals>;
	isMobile: boolean;
	onSelect: (log: AppLog) => void;
	/** Id do log aberto no modal: a linha fica marcada e a lista rola até ela. */
	selectedId?: number | null;
	/**
	 * Quando qualquer valor daqui muda (filtro ou página), a rolagem volta ao topo.
	 * Sem isso o container mantinha o scroll antigo e a lista abria "no meio",
	 * com o cabeçalho do dia cortando a primeira linha.
	 */
	resetScrollKey: unknown;
	/** Junta repetidos consecutivos (mesmo programa/classe/tipo/mensagem, ignorando números). */
	groupRepeats: boolean;
	/** Quebra mensagens longas em várias linhas em vez de cortar com "…". */
	wrapLines: boolean;
	/** Termo digitado no filtro de mensagem — destacado no texto. */
	highlight: string;
	/** Clique no nome do programa → filtra por ele. */
	onFilterPrograma: (programa: string) => void;
	/** Clique na classe → filtra por ela. */
	onFilterClasse: (classe: string) => void;
}

interface DayGroup {
	date: string;
	logs: AppLog[];
}

/**
 * Agrupa registros consecutivos do mesmo dia. Como a entrada já vem ordenada,
 * não precisa reordenar: só "quebra" o grupo quando a data muda.
 */
function groupByDay(logs: AppLog[]): DayGroup[] {
	const groups: DayGroup[] = [];
	for (const log of logs) {
		const last = groups[groups.length - 1];
		if (last && last.date === log.date) last.logs.push(log);
		else groups.push({ date: log.date, logs: [log] });
	}
	return groups;
}

function signatureOf(log: AppLog): string {
	return `${log.programa ?? ""}|${log.classe}|${log.tipo}|${maskNumbers(log.message)}`;
}

/** Colunas da linha no desktop; o cabeçalho de colunas usa a mesma grade. */
const DESKTOP_COLUMNS = "72px 78px minmax(140px, 220px) 1fr";
/** Altura fixa do cabeçalho de colunas: o cabeçalho do dia gruda logo abaixo dele. */
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

/** Botão sem aparência de botão: o texto continua igual, mas é clicável (filtra por valor). */
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

/**
 * Lista de logs gerais agrupada por dia.
 *
 * Referências de UX (Datadog Log Explorer, Kibana Discover, Grafana Logs):
 * severidade por cor, "filtrar por este valor" com um clique, destaque do
 * termo buscado, quebra de linha opcional e junção de repetidos.
 * Sem virtualização: a página já limita a PAGE_SIZE registros.
 */
export function AppLogFeed({
	logs,
	dayTotals,
	isMobile,
	onSelect,
	selectedId = null,
	resetScrollKey,
	groupRepeats,
	wrapLines,
	highlight,
	onFilterPrograma,
	onFilterClasse,
}: AppLogFeedProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	// ids (do primeiro registro de cada grupo) que o usuário expandiu
	const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

	// Sincroniza com o DOM (posição de rolagem), não é estado derivável no render.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
	}, [resetScrollKey]);

	// Navegando com ← → no modal, a lista acompanha: ao fechar, você vê onde parou.
	useEffect(() => {
		if (selectedId === null) return;
		scrollRef.current
			?.querySelector(`[data-log-id="${selectedId}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [selectedId]);

	function toggleExpanded(id: number) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	if (logs.length === 0) {
		return (
			<div
				style={{
					textAlign: "center",
					padding: "56px 16px",
					backgroundColor: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 8,
					color: "var(--muted-foreground)",
					fontSize: 13,
				}}
			>
				Nenhum log encontrado para os filtros aplicados.
			</div>
		);
	}

	const groups = groupByDay(logs);
	const now = new Date();

	return (
		// Wrapper externo: borda + arredondamento + overflow hidden. A rolagem fica
		// no filho, assim o canto arredondado recorta o cabeçalho e a scrollbar.
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				overflow: "hidden",
				flex: 1,
				// No mobile a página rola; sem um mínimo o feed encolhia a 0px
				// quando cabeçalho + filtros ocupavam a tela inteira.
				minHeight: isMobile ? 360 : 0,
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				ref={scrollRef}
				style={{ overflowY: "auto", flex: 1, minHeight: 0 }}
			>
				{!isMobile && (
					<div style={columnHeaderStyle}>
						<span>Hora</span>
						<span>Tipo</span>
						<span>Origem</span>
						<span>Mensagem</span>
					</div>
				)}
				{groups.map((group) => {
					const totals = dayTotals.get(group.date);
					const entries: CollapsedEntry<AppLog>[] = groupRepeats
						? collapseRepeats(group.logs, signatureOf)
						: group.logs.map((log) => ({ head: log, rest: [] }));
					return (
						<section key={group.date}>
							<div style={dayHeaderStyle(isMobile)}>
								<span>{formatDayLabel(group.date, now)}</span>
								{totals && (
									<span
										style={{
											fontSize: 11,
											fontWeight: 600,
											color: "var(--muted-foreground)",
										}}
									>
										{totals.total.toLocaleString("pt-BR")} registro(s)
										{totals.erros > 0 && (
											<span style={{ color: COLOR_BY_TIPO.erro }}>
												{" "}
												· {totals.erros.toLocaleString("pt-BR")} erro(s)
											</span>
										)}
										{totals.avisos > 0 && (
											<span style={{ color: COLOR_BY_TIPO.aviso }}>
												{" "}
												· {totals.avisos.toLocaleString("pt-BR")} aviso(s)
											</span>
										)}
									</span>
								)}
							</div>
							{entries.map((entry) => {
								const isOpen = expanded.has(entry.head.id);
								return (
									<React.Fragment key={entry.head.id}>
										<FeedRow
											log={entry.head}
											repeatCount={entry.rest.length}
											isOpen={isOpen}
											onToggleRepeats={() => toggleExpanded(entry.head.id)}
											isMobile={isMobile}
											wrapLines={wrapLines}
											highlight={highlight}
											onSelect={onSelect}
											selected={entry.head.id === selectedId}
											onFilterPrograma={onFilterPrograma}
											onFilterClasse={onFilterClasse}
										/>
										{isOpen &&
											entry.rest.map((log) => (
												<FeedRow
													key={log.id}
													log={log}
													repeatCount={0}
													isOpen={false}
													onToggleRepeats={() => undefined}
													isMobile={isMobile}
													wrapLines={wrapLines}
													highlight={highlight}
													onSelect={onSelect}
													selected={log.id === selectedId}
													onFilterPrograma={onFilterPrograma}
													onFilterClasse={onFilterClasse}
													nested
												/>
											))}
									</React.Fragment>
								);
							})}
						</section>
					);
				})}
			</div>
		</div>
	);
}

/** Destaca (case-insensitive) todas as ocorrências de `term` dentro de `text`. */
function Highlighted({ text, term }: { text: string; term: string }) {
	const needle = term.trim().toLowerCase();
	if (!needle) return <>{text}</>;

	const lower = text.toLowerCase();
	const parts: React.ReactNode[] = [];
	let cursor = 0;
	let index = lower.indexOf(needle, cursor);
	while (index !== -1) {
		if (index > cursor) parts.push(text.slice(cursor, index));
		parts.push(
			<mark
				key={index}
				style={{
					backgroundColor: "color-mix(in oklch, var(--primary) 35%, transparent)",
					color: "inherit",
					borderRadius: 2,
				}}
			>
				{text.slice(index, index + needle.length)}
			</mark>,
		);
		cursor = index + needle.length;
		index = lower.indexOf(needle, cursor);
	}
	if (cursor < text.length) parts.push(text.slice(cursor));
	return <>{parts}</>;
}

interface FeedRowProps {
	log: AppLog;
	/** Quantos registros repetidos foram juntados nesta linha (0 = nenhum). */
	repeatCount: number;
	isOpen: boolean;
	onToggleRepeats: () => void;
	isMobile: boolean;
	wrapLines: boolean;
	highlight: string;
	onSelect: (log: AppLog) => void;
	/** Linha aberta no modal. */
	selected: boolean;
	onFilterPrograma: (programa: string) => void;
	onFilterClasse: (classe: string) => void;
	/** Linha de um repetido expandido: levemente recuada e mais apagada. */
	nested?: boolean;
}

function FeedRow({
	log,
	repeatCount,
	isOpen,
	onToggleRepeats,
	isMobile,
	wrapLines,
	highlight,
	onSelect,
	selected,
	onFilterPrograma,
	onFilterClasse,
	nested = false,
}: FeedRowProps) {
	// Toda linha abre o modal: além de "detalhes", ele mostra o contexto
	// (eventos ao redor), copiar e navegação entre registros.
	const origin = log.programa ?? "Sem programa";

	return (
		<div
			role="button"
			tabIndex={0}
			data-log-id={log.id}
			aria-current={selected ? "true" : undefined}
			onClick={() => onSelect(log)}
			onKeyDown={(e) => {
				if (e.target !== e.currentTarget) return;
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect(log);
				}
			}}
			style={{
				// Sticky (cabeçalho de colunas + dia) cobre o topo: a rolagem automática
				// precisa deixar essa folga para a linha não ficar escondida.
				scrollMarginTop: 80,
				scrollMarginBottom: 8,
				display: "grid",
				gridTemplateColumns: isMobile ? "auto 1fr" : DESKTOP_COLUMNS,
				columnGap: 12,
				rowGap: 4,
				alignItems: wrapLines ? "start" : "center",
				position: "relative",
				// Mesmo padding das linhas normais: assim as colunas alinham.
				// O "recuo" visual vem do fundo mais escuro e da opacidade.
				padding: nested ? "6px 16px" : "8px 16px",
				borderBottom: "1px solid var(--border)",
				cursor: "pointer",
				opacity: nested ? 0.75 : 1,
				backgroundColor: selected
					? "color-mix(in oklch, var(--primary) 14%, transparent)"
					: nested
						? "color-mix(in oklch, var(--muted) 45%, transparent)"
						: undefined,
			}}
		>
			{/*
				Faixa de severidade desenhada como barrinha interna (não como border-left):
				uma borda quadrada encostava no canto arredondado do container e
				"vazava" alguns pixels de cor. Aqui ela fica afastada das bordas.
			*/}
			<span
				aria-hidden
				style={{
					position: "absolute",
					left: 4,
					top: 8,
					bottom: 8,
					width: 3,
					borderRadius: 2,
					backgroundColor: COLOR_BY_TIPO[log.tipo],
				}}
			/>
			<span
				style={{
					fontFamily: "monospace",
					fontSize: 12,
					color: "var(--muted-foreground)",
				}}
			>
				{log.time}
			</span>
			<span>
				<AppTypeBadge tipo={log.tipo} />
			</span>
			<span
				style={{
					display: "flex",
					flexDirection: "column",
					minWidth: 0,
					gridColumn: isMobile ? "1 / -1" : undefined,
				}}
			>
				{log.programa ? (
					<button
						type="button"
						title={`Filtrar por programa: ${log.programa}`}
						onClick={(e) => {
							e.stopPropagation();
							onFilterPrograma(log.programa as string);
						}}
						style={{
							...linkButtonStyle,
							fontSize: 13,
							fontWeight: 600,
							color: "var(--foreground)",
						}}
					>
						{origin}
					</button>
				) : (
					<span
						style={{
							fontSize: 13,
							fontWeight: 600,
							color: "var(--muted-foreground)",
						}}
					>
						{origin}
					</span>
				)}
				{log.classe && (
					<button
						type="button"
						title={`Filtrar por classe: ${log.classe}`}
						onClick={(e) => {
							e.stopPropagation();
							onFilterClasse(log.classe);
						}}
						style={{
							...linkButtonStyle,
							fontSize: 11,
							color: "var(--muted-foreground)",
						}}
					>
						{log.classe}
					</button>
				)}
			</span>
			<span
				title={wrapLines ? undefined : log.message}
				style={{
					display: "flex",
					alignItems: wrapLines ? "flex-start" : "center",
					gap: 6,
					minWidth: 0,
					gridColumn: isMobile ? "1 / -1" : undefined,
					fontFamily: "monospace",
					fontSize: 12,
					color: "var(--foreground)",
				}}
			>
				{log.detalhes && (
					<FileText
						size={14}
						color="var(--muted-foreground)"
						aria-label="Tem detalhes"
						style={{ flexShrink: 0, marginTop: wrapLines ? 2 : 0 }}
					/>
				)}
				<span
					style={{
						flex: 1,
						minWidth: 0,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: wrapLines || isMobile ? "normal" : "nowrap",
						wordBreak: "break-word",
					}}
				>
					<Highlighted text={log.message} term={highlight} />
				</span>
				{repeatCount > 0 && (
					<button
						type="button"
						aria-expanded={isOpen}
						title={
							isOpen
								? "Recolher os repetidos"
								: `Mostrar mais ${repeatCount} registro(s) parecido(s)`
						}
						onClick={(e) => {
							e.stopPropagation();
							onToggleRepeats();
						}}
						style={{
							flexShrink: 0,
							padding: "1px 8px",
							borderRadius: 999,
							border: "1px solid var(--border)",
							backgroundColor: "var(--muted)",
							color: "var(--foreground)",
							fontSize: 11,
							fontWeight: 700,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						{isOpen ? "−" : "×"}
						{repeatCount + 1}
					</button>
				)}
			</span>
		</div>
	);
}
