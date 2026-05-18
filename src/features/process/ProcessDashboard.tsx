// src/features/process/ProcessDashboard.tsx
import { useState, useRef, useCallback } from "react";
import { useLogs } from "../../hooks/useLogs";
import { useProcessStats } from "./useProcessStats";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { LoadingState } from "../../components/Loading";
import { ErrorState } from "../../components/Error";
import { useWindowSize } from "../../hooks/useWindowSize";
import { ProcessKpiCards } from "./components/ProcessKpiCards";
import { DailyBarChart } from "../../components/charts/DailyBarChart";
import { ProcessLog } from "../../lib/types/Log";
import type { Page } from "../../App";
import { useFileUpload } from "../../hooks/useFileUpload";

interface ProcessDashboardProps {
	onNavigate: (page: Page) => void;
}

export function ProcessDashboard({ onNavigate }: ProcessDashboardProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const {
		files: logFiles,
		inputRef: fileInputRef,
		handleChange,
		openPicker,
	} = useFileUpload();

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const { logs, isLoading, error } = useLogs(logFiles);

	// Filtra apenas ProcessLog antes de passar para o hook de métricas
	// O type predicate garante que processLogs é ProcessLog[] tipado
	const processLogs = logs.filter(
		(l): l is ProcessLog => l.logType === "process",
	);
	const stats = useProcessStats(processLogs);

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
				currentPage="process-dashboard"
				onNavigate={onNavigate}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px",
					overflowY: "auto",
				}}
			>
				{/* ── Header ── */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: 32,
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
							Dashboard — Logs de Processo
						</h1>
						<p
							style={{
								fontSize: 13,
								color: "var(--muted-foreground)",
								margin: "4px 0 0",
							}}
						>
							Métricas de backups e rotinas internas
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
						<button
							onClick={openPicker}
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
						<button
							onClick={() => onNavigate("process-list")}
							style={{
								padding: "8px 16px",
								borderRadius: 8,
								border: "1px solid var(--border)",
								backgroundColor: "transparent",
								color: "var(--foreground)",
								fontSize: 13,
								fontWeight: 600,
								cursor: "pointer",
							}}
						>
							Ver Registros →
						</button>
					</div>
				</div>

				{isLoading && <LoadingState />}
				{error && <ErrorState message={error} />}

				{!isLoading && !error && (
					<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
						{/* KPIs */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(4, 1fr)",
								gap: 16,
							}}
						>
							<ProcessKpiCards stats={stats} isMobile={isMobile} />
						</div>

						{/* Gráfico de histórico diário */}
						{stats.dailyStats.length > 0 && (
							<DailyBarChart data={stats.dailyStats} />
						)}
					</div>
				)}
			</main>
		</div>
	);
}
