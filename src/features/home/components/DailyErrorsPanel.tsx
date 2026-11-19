// src/features/home/components/DailyErrorsPanel.tsx
import { useState } from "react";
import {
	sortErrorGroups,
	type DayErrorSummary,
	type ErrorGroup,
	type ErrorSource,
	type GroupSort,
} from "../../../lib/errorGroups";
import { SegmentedControl } from "../../../components/SegmentedControl";
import type { DataState } from "../../../lib/loadStatus";
import { formatDayLabel } from "../../../lib/dayLabel";
import { formatElapsed, minutesBetween } from "../../../lib/formatElapsed";
import { plural } from "../../../lib/plural";
import { describeDelta } from "../../../lib/formatDelta";

interface DailyErrorsPanelProps {
	today: DayErrorSummary;
	yesterday: DayErrorSummary;
	/** Erros de ontem até a hora atual — comparação justa com um dia em andamento. */
	yesterdayUntilNow: number;
	/** "HH:MM" atual, só para o rótulo. */
	nowTime: string;
	isMobile: boolean;
	/** "loading"/"error" trocam o "Nenhum erro" por um texto honesto e escondem a variação. */
	dataState: DataState;
	onOpenGroup: (group: ErrorGroup) => void;
}

/** Quantos grupos mostrar por dia antes de "Mostrar mais". */
const INITIAL_GROUPS = 6;

const SOURCE_LABEL: Record<ErrorSource, string> = {
	process: "Backup",
	"windows-event": "Windows",
	app: "App",
};

const pillStyle: React.CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	padding: "1px 8px",
	borderRadius: 999,
	border: "1px solid var(--border)",
	fontSize: 11,
	fontWeight: 600,
	color: "var(--muted-foreground)",
	whiteSpace: "nowrap",
};

/** Mesmo estilo de rótulo dos cartões de KPI da Home (caixa alta, pequeno, espaçado). */
const eyebrowStyle: React.CSSProperties = {
	fontSize: 11,
	fontWeight: 700,
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: "var(--muted-foreground)",
};

/** "13:45 → 13:46" quando o erro se repetiu em horários diferentes; senão "às 13:46". */
function timeRange(group: ErrorGroup): string {
	const first = group.firstTime.slice(0, 5);
	const last = group.lastTime.slice(0, 5);
	return group.count > 1 && first !== last ? `${first} → ${last}` : `às ${last}`;
}

/** Texto lido por leitores de tela para a linha inteira (o visual é fragmentado em vários trechos). */
function rowLabel(group: ErrorGroup, isNewToday: boolean, otherLabel: string): string {
	const parts = [
		`${plural(group.count, "ocorrência", "ocorrências")}: ${group.message}`,
		`${SOURCE_LABEL[group.source]}, ${group.origin}`,
		timeRange(group),
	];
	if (isNewToday) parts.push("Novo hoje, não ocorreu ontem");
	else if (group.otherDayCount > 0)
		parts.push(`${otherLabel}: ${plural(group.otherDayCount, "ocorrência", "ocorrências")}`);
	parts.push("Abre a lista de registros filtrada");
	return parts.join(". ");
}

/** Variação de hoje contra "ontem até a mesma hora": ▲ pior (vermelho), ▼ melhor, = igual. */
function DeltaBadge({
	delta,
	hour,
	todayTotal,
	yesterdayUntilNow,
}: {
	delta: number;
	hour: string;
	todayTotal: number;
	yesterdayUntilNow: number;
}) {
	const { symbol, text, worse } = describeDelta(delta, hour);
	return (
		<span
			title={`Até ${hour}: ontem houve ${plural(yesterdayUntilNow, "erro", "erros")}; hoje, ${plural(todayTotal, "erro", "erros")}.`}
			style={{
				fontSize: 12,
				fontWeight: 700,
				color: worse ? "var(--destructive-text)" : "var(--foreground)",
			}}
		>
			{/* O símbolo é decorativo: o texto já diz "a mais"/"a menos". */}
			<span aria-hidden="true">{symbol} </span>
			{text}
		</span>
	);
}

/**
 * Principais erros de hoje e ontem lado a lado, de todos os tipos de log,
 * agrupados por "mesmo erro" (origem + mensagem, números e GUIDs ignorados).
 * O objetivo é responder em segundos: o que está quebrando AGORA e o que é novo.
 */
