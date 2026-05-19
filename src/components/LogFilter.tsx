import React from "react";
import { START_STATUS } from "../lib/Variables";
import { LogFilterState } from "../hooks/useLogsFilters";

interface LogFiltersProps {
	filters: { message: string; date: string; start: string };
	onUpdate: (key: keyof LogFilterState, value: string) => void;
	onReset: () => void;
	isMobile: boolean;
}

// ─── LogFilters ───────────────────────────────────────────────────────────────
export function LogFilters({
	filters,
	onUpdate,
	onReset,
	isMobile,
}: LogFiltersProps) {
	const sharedInput: React.CSSProperties = {
		width: "100%",
		padding: "8px 12px",
		borderRadius: 6,
		border: "1px solid var(--border)",
		backgroundColor: "var(--background)",
		color: "var(--foreground)",
		fontSize: 13,
		fontFamily: "inherit",
		outline: "none",
		boxSizing: "border-box",
	};

	const labelStyle: React.CSSProperties = {
		display: "block",
		fontSize: 10,
		fontWeight: 700,
		color: "var(--muted-foreground)",
		textTransform: "uppercase",
		letterSpacing: "0.1em",
		marginBottom: 6,
	};

	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: isMobile ? "1fr" : "1fr 180px 160px auto",
				gap: 12,
				alignItems: "end",
				padding: "16px 20px",
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				marginBottom: 16,
			}}
		>
			<div>
				<label style={labelStyle}>Mensagem</label>
				<input
					type="text"
					placeholder="Filtrar por mensagem..."
					value={filters.message}
					onChange={(e) => onUpdate("message", e.target.value)}
					style={sharedInput}
				/>
			</div>

			<div>
				<label style={labelStyle}>Data</label>
				<input
					type="date"
					value={filters.date}
					onChange={(e) => onUpdate("date", e.target.value)}
					style={sharedInput}
				/>
			</div>

			<div>
				<label style={labelStyle}>Status</label>
				<select
					value={filters.start}
					onChange={(e) => onUpdate("start", e.target.value)}
					style={{ ...sharedInput, cursor: "pointer" }}
				>
					<option value={START_STATUS.ALL}>Todos</option>
					<option value={START_STATUS.STARTED}>Iniciados</option>
					<option value={START_STATUS.FINISHED}>Finalizados</option>
					<option value={START_STATUS.ERRO}>Erros</option>
				</select>
			</div>

			<button
				onClick={onReset}
				onMouseEnter={(e) =>
					(e.currentTarget.style.backgroundColor = "var(--accent)")
				}
				onMouseLeave={(e) =>
					(e.currentTarget.style.backgroundColor = "transparent")
				}
				style={{
					padding: "8px 14px",
					borderRadius: 6,
					border: "1px solid var(--border)",
					backgroundColor: "transparent",
					color: "var(--muted-foreground)",
					fontSize: 12,
					cursor: "pointer",
					fontFamily: "inherit",
					whiteSpace: "nowrap",
				}}
			>
				Limpar
			</button>
		</div>
	);
}
