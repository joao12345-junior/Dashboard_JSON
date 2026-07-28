// src/components/LogTable.tsx
import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Log } from "../lib/types/Log";
import { StatusBadge } from "./StatusBadge";
import { CriticalityBadge } from "./CriticalityBadge";
import { ColumnDefinition } from "../lib/types/ColumnDefinition";
import { AppTypeBadge } from "../features/app-logs/components/AppTypeBadge";

interface LogTableProps {
	logs: Log[];
	columns: ColumnDefinition[];
	isMobile: boolean;
	/**
	 * Altura máxima do corpo da tabela em pixels.
	 *
	 * Por que um prop e não hardcoded?
	 * O LogTable é usado em duas situações diferentes:
	 *   - ProcessList / WindowsList: deve preencher o espaço restante da tela
	 *     (sem altura máxima — usa flex: 1 no container pai)
	 *   - CriticalEventsFeed na Home: altura fixa definida pelo layout do card
	 *
	 * Quando maxBodyHeight não é passado, o corpo cresce livremente
	 * e o scroll vem do container pai (a <main> da página).
	 */
	maxBodyHeight?: number;
	showStatusColumn?: boolean;
}

const ROW_HEIGHT = 48;

/** Extrai valor de texto puro de um ReactNode para uso no atributo title */
function extractTextValue(value: React.ReactNode): string {
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	return "";
}

export function LogTable({
	logs,
	columns,
	isMobile,
	maxBodyHeight,
	showStatusColumn = true,
}: LogTableProps) {
	const parentRef = useRef<HTMLDivElement>(null);

	const visibleColumns = columns.filter(
		(col) => !col.hideOnMobile || !isMobile,
	);

	const virtualizer = useVirtualizer({
		count: logs.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 10,
	});

	const thStyle: React.CSSProperties = {
		padding: "10px 16px",
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

	const tdBaseStyle: React.CSSProperties = {
		padding: "0 16px",
		height: ROW_HEIGHT,
		verticalAlign: "middle",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	};

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

	function renderBadge(log: Log): React.ReactNode {
		if (log.logType === "windows-event") {
			return (
				<CriticalityBadge
					criticality={log.criticality}
					levelLabel={log.levelLabel}
				/>
			);
		}
		if (log.logType === "app") {
			return null;
		}
		return <StatusBadge status={log.status ?? 0} />;
	}

	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				// overflow: hidden aqui garante que o borderRadius apareça
				// mesmo com a scrollbar presente
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
				// Quando maxBodyHeight não é definido, o componente preenche
				// o espaço disponível do pai (precisa que o pai tenha flex)
				flex: maxBodyHeight ? "none" : 1,
				minHeight: 0,
			}}
		>
			{/*
				── Cabeçalho fixo ──────────────────────────────────────────────
				O cabeçalho está em um container com overflow: hidden
				(não "auto") para que NUNCA apareça uma scrollbar horizontal nele.

				Por que isso funciona?
				O corpo da tabela abaixo compartilha o mesmo scroll horizontal
				(ambos usam o mesmo wrapper com overflowX: auto).
				Mas o cabeçalho não precisa de scroll próprio — ele sempre
				tem a mesma largura que o corpo, então nunca transborda.
				"hidden" garante que nenhuma scrollbar apareça aqui.
			*/}
			<div
				style={{
					overflowX: "hidden",
					flexShrink: 0,
				}}
			>
				<table
					style={{
						width: "100%",
						borderCollapse: "collapse",
						tableLayout: "fixed",
					}}
				>
					<thead>
						<tr>
							{visibleColumns.map((col) => (
								<th
									key={col.key}
									style={{ ...thStyle, width: col.width ?? "auto" }}
								>
									{col.label}
								</th>
							))}
							{showStatusColumn && (
								<th style={{ ...thStyle, width: 140 }}>Status</th>
							)}
						</tr>
					</thead>
				</table>
			</div>

			{/*
				── Corpo virtualizado com scroll ────────────────────────────────
				Container com scroll — o virtualizador observa este elemento.

				maxBodyHeight:
				  - Definido → altura fixa (ex: na Home, dentro de um card)
				  - Não definido → flex: 1, preenche o espaço restante da página
			*/}
			<div
				ref={parentRef}
				style={
					maxBodyHeight
						? {
								height: maxBodyHeight,
								overflowY: "auto",
								overflowX: "auto",
								backgroundColor: "var(--card)",
							}
						: {
								flex: 1,
								minHeight: 0,
								overflowY: "auto",
								overflowX: "auto",
								backgroundColor: "var(--card)",
							}
				}
			>
				{/*
					Este div representa a altura TOTAL de todos os itens virtualizados.
					O virtualizador calcula getTotalSize() = count * ROW_HEIGHT.
					O scroll funciona como se todos os itens estivessem no DOM,
					mas apenas os visíveis são renderizados — isso é a virtualização.
				*/}
				<div
					style={{
						height: virtualizer.getTotalSize(),
						width: "100%",
						position: "relative",
					}}
				>
					<table
						style={{
							width: "100%",
							borderCollapse: "collapse",
							tableLayout: "fixed",
							position: "absolute",
							top: 0,
							left: 0,
						}}
					>
						<tbody>
							{virtualizer.getVirtualItems().map((virtualRow) => {
								const log = logs[virtualRow.index];
								const isEven = virtualRow.index % 2 === 0;

								return (
									<tr
										key={virtualRow.key}
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											width: "100%",
											transform: `translateY(${virtualRow.start}px)`,
											height: ROW_HEIGHT,
											backgroundColor: isEven
												? "var(--card)"
												: "color-mix(in oklch, var(--muted) 40%, var(--card))",
											borderBottom: "1px solid var(--border)",
											display: "table",
											tableLayout: "fixed",
										}}
										onMouseEnter={(e) =>
											(e.currentTarget.style.backgroundColor = "var(--accent)")
										}
										onMouseLeave={(e) =>
											(e.currentTarget.style.backgroundColor = isEven
												? "var(--card)"
												: "color-mix(in oklch, var(--muted) 40%, var(--card))")
										}
									>
										{visibleColumns.map((col) => {
											const rendered = col.render(log);
											const titleValue = extractTextValue(rendered);

											return (
												<td
													key={col.key}
													title={titleValue}
													style={{
														...tdBaseStyle,
														width: col.width ?? "auto",
														fontSize: col.mono ? 12 : 13,
														fontFamily: col.mono
															? "var(--font-mono)"
															: "inherit",
														color: col.muted
															? "var(--muted-foreground)"
															: "var(--foreground)",
														fontVariantNumeric: col.numeric
															? "tabular-nums"
															: undefined,
													}}
												>
													{rendered}
												</td>
											);
										})}

										{showStatusColumn && (
											<td
												title={
													log.logType === "windows-event"
														? `${log.criticality} · ${log.levelLabel}`
														: log.logType === "app"
															? ""
															: String(log.status ?? 0)
												}
												style={{
													...tdBaseStyle,
													width: 140,
													overflow: "visible",
												}}
											>
												{renderBadge(log)}
											</td>
										)}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* Rodapé com contagem */}
			<div
				style={{
					padding: "8px 16px",
					borderTop: "1px solid var(--border)",
					fontSize: 11,
					color: "var(--muted-foreground)",
					textAlign: "right",
					backgroundColor: "var(--muted)",
					flexShrink: 0,
				}}
			>
				{logs.length.toLocaleString("pt-BR")} registros
			</div>
		</div>
	);
}