export function DailyErrorsPanel({
	today,
	yesterday,
	yesterdayUntilNow,
	nowTime,
	isMobile,
	dataState,
	onOpenGroup,
}: DailyErrorsPanelProps) {
	const [sort, setSort] = useState<GroupSort>("count");
	const ready = dataState === "ready";
	/** Só diz "nenhum erro" quando os dados estão de fato completos. */
	const emptyText = (whenReady: string) =>
		dataState === "loading"
			? "Carregando registros…"
			: dataState === "error"
				? "Dados indisponíveis no momento."
				: whenReady;
	return (
		<section
			aria-labelledby="daily-errors-title"
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderLeft: "3px solid var(--destructive)",
				borderRadius: 10,
				overflow: "hidden",
				// A Home é uma coluna flex de altura fixa: sem isto o painel encolhia
				// (por causa do overflow hidden) e cortava as linhas no mobile.
				flexShrink: 0,
			}}
		>
			<header
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 12,
					flexWrap: "wrap",
					padding: "14px 20px",
					borderBottom: "1px solid var(--border)",
				}}
			>
				<div>
					<h2
						id="daily-errors-title"
						style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}
					>
						Principais erros — hoje e ontem
					</h2>
					<p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted-foreground)" }}>
						Backup, Windows e Logs Gerais. Erros parecidos aparecem juntos. Clique
						em um para ver os registros.
					</p>
				</div>
				<SegmentedControl<GroupSort>
					label="Ordenar erros por"
					value={sort}
					onChange={setSort}
					options={[
						{ value: "count", label: "Mais frequentes" },
						{ value: "recent", label: "Mais recentes" },
						{
							value: "new",
							label: "Novos primeiro",
							title: "Em hoje, os erros que não ocorreram ontem vêm antes",
						},
					]}
				/>
			</header>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
				}}
			>
				<DayColumn
					summary={today}
					extra={
						ready && (
						<>
							<DeltaBadge
								delta={today.total - yesterdayUntilNow}
								hour={nowTime}
								todayTotal={today.total}
								yesterdayUntilNow={yesterdayUntilNow}
							/>
							{today.lastErrorTime && (
								<span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
									· último erro{" "}
									{formatElapsed(minutesBetween(today.lastErrorTime, nowTime))}
								</span>
							)}
						</>
						)
					}
					emptyText={emptyText("Nenhum erro hoje até agora.")}
					otherLabel="ontem"
					flagNew
					sort={sort}
					onOpenGroup={onOpenGroup}
					bordered={!isMobile}
				/>
				<DayColumn
					summary={yesterday}
					extra={
						ready &&
						yesterday.lastErrorTime && (
							<span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
								último erro às {yesterday.lastErrorTime.slice(0, 5)}
							</span>
						)
					}
					emptyText={emptyText("Nenhum erro registrado ontem.")}
					otherLabel="hoje"
					sort={sort}
					onOpenGroup={onOpenGroup}
					topBorder={isMobile}
				/>
			</div>
		</section>
	);
}

interface DayColumnProps {
	summary: DayErrorSummary;
	/** Linha pequena abaixo do total (variação, "último erro há…"). */
	extra?: React.ReactNode;
	/** Texto quando o dia não teve nenhum erro. */
	emptyText: string;
	/** Como chamar o outro dia no texto de cada grupo ("ontem ×4"). */
	otherLabel: string;
	/** Marca "Novo hoje" nos grupos que não apareceram no outro dia. */
	flagNew?: boolean;
	sort: GroupSort;
	onOpenGroup: (group: ErrorGroup) => void;
	/** Borda à direita (separador entre as colunas no desktop). */
	bordered?: boolean;
	/** Borda no topo (separador no mobile). */
	topBorder?: boolean;
}

