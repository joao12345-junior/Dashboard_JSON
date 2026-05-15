import React from "react";
import { Log } from "../lib/types/Log";
import { StatusBadge } from "./StatusBadge";
import { normalizeDateToView } from "../lib/normalizeDateToView";

interface logTableInterface {
	logs: Log[];
	isMobile: boolean;
}

// ─── LogTable ─────────────────────────────────────────────────────────────────
export function LogTable({ logs, isMobile }: logTableInterface) {
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
		// overflow-x: auto → scroll horizontal em telas pequenas
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
						<th style={thStyle}>Mensagem</th>
						{!isMobile && <th style={{ ...thStyle, width: 120 }}>Data</th>}
						{!isMobile && <th style={{ ...thStyle, width: 100 }}>Hora</th>}
						<th style={{ ...thStyle, width: 110 }}>Status</th>
					</tr>
				</thead>
				<tbody>
					{logs.map((log: Log, i: number) => (
						<tr
							key={`${log.date}-${log.time}-${i}`}
							onMouseEnter={(e) =>
								(e.currentTarget.style.backgroundColor = "var(--accent)")
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.backgroundColor = "transparent")
							}
							style={{ transition: "background-color 0.12s" }}
						>
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
							<td
								style={{
									...tdStyle,
									fontFamily: "var(--font-mono)",
									fontSize: 12,
								}}
							>
								{log.message}
								{/* Em mobile, mostra data/hora inline na mensagem */}
								{isMobile && (
									<div
										style={{
											fontSize: 10,
											color: "var(--muted-foreground)",
											marginTop: 4,
											fontFamily: "var(--font-mono)",
										}}
									>
										{normalizeDateToView(log.date)} · {log.time}
									</div>
								)}
							</td>
							{!isMobile && (
								<td
									style={{
										...tdStyle,
										color: "var(--muted-foreground)",
										fontVariantNumeric: "tabular-nums",
										whiteSpace: "nowrap",
									}}
								>
									{normalizeDateToView(log.date)}
								</td>
							)}
							{!isMobile && (
								<td
									style={{
										...tdStyle,
										fontFamily: "var(--font-mono)",
										color: "var(--muted-foreground)",
										whiteSpace: "nowrap",
									}}
								>
									{log.time}
								</td>
							)}
							<td style={tdStyle}>
								<StatusBadge status={log.status} />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
