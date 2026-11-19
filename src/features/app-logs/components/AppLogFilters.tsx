import React, { useId } from "react";
import { inputStyle } from "../../../lib/styles/inputStyles";
import type { AppFilterState } from "../../../App";

interface AppLogFiltersProps {
	filters: AppFilterState;
	onUpdate: (key: keyof AppFilterState, value: string) => void;
	onReset: () => void;
	isMobile: boolean;
	classesDisponiveis: string[];
	programasDisponiveis: string[];
}

export function AppLogFilters({
	filters,
	onUpdate,
	onReset,
	isMobile,
	classesDisponiveis,
	programasDisponiveis,
}: AppLogFiltersProps) {
	const uid = useId();
	const ids = {
		message: `${uid}-message`,
		programa: `${uid}-programa`,
		classe: `${uid}-classe`,
		date: `${uid}-date`,
	};
	// O tipo (erro/aviso/info/debug) é filtrado pelos chips acima da lista,
	// que já mostram a contagem de cada um. Não há campo duplicado aqui.
	const hasActive =
		filters.message.trim() !== "" ||
		filters.programa !== "all" ||
		filters.classe.trim() !== "" ||
		filters.date !== "" ||
		filters.tipo.length > 0;
	// Altura única: sem isso o <select> e o <input type=date> ficavam com
	// alturas diferentes e os rótulos desalinhavam (alignItems: end).
	// Sem "outline: none": o foco visível vem do CSS (.ld-control).
	const control: React.CSSProperties = {
		...inputStyle,
		outline: undefined,
		height: 36,
	};
	const labelStyle: React.CSSProperties = {
		display: "block",
		fontSize: 11,
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
				gridTemplateColumns: isMobile
					? "1fr"
					: "1fr minmax(140px, 160px) minmax(140px, 160px) 150px auto",
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
				<label htmlFor={ids.message} style={labelStyle}>
					Mensagem
				</label>
				<input
					id={ids.message}
					className="ld-control"
					type="text"
					placeholder="Filtrar por mensagem…"
					value={filters.message}
					onChange={(e) => onUpdate("message", e.target.value)}
					style={control}
				/>
			</div>

			<div>
				<label htmlFor={ids.programa} style={labelStyle}>
					Programa
				</label>
				<select
					id={ids.programa}
					className="ld-control"
					value={filters.programa}
					onChange={(e) => onUpdate("programa", e.target.value)}
					style={{ ...control, cursor: "pointer" }}
				>
					<option value="all">Todos</option>
					{programasDisponiveis.map((programa) => (
						<option key={programa} value={programa}>
							{programa}
						</option>
					))}
				</select>
			</div>

			<div>
				<label htmlFor={ids.classe} style={labelStyle}>
					Classe
				</label>
				<input
					id={ids.classe}
					className="ld-control"
					type="text"
					list="app-log-classes"
					placeholder="Filtrar por classe…"
					value={filters.classe}
					onChange={(e) => onUpdate("classe", e.target.value)}
					style={control}
				/>
				<datalist id="app-log-classes">
					{classesDisponiveis.map((classe) => (
						<option key={classe} value={classe} />
					))}
				</datalist>
			</div>

			<div>
				<label htmlFor={ids.date} style={labelStyle}>
					Data
				</label>
				<input
					id={ids.date}
					className="ld-control"
					type="date"
					value={filters.date}
					onChange={(e) => onUpdate("date", e.target.value)}
					style={control}
				/>
			</div>

			<button
				type="button"
				className="ld-chip"
				onClick={onReset}
				// Sem filtro ligado não há o que limpar: o botão apaga o aspecto de ação.
				disabled={!hasActive}
				style={{
					height: 36,
					padding: "0 14px",
					borderRadius: 6,
					border: "1px solid var(--border)",
					backgroundColor: "transparent",
					color: hasActive ? "var(--foreground)" : "var(--muted-foreground)",
					fontSize: 12,
					fontWeight: 600,
					cursor: hasActive ? "pointer" : "default",
					opacity: hasActive ? 1 : 0.6,
					fontFamily: "inherit",
					whiteSpace: "nowrap",
				}}
			>
				Limpar filtros
			</button>
		</div>
	);
}
