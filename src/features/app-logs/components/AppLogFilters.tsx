import React, { useState, useRef, useEffect } from "react";
import { inputStyle } from "../../../lib/styles/inputStyles";
import type { AppFilterState } from "../../../App";
import type { TypeLog } from "../../../App";

interface AppLogFiltersProps {
	filters: AppFilterState;
	onUpdate: (key: keyof AppFilterState, value: string) => void;
	onReset: () => void;
	onTypeToggle: (tipo: TypeLog) => void;
	isMobile: boolean;
	classesDisponiveis: string[];
	programasDisponiveis: string[];
}

function TypeFilterDropdown({
	selected,
	onToggle,
}: {
	selected: TypeLog[];
	onToggle: (t: TypeLog) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Fecha ao clicar fora -- mesma categoria de efeito do useSiteData (sincroniza
	// com um sistema externo, o DOM/document, não é estado derivável no render).
	useEffect(() => {
		if (!isOpen) return;
		function handleClickOutside(e: MouseEvent) {
			if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen]);

	const label =
		selected.length === 0 ? "Todos" : `${selected.length} selecionado(s)`;

	return (
		<div ref={containerRef} style={{ position: "relative" }}>
			<button
				type="button"
				onClick={() => setIsOpen((v) => !v)}
				style={{ ...inputStyle, cursor: "pointer" }}
			>
				{label}
			</button>
			{isOpen && (
				<div
					style={{
						position: "absolute",
						top: "calc(100% + 4px)",
						left: 0,
						zIndex: 10,
						display: "flex",
						flexDirection: "column",
						gap: 8,
						minWidth: 140,
						padding: "10px 12px",
						backgroundColor: "var(--card)",
						border: "1px solid var(--border)",
						borderRadius: 8,
						boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
						userSelect: "none",
					}}
				>
					{(
						[
							"erro",
							"aviso",
							"info",
							"debug",
						] as const satisfies readonly TypeLog[]
					).map((tipo) => (
						<label
							key={tipo}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 6,
								cursor: "pointer",
								fontSize: 13,
								color: "var(--foreground)",
								textTransform: "capitalize",
							}}
						>
							<input
								type="checkbox"
								checked={selected.includes(tipo)}
								onChange={() => onToggle(tipo)}
							/>
							{tipo}
						</label>
					))}
				</div>
			)}
		</div>
	);
}

export function AppLogFilters({
	filters,
	onUpdate,
	onReset,
	onTypeToggle,
	isMobile,
	classesDisponiveis,
	programasDisponiveis,
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
				gridTemplateColumns: isMobile
					? "1fr"
					: "1fr minmax(140px, 160px) minmax(140px, 160px) 140px 140px auto",
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
				<label style={labelStyle}>Programa</label>
				<select
					value={filters.programa}
					onChange={(e) => onUpdate("programa", e.target.value)}
					style={{ ...inputStyle, cursor: "pointer" }}
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
				<label style={labelStyle}>Classe</label>
				<input
					type="text"
					list="app-log-classes"
					placeholder="Filtrar por classe..."
					value={filters.classe}
					onChange={(e) => onUpdate("classe", e.target.value)}
					style={inputStyle}
				/>
				<datalist id="app-log-classes">
					{classesDisponiveis.map((classe) => (
						<option key={classe} value={classe} />
					))}
				</datalist>
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
				<label style={labelStyle}>Tipo</label>
				<TypeFilterDropdown selected={filters.tipo} onToggle={onTypeToggle} />
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
