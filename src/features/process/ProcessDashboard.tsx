// src/features/process/ProcessDashboard.tsx
import { useState, useMemo } from "react";
import { useProcessStats } from "./useProcessStats";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { ProcessKpiCards } from "./components/ProcessKpiCards";
import { DailyBarChart } from "../../components/charts/DailyBarChart";
import { ProcessLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function ProcessDashboard({
	logs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const processLogs = useMemo(
		() => logs.filter((l): l is ProcessLog => l.logType === "process"),
		[logs],
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
							{progress.isLoading
								? `Carregando… ${progress.percentComplete}% (${progress.loadedFiles}/${progress.totalFiles} arquivos)`
								: `${processLogs.length.toLocaleString("pt-BR")} logs de processo`}
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
						<button
							onClick={() => onNavigate("process-list")}
							style={btnSecondary}
						>
							Ver Registros →
						</button>
					</div>
				</div>

				{progress.isLoading && (
					<ProgressBar percent={progress.percentComplete} />
				)}
				{progress.error && <ErrorState message={progress.error} />}

				{!progress.error && (
					<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
						<ProcessKpiCards stats={stats} isMobile={isMobile} />
						{stats.dailyStats.length > 0 && (
							<DailyBarChart data={stats.dailyStats} />
						)}
					</div>
				)}
			</main>
		</div>
	);
}
