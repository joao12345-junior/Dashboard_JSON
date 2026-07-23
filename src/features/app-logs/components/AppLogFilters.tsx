import React from "react";
import { inputStyle } from "../../../lib/styles/inputStyles";
import type { AppFilterState } from "../../../App";

interface AppLogFiltersProps {
	filters: AppFilterState;
	onUpdate: (key: keyof AppFilterState, value: string) => void;
	onReset: () => void;
	isMobile: boolean;
}

export function AppLogFilters({
	filters,
	onUpdate,
	onReset,
	isMobile,
}: AppLogFiltersProps) {
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
				gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 160px 160px auto",
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
					style={inputStyle}
				/>
			</div>

			<div>
				<label style={labelStyle}>Data</label>
				<input
					type="date"
					value={filters.date}
					onChange={(e) => onUpdate("date", e.target.value)}
					style={inputStyle}
				/>
			</div>

			<div>
				<label style={labelStyle}>Origem</label>
				<input
					type="text"
					placeholder="Filtrar por origem..."
					value={filters.origem}
					onChange={(e) => onUpdate("origem", e.target.value)}
					style={inputStyle}
				/>
			</div>

			<div>
				<label style={labelStyle}>Tipo</label>
				<select
					value={filters.tipo}
					onChange={(e) => onUpdate("tipo", e.target.value)}
					style={{ ...inputStyle, cursor: "pointer" }}
				>
					<option value="all">Todos</option>
					<option value="erro">Erros</option>
					<option value="aviso">Avisos</option>
					<option value="info">Info</option>
					<option value="debug">Debug</option>
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
