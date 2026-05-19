// src/features/windows-event/WindowsDashboard.tsx
import { useState, useMemo } from "react";
import { useWindowsStats } from "./useWindowsStats";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { KpiCard } from "../../components/charts/KpiCard";
import { WindowsEventLog } from "../../lib/types/Log";
import { CriticalityDistribution } from "./components/CriticalityDistribution";
import { TopProviders } from "./components/TopProviders";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function WindowsDashboard({
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

	const windowsLogs = useMemo(
		() =>
			logs.filter((l): l is WindowsEventLog => l.logType === "windows-event"),
		[logs],
	);

	const stats = useWindowsStats(windowsLogs);

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
				currentPage="windows-dashboard"
				onNavigate={onNavigate}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px",
					overflowY: "auto",
				}}
			>
				{/* Cabeçalho */}
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
							Dashboard — Windows Event Log
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
								: `${windowsLogs.length.toLocaleString("pt-BR")} eventos carregados`}
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
							onClick={() => onNavigate("windows-list")}
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
						{/* KPIs */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile
									? "repeat(2, 1fr)"
									: "repeat(4, 1fr)",
								gap: 16,
							}}
						>
							<KpiCard
								label="Total"
								value={stats.total.toLocaleString("pt-BR")}
								accentColor="var(--primary)"
							/>
							<KpiCard
								label="Alta Criticidade"
								value={stats.high.toLocaleString("pt-BR")}
								accentColor="var(--destructive)"
								subtitle={
									stats.total > 0
										? `${Math.round((stats.high / stats.total) * 100)}% do total`
										: undefined
								}
							/>
							<KpiCard
								label="Média Criticidade"
								value={stats.medium.toLocaleString("pt-BR")}
								accentColor="var(--chart-5)"
								subtitle={
									stats.total > 0
										? `${Math.round((stats.medium / stats.total) * 100)}% do total`
										: undefined
								}
							/>
							<KpiCard
								label="Baixa Criticidade"
								value={stats.low.toLocaleString("pt-BR")}
								accentColor="var(--chart-4)"
								subtitle={
									stats.total > 0
										? `${Math.round((stats.low / stats.total) * 100)}% do total`
										: undefined
								}
							/>
						</div>

						{/*
							Layout: gráfico de barras ocupa 2/3 da largura,
							TopProviders ocupa 1/3.
							O donut anterior era 1/2 + 1/2 — proporção errada para
							um gráfico de barras que precisa de espaço horizontal.
						*/}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
								gap: 16,
							}}
						>
							<CriticalityDistribution stats={stats} />
							<TopProviders
								providers={stats.topProviders}
								total={stats.total}
							/>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
