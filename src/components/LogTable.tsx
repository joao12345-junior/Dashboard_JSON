// src/components/LogTable.tsx
import React, { useState } from "react";
import { Log } from "../lib/types/Log";
import { StatusBadge } from "./StatusBadge";
import { ColumnDefinition } from "../lib/types/ColumnDefinition";

interface LogTableProps {
	logs: Log[];
	columns: ColumnDefinition[];
	isMobile: boolean;
}

export function LogTable({ logs, columns, isMobile }: LogTableProps) {
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

	// Filtra as colunas que devem aparecer no contexto atual (mobile ou desktop)
	const visibleColumns = columns.filter(
		(col) => !col.hideOnMobile || !isMobile,
	);

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

	const tdStyle: React.CSSProperties = {
		padding: "11px 16px",
		fontSize: 13,
		color: "var(--foreground)",
		borderBottom: "1px solid var(--border)",
		verticalAlign: "middle",
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

	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				overflow: "hidden",
				overflowX: "auto",
			}}
		>
			<table
				style={{
					width: "100%",
					borderCollapse: "collapse",
					minWidth: isMobile ? 600 : "auto",
				}}
			>
				<thead>
					<tr>
						{/* Coluna de índice — sempre fixa, não vem do mapper */}
						<th style={{ ...thStyle, width: 48 }}>#</th>

						{/* Colunas dinâmicas — vêm do mapper */}
						{visibleColumns.map((col) => (
							<th key={col.key} style={{ ...thStyle, width: col.width }}>
								{col.label}
							</th>
						))}

						{/* Coluna de status — sempre fixa, não vem do mapper */}
						<th style={{ ...thStyle, width: 110 }}>Status</th>
					</tr>
				</thead>

				<tbody>
					{logs.map((log: Log, i: number) => (
						<React.Fragment key={`${log.date}-${log.time}-${i}`}>
							<tr
								onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
								style={{
									cursor: "pointer",
									transition: "background-color 0.12s",
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.backgroundColor = "var(--accent)")
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.backgroundColor = "transparent")
								}
							>
								{/* Célula de índice — fixa */}
								<td
									style={{
										...tdStyle,
										color: "var(--muted-foreground)",
										fontSize: 11,
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{String(i + 1).padStart(2, "0")}
								</td>

								{/* Células dinâmicas — geradas a partir das colunas visíveis */}
								{visibleColumns.map((col) => (
									<td
										key={col.key}
										style={{
											...tdStyle,
											fontFamily: col.mono ? "var(--font-mono)" : "inherit",
											fontSize: col.mono ? 12 : 13,
											color: col.muted
												? "var(--muted-foreground)"
												: "var(--foreground)",
											whiteSpace: col.noWrap ? "nowrap" : "normal",
											fontVariantNumeric: col.numeric
												? "tabular-nums"
												: "normal",
										}}
									>
										{col.render(log)}
									</td>
								))}

								{/* Célula de status — fixa */}
								<td style={tdStyle}>
									<StatusBadge status={log.status} />
								</td>
							</tr>

							{/* Linha expandida — só aparece ao clicar e quando há payload */}
							{expandedIndex === i && Object.keys(log.payload).length > 0 && (
								<tr>
									<td
										colSpan={visibleColumns.length + 2} // +2 = índice e status fixos
										style={{
											padding: "8px 16px 12px",
											backgroundColor: "var(--muted)",
											borderBottom: "1px solid var(--border)",
										}}
									>
										<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
											{Object.entries(log.payload).map(([key, value]) => (
												<div key={key} style={{ fontSize: 11 }}>
													<span
														style={{
															color: "var(--muted-foreground)",
															textTransform: "uppercase",
															letterSpacing: "0.08em",
														}}
													>
														{key}
													</span>
													<span
														style={{
															marginLeft: 6,
															color: "var(--foreground)",
															fontFamily: "var(--font-mono)",
														}}
													>
														{String(value)}
													</span>
												</div>
											))}
										</div>
									</td>
								</tr>
							)}
						</React.Fragment>
					))}
				</tbody>
			</table>
		</div>
	);
}
