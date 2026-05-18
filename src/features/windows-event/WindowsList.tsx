// src/features/windows-event/WindowsList.tsx
import { useState, useRef, useCallback, useMemo } from "react";
import { useLogs } from "../../hooks/useLogs";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { LogTable } from "../../components/LogTable";
import { LoadingState } from "../../components/Loading";
import { ErrorState } from "../../components/Error";
import { useWindowSize } from "../../hooks/useWindowSize";
import { getMapper } from "../../lib/data/LogMapperRegistry";
import { WindowsEventLog } from "../../lib/types/Log";
import type { Page } from "../../App";

// Filtros específicos para Event Logs — diferentes dos filtros de ProcessLog
interface WindowsFilters {
	message: string;
	date: string;
	criticality: "all" | "High" | "Medium" | "Low";
	provider: string;
}

const INITIAL_FILTERS: WindowsFilters = {
	message: "",
	date: "",
	criticality: "all",
	provider: "",
};

interface WindowsListProps {
	onNavigate: (page: Page) => void;
}

export function WindowsList({ onNavigate }: WindowsListProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [logFiles, setLogFiles] = useState<File[]>([]);
	const [filters, setFilters] = useState<WindowsFilters>(INITIAL_FILTERS);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { logs, isLoading, error } = useLogs(logFiles);

	const windowsLogs = useMemo(
		() =>
			logs.filter((l): l is WindowsEventLog => l.logType === "windows-event"),
		[logs],
	);

	// Filtros específicos de Windows Event Log — useMemo evita recalcular a cada render
	const filteredLogs = useMemo(() => {
		return windowsLogs
			.filter((l) => {
				const matchMessage = l.message
					.toLowerCase()
					.includes(filters.message.toLowerCase());
				const matchDate = filters.date ? l.date === filters.date : true;
				const matchCriticality =
					filters.criticality !== "all"
						? l.criticality === filters.criticality
						: true;
				const matchProvider = filters.provider
					? l.provider.toLowerCase().includes(filters.provider.toLowerCase())
					: true;
				return matchMessage && matchDate && matchCriticality && matchProvider;
			})
			.sort((a, b) =>
				`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
			);
	}, [windowsLogs, filters]);

	const columns = useMemo(() => getMapper("windows-event").columns ?? [], []);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []).filter((f) =>
				f.name.endsWith(".json"),
			) as File[];
			if (files.length) setLogFiles(files);
			e.target.value = "";
		},
		[],
	);

	return (
		<div
			style={{
				display: "flex",
				minHeight: "100vh",
				backgroundColor: "var(--background)",
			}}
		>
			<Sidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				isMobile={isMobile}
				currentPage="windows-list"
				onNavigate={onNavigate}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px",
					overflowY: "auto",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: 24,
					}}
				>
					<div>
						<h1
							style={{
								fontSize: 22,
								fontWeight: 800,
								color: "var(--foreground)",
								margin: 0,
							}}
						>
							Registros — Windows Event Log
						</h1>
						<p
							style={{
								fontSize: 13,
								color: "var(--muted-foreground)",
								margin: "4px 0 0",
							}}
						>
							{filteredLogs.length} de {windowsLogs.length} eventos
						</p>
					</div>
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						<ThemeToggleButton />
						<input
							ref={fileInputRef}
							type="file"
							accept=".json"
							multiple
							style={{ display: "none" }}
							onChange={handleFileChange}
						/>
						<button
							onClick={() => fileInputRef.current?.click()}
							style={{
								padding: "8px 16px",
								borderRadius: 8,
								border: "1px solid var(--border)",
								backgroundColor: "var(--primary)",
								color: "var(--primary-foreground)",
								fontSize: 13,
								fontWeight: 600,
								cursor: "pointer",
							}}
						>
							+ Carregar Logs
						</button>
					</div>
				</div>

				{/* Filtros específicos para Event Logs */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr 1fr auto",
						gap: 10,
						marginBottom: 20,
						padding: "16px 20px",
						backgroundColor: "var(--card)",
						border: "1px solid var(--border)",
						borderRadius: 8,
					}}
				>
					<input
						type="text"
						placeholder="Filtrar por descrição..."
						value={filters.message}
						onChange={(e) =>
							setFilters((f) => ({ ...f, message: e.target.value }))
						}
						style={inputStyle}
					/>
					<input
						type="date"
						value={filters.date}
						onChange={(e) =>
							setFilters((f) => ({ ...f, date: e.target.value }))
						}
						style={inputStyle}
					/>
					<select
						value={filters.criticality}
						onChange={(e) =>
							setFilters((f) => ({
								...f,
								criticality: e.target.value as WindowsFilters["criticality"],
							}))
						}
						style={inputStyle}
					>
						<option value="all">Todas as criticidades</option>
						<option value="High">Alta</option>
						<option value="Medium">Média</option>
						<option value="Low">Baixa</option>
					</select>
					<input
						type="text"
						placeholder="Filtrar por provider..."
						value={filters.provider}
						onChange={(e) =>
							setFilters((f) => ({ ...f, provider: e.target.value }))
						}
						style={inputStyle}
					/>
					<button
						onClick={() => setFilters(INITIAL_FILTERS)}
						style={{
							padding: "8px 14px",
							borderRadius: 6,
							border: "1px solid var(--border)",
							backgroundColor: "transparent",
							color: "var(--muted-foreground)",
							fontSize: 12,
							cursor: "pointer",
						}}
					>
						Limpar
					</button>
				</div>

				{isLoading && <LoadingState />}
				{error && <ErrorState message={error} />}

				{!isLoading && !error && (
					<LogTable logs={filteredLogs} columns={columns} isMobile={isMobile} />
				)}
			</main>
		</div>
	);
}

// Estilo compartilhado dos inputs de filtro
const inputStyle: React.CSSProperties = {
	padding: "8px 12px",
	borderRadius: 6,
	border: "1px solid var(--border)",
	backgroundColor: "var(--background)",
	color: "var(--foreground)",
	fontSize: 13,
	outline: "none",
	width: "100%",
};
