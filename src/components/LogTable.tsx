// src/components/LogTable.tsx
import React, { useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Log } from "../lib/types/Log";
import { StatusBadge } from "./StatusBadge";
import { CriticalityBadge } from "./CriticalityBadge";
import { ColumnDefinition } from "../lib/types/ColumnDefinition";

interface LogTableProps {
	logs: Log[];
	columns: ColumnDefinition[];
	isMobile: boolean;
}

const ROW_HEIGHT = 48;

export function LogTable({ logs, columns, isMobile }: LogTableProps) {
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
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
		return <StatusBadge status={log.status} />;
	}

	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				overflow: "hidden",
			}}
		>
			{/* ── Cabeçalho fixo ── */}
			<div style={{ overflowX: "auto" }}>
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
							<th style={{ ...thStyle, width: 140 }}>Status</th>
						</tr>
					</thead>
				</table>
			</div>

			{/*
        Container com scroll — o virtualizador observa este elemento.
        O fundo sólido aqui é importante: impede que linhas absolutas
        "apareçam" fora dos limites do container durante o scroll.
      */}
			<div
				ref={parentRef}
				style={{
					height: Math.min(logs.length * ROW_HEIGHT, 600),
					overflowY: "auto",
					overflowX: "auto",
					backgroundColor: "var(--card)",
				}}
			>
				{/*
          Este div representa a altura total de TODOS os itens.
          O scroll tem o tamanho correto mesmo que a maioria das
          linhas não exista no DOM — é uma ilusão de completude.
        */}
				<div
					style={{ height: virtualizer.getTotalSize(), position: "relative" }}
				>
					{virtualizer.getVirtualItems().map((virtualRow) => {
						const log = logs[virtualRow.index];
						const isExpanded = expandedIndex === virtualRow.index;

						return (
							/*
                O div pai de cada linha controla o z-index.
                backgroundColor sólido aqui é essencial — sem ele,
                o hover de uma linha "vaza" visualmente sobre as vizinhas
                porque position:absolute não tem fronteiras naturais.
              */
							<div
								key={virtualRow.key}
								style={{
									position: "absolute",
									top: virtualRow.start,
									left: 0,
									right: 0,
									height: ROW_HEIGHT,
									zIndex: isExpanded ? 2 : 1,
									backgroundColor: isExpanded ? "var(--accent)" : "var(--card)",
								}}
								onMouseEnter={(e) => {
									// Eleva o z-index durante hover para garantir que
									// este elemento fique acima dos vizinhos
									(e.currentTarget as HTMLDivElement).style.zIndex = "3";
									if (!isExpanded) {
										(e.currentTarget as HTMLDivElement).style.backgroundColor =
											"var(--muted)";
									}
								}}
								onMouseLeave={(e) => {
									(e.currentTarget as HTMLDivElement).style.zIndex = isExpanded
										? "2"
										: "1";
									if (!isExpanded) {
										(e.currentTarget as HTMLDivElement).style.backgroundColor =
											"var(--card)";
									}
								}}
								onClick={() =>
									setExpandedIndex(isExpanded ? null : virtualRow.index)
								}
							>
								<table
									style={{
										width: "100%",
										borderCollapse: "collapse",
										tableLayout: "fixed",
										cursor: "pointer",
									}}
								>
									<tbody>
										<tr>
											{visibleColumns.map((col) => (
												<td
													key={col.key}
													style={{
														padding: "0 16px", // ← retira padding vertical — altura controlada pelo div pai
														fontSize: 13,
														color: col.muted
															? "var(--muted-foreground)"
															: "var(--foreground)",
														borderBottom: "1px solid var(--border)",
														verticalAlign: "middle",
														whiteSpace: "nowrap", // ← sempre nowrap — nunca deixa quebrar
														fontFamily: col.mono ? "monospace" : "inherit",
														textAlign: col.numeric ? "right" : "left",
														width: col.width ?? "auto",
														maxWidth: col.width ?? 300,
														overflow: "hidden",
														textOverflow: "ellipsis",
														height: ROW_HEIGHT, // ← altura explícita igual ao virtualizer
													}}
												>
													{col.render(log)}
												</td>
											))}
											<td
												style={{
													padding: "11px 16px",
													borderBottom: "1px solid var(--border)",
													verticalAlign: "middle",
													width: 140,
													minWidth: 140,
													whiteSpace: "nowrap",
												}}
											>
												{renderBadge(log)}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						);
					})}
				</div>
			</div>

			{/* Rodapé com contagem total */}
			<div
				style={{
					padding: "8px 16px",
					borderTop: "1px solid var(--border)",
					fontSize: 11,
					color: "var(--muted-foreground)",
					backgroundColor: "var(--muted)",
				}}
			>
				{logs.length.toLocaleString("pt-BR")} registros
			</div>
		</div>
	);
}