function DayColumn({
	summary,
	extra,
	emptyText,
	otherLabel,
	flagNew = false,
	sort,
	onOpenGroup,
	bordered = false,
	topBorder = false,
}: DayColumnProps) {
	const [showAll, setShowAll] = useState(false);
	const ordered = sortErrorGroups(summary.groups, sort, flagNew);
	const visible = showAll ? ordered : ordered.slice(0, INITIAL_GROUPS);
	const hidden = summary.groups.length - INITIAL_GROUPS;
	// A barra de cada grupo é proporcional ao mais frequente do dia.
	const maxCount = summary.groups.reduce((max, g) => Math.max(max, g.count), 1);

	const sources = (Object.keys(SOURCE_LABEL) as ErrorSource[]).filter(
		(source) => summary.bySource[source] > 0,
	);

	return (
		<div
			role="group"
			aria-label={formatDayLabel(summary.date)}
			style={{
				minWidth: 0,
				borderRight: bordered ? "1px solid var(--border)" : undefined,
				borderTop: topBorder ? "1px solid var(--border)" : undefined,
			}}
		>
			<div style={{ padding: "14px 20px 12px" }}>
				<div style={eyebrowStyle}>{formatDayLabel(summary.date)}</div>
				<div
					style={{
						display: "flex",
						alignItems: "baseline",
						gap: 8,
						flexWrap: "wrap",
						marginTop: 4,
					}}
				>
					<span
						style={{
							fontSize: 26,
							fontWeight: 800,
							lineHeight: 1.1,
							color: summary.total > 0 ? "var(--destructive)" : "var(--muted-foreground)",
						}}
					>
						{summary.total.toLocaleString("pt-BR")}
					</span>
					<span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>
						{summary.total === 1 ? "erro" : "erros"}
					</span>
					<span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }}>
						{sources.map((source) => (
							<span key={source} style={pillStyle}>
								{SOURCE_LABEL[source]} {summary.bySource[source].toLocaleString("pt-BR")}
							</span>
						))}
					</span>
				</div>
				{extra && (
					<div
						style={{
							display: "flex",
							gap: 6,
							flexWrap: "wrap",
							alignItems: "baseline",
							marginTop: 6,
						}}
					>
						{extra}
					</div>
				)}
			</div>

			{summary.total === 0 ? (
				<div
					style={{
						padding: "20px",
						fontSize: 13,
						color: "var(--muted-foreground)",
						borderTop: "1px solid var(--border)",
					}}
				>
					{emptyText}
				</div>
			) : (
				<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
					{visible.map((group) => {
						const isNewToday = flagNew && group.otherDayCount === 0;
						return (
							<li key={group.key} style={{ borderTop: "1px solid var(--border)" }}>
								<button
									type="button"
									className="daily-error-row"
									onClick={() => onOpenGroup(group)}
									title={group.message}
									aria-label={rowLabel(group, isNewToday, otherLabel)}
									style={{
										display: "grid",
										gridTemplateColumns: "auto 1fr",
										gap: 12,
										alignItems: "start",
										width: "100%",
										padding: "10px 20px 12px",
										border: "none",
										textAlign: "left",
										cursor: "pointer",
										fontFamily: "inherit",
										color: "var(--foreground)",
									}}
								>
									<span
										aria-hidden="true"
										style={{
											minWidth: 40,
											textAlign: "center",
											padding: "2px 6px",
											borderRadius: 6,
											fontFamily: "monospace",
											fontSize: 12,
											fontWeight: 700,
											// Token de texto: o vermelho puro dava 3,9:1 sobre o fundo tingido.
											color: "var(--destructive-text)",
											backgroundColor:
												"color-mix(in oklch, var(--destructive) 14%, transparent)",
										}}
									>
										×{group.count.toLocaleString("pt-BR")}
									</span>
									<span style={{ minWidth: 0 }}>
										<span
											style={{
												display: "-webkit-box",
												WebkitLineClamp: 2,
												WebkitBoxOrient: "vertical",
												overflow: "hidden",
												fontSize: 13,
												fontWeight: 600,
												wordBreak: "break-word",
											}}
										>
											{group.message}
										</span>
										<span
											style={{
												display: "flex",
												gap: 8,
												alignItems: "center",
												flexWrap: "wrap",
												marginTop: 4,
												fontSize: 12,
												color: "var(--muted-foreground)",
											}}
										>
											<span style={pillStyle}>{SOURCE_LABEL[group.source]}</span>
											<span>{group.origin}</span>
											<span>· {timeRange(group)}</span>
											{isNewToday ? (
												<strong style={{ color: "var(--destructive-text)" }}>
													Novo hoje
												</strong>
											) : group.otherDayCount > 0 ? (
												<span>
													· {otherLabel} ×{group.otherDayCount.toLocaleString("pt-BR")}
												</span>
											) : null}
										</span>
										{/* Participação no dia: o erro mais frequente tem a barra cheia. */}
										<span
											aria-hidden="true"
											style={{
												display: "block",
												height: 3,
												borderRadius: 2,
												marginTop: 8,
												backgroundColor:
													"color-mix(in oklch, var(--muted) 70%, transparent)",
											}}
										>
											<span
												style={{
													display: "block",
													height: "100%",
													width: `${Math.max(4, Math.round((group.count / maxCount) * 100))}%`,
													borderRadius: 2,
													backgroundColor: "var(--destructive)",
													opacity: 0.7,
												}}
											/>
										</span>
									</span>
								</button>
							</li>
						);
					})}
					{hidden > 0 && (
						<li style={{ borderTop: "1px solid var(--border)" }}>
							<button
								type="button"
								className="daily-error-row"
								aria-expanded={showAll}
								onClick={() => setShowAll((v) => !v)}
								style={{
									width: "100%",
									padding: "13px 20px",
									border: "none",
									textAlign: "left",
									cursor: "pointer",
									fontFamily: "inherit",
									fontSize: 12,
									fontWeight: 600,
									color: "var(--muted-foreground)",
								}}
							>
								{showAll
									? "Mostrar menos"
									: `Mostrar mais ${hidden.toLocaleString("pt-BR")} ${hidden === 1 ? "tipo" : "tipos"} de erro`}
							</button>
						</li>
					)}
				</ul>
			)}
		</div>
	);
}
