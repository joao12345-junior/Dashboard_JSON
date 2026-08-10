// src/features/app-logs/AppDashboard.tsx
import { useState, useMemo } from "react";
import { useAppStats } from "./useAppStats";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { AppKpiCards } from "./components/AppKpiCards";
import { AppDailyBarChart } from "./components/AppDailyBarChart";
import { AppTopProgramas } from "./components/AppTopProgramas";
import { AppLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function AppDashboard({
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

	const appLogs = useMemo(
		() => logs.filter((l): l is AppLog => l.logType === "app"),
		[logs],
	);

	const stats = useAppStats(appLogs);
	const isEmpty = !progress.isLoading && appLogs.length === 0;

	return (
		<div
			style={{
				display: "flex",
				height: "100vh",
				overflow: "hidden",
				backgroundColor: "var(--background)",
			}}
		>
			<Sidebar
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				isMobile={isMobile}
				currentPage="app-dashboard"
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
							Dashboard — Logs Gerais
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
								: `${appLogs.length.toLocaleString("pt-BR")} logs gerais`}
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
						<button onClick={() => onNavigate("app-list")} style={btnSecondary}>
							Ver Registros →
						</button>
					</div>
				</div>

				{progress.isLoading && (
					<ProgressBar percent={progress.percentComplete} />
				)}
				{progress.error && <ErrorState message={progress.error} />}

				{!progress.error && isEmpty && (
					<div
						style={{
							backgroundColor: "var(--card)",
							border: "1px solid var(--border)",
							borderRadius: 10,
							padding: "40px 24px",
							textAlign: "center",
							color: "var(--muted-foreground)",
							fontSize: 13,
						}}
					>
						Nenhum log geral registrado ainda. Assim que um programa externo
						(ex.: OptRevit) inserir dados em <code>app_logs</code>, eles
						aparecem aqui.
					</div>
				)}

				{!progress.error && !isEmpty && (
					<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
						<AppKpiCards stats={stats} isMobile={isMobile} />
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
								gap: 16,
							}}
						>
							{stats.dailyStats.length > 0 && (
								<AppDailyBarChart data={stats.dailyStats} />
							)}
							<AppTopProgramas
								programas={stats.topProgramas}
								total={stats.total}
							/>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
