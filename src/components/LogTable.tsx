// src/components/LogTable.tsx
import React, { useState } from "react";
import { Log } from "../lib/types/Log";
import { StatusBadge } from "./StatusBadge";
import { CriticalityBadge } from "./CriticalityBadge";
import { ColumnDefinition } from "../lib/types/ColumnDefinition";

interface LogTableProps {
	logs: Log[];
	columns: ColumnDefinition[];
	isMobile: boolean;
}

export function LogTable({ logs, columns, isMobile }: LogTableProps) {
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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

	// ── Função auxiliar: decide qual badge renderizar ──────────────────────
	// Aqui a união discriminada trabalha a nosso favor:
	// dentro de cada branch, o TypeScript sabe exatamente qual tipo é o log
	function renderBadge(log: Log): React.ReactNode {
		if (log.logType === "windows-event") {
			// TypeScript sabe: log é WindowsEventLog aqui
			// log.criticality e log.levelLabel existem com certeza
			return (
				<CriticalityBadge
					criticality={log.criticality}
					levelLabel={log.levelLabel}
				/>
			);
		}
		// TypeScript sabe: log é ProcessLog aqui
		// log.status existe com certeza
		return <StatusBadge status={log.status} />;
	}

	// ── Função auxiliar: decide o que mostrar na linha expandida ──────────
	// ProcessLog tem payload com campos extras
	// WindowsEventLog expõe campos técnicos do System do Windows
	function renderExpandedRow(log: Log, colSpan: number): React.ReactNode {
		// Dados a exibir — diferentes por tipo
		const entries: [string, string][] =
			log.logType === "windows-event"
				? [
						["Provider", log.provider],
						["Event ID", log.eventId],
						["Record ID", log.recordId],
						["Computer", log.computer],
						["Channel", log.channel],
						["Fonte", log.source],
					]
				: Object.entries(log.payload).map(([k, v]) => [k, String(v)]);

		// WindowsEventLog sempre tem entradas para mostrar
		// ProcessLog só expande se tiver payload
		if (entries.length === 0) return null;

		return (
			<tr>
				<td
					colSpan={colSpan}
					style={{
						padding: "8px 16px 12px",
						backgroundColor: "var(--muted)",
						borderBottom: "1px solid var(--border)",
					}}
				>
					<div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
						{entries.map(([key, value]) => (
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
									{value}
								</span>
							</div>
						))}
					</div>
				</td>
			</tr>
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
						<th style={{ ...thStyle, width: 48 }}>#</th>
						{visibleColumns.map((col) => (
							<th key={col.key} style={{ ...thStyle, width: col.width }}>
								{col.label}
							</th>
						))}
						{/* Cabeçalho da última coluna muda conforme o tipo de log */}
						<th style={{ ...thStyle, width: 120 }}>
							{logs[0]?.logType === "windows-event" ? "Criticidade" : "Status"}
						</th>
					</tr>
				</thead>

				<tbody>
					{logs.map((log, i) => (
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
								{/* Índice */}
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

								{/* Colunas dinâmicas do mapper */}
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

								{/* Badge — renderBadge decide qual usar */}
								<td style={tdStyle}>{renderBadge(log)}</td>
							</tr>

							{/* Linha expandida — clique na linha para abrir */}
							{expandedIndex === i &&
								renderExpandedRow(log, visibleColumns.length + 2)}
						</React.Fragment>
					))}
				</tbody>
			</table>
		</div>
	);
}
