// src/features/windows-event/WindowsList.tsx
import { useState, useMemo } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { LogTable } from "../../components/LogTable";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { getMapper } from "../../lib/data/LogMapperRegistry";
import { WindowsEventLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function WindowsList({
	logs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
	windowsFilters,
	onWindowsFilterUpdate,
	onWindowsFilterReset,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const windowsLogs = useMemo(
		() =>
			logs.filter((l): l is WindowsEventLog => l.logType === "windows-event"),
		[logs],
	);

	/**
	 * Filtros vêm do App — preservados ao navegar.
	 * O operador pode alternar entre WindowsList e WindowsDashboard
	 * sem perder o contexto da investigação.
	 */
	const filteredLogs = useMemo(() => {
		return windowsLogs
			.filter((l) => {
				const matchMessage = l.message
					.toLowerCase()
					.includes(windowsFilters.message.toLowerCase());
				const matchDate = windowsFilters.date
					? l.date === windowsFilters.date
					: true;
				const matchCriticality =
					windowsFilters.criticality !== "all"
						? l.criticality === windowsFilters.criticality
						: true;
				const matchProvider = windowsFilters.provider
					? l.provider
							.toLowerCase()
							.includes(windowsFilters.provider.toLowerCase())
					: true;
				return matchMessage && matchDate && matchCriticality && matchProvider;
			})
			.sort((a, b) =>
				`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
			);
	}, [windowsLogs, windowsFilters]);

	const columns = useMemo(() => getMapper("windows-event").columns ?? [], []);

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
							{progress.isLoading
								? `Carregando… ${progress.percentComplete}% (${progress.loadedFiles}/${progress.totalFiles} arquivos)`
								: `${filteredLogs.length} de ${windowsLogs.length} eventos`}
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
							onChange={handleChange}
						/>
						<button onClick={openPicker} style={btnPrimary}>
							+ Carregar Logs
						</button>
						<button onClick={reload} style={btnSecondary}>
							↺ Recarregar
						</button>
					</div>
				</div>

				{progress.isLoading && (
					<ProgressBar percent={progress.percentComplete} />
				)}

				{/* Filtros inline — específicos desta página */}
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
						value={windowsFilters.message}
						onChange={(e) => onWindowsFilterUpdate("message", e.target.value)}
						style={inputStyle}
					/>
					<input
						type="date"
						value={windowsFilters.date}
						onChange={(e) => onWindowsFilterUpdate("date", e.target.value)}
						style={inputStyle}
					/>
					<select
						value={windowsFilters.criticality}
						onChange={(e) =>
							onWindowsFilterUpdate("criticality", e.target.value)
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
						value={windowsFilters.provider}
						onChange={(e) => onWindowsFilterUpdate("provider", e.target.value)}
						style={inputStyle}
					/>
					<button
						onClick={onWindowsFilterReset}
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

				{progress.error && <ErrorState message={progress.error} />}
				{!progress.error && (
					<LogTable logs={filteredLogs} columns={columns} isMobile={isMobile} />
				)}
			</main>
		</div>
	);
}

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
