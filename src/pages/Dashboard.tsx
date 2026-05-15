// src/pages/Dashboard.tsx
import { useState, useRef, useCallback } from "react";
import { useLogs } from "../hooks/useLogs";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { Sidebar } from "../components/Sidebar";
import { ThemeToggleButton } from "../components/ThemeButton";
import { LoadingState } from "../components/Loading";
import { ErrorState } from "../components/Error";
import { KpiCard } from "../components/charts/KpyCard";
import { DailyBarChart } from "../components/charts/DailyBarChart";
import { StatusDonutChart } from "../components/charts/StatusDonutCard";
import { useWindowSize } from "../hooks/useWindowSize";
import type { Page } from "../App";

interface DashboardProps {
	onNavigate: (page: Page) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [logFiles, setLogFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { logs, isLoading, error } = useLogs(logFiles);

	// Hook dedicado para métricas do dashboard — separado do hook de filtros
	const metrics = useDashboardStats(logs);

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

	// stats no formato que a Sidebar espera
	const sidebarStats = {
		total: metrics.total,
		started: metrics.started,
		finished: metrics.finished,
		erro: metrics.erro,
	};

	return (
		<div
			style={{
				display: "flex",
				minHeight: "100vh",
				backgroundColor: "var(--background)",
			}}
		>
			<Sidebar
				stats={sidebarStats}
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				isMobile={isMobile}
				currentPage="dashboard" // ← fixo nessa página
				onNavigate={onNavigate} // ← vem das props
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px 36px",
					overflow: "auto",
					minWidth: 0,
				}}
			>
				{/* ── Header ── */}
				<div
					style={{
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "space-between",
						marginBottom: 28,
						gap: 12,
						flexWrap: "wrap",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						{isMobile && (
							<button
								onClick={() => setSidebarOpen(true)}
								style={{
									width: 36,
									height: 36,
									borderRadius: 6,
									border: "1px solid var(--border)",
									backgroundColor: "var(--card)",
									cursor: "pointer",
									fontSize: 18,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "var(--foreground)",
									flexShrink: 0,
								}}
							>
								☰
							</button>
						)}
						<div>
							<h1
								style={{
									margin: 0,
									fontSize: isMobile ? 18 : 22,
									fontWeight: 800,
									color: "var(--foreground)",
									letterSpacing: "-0.04em",
								}}
							>
								Dashboard
							</h1>
							<p
								style={{
									margin: "4px 0 0",
									fontSize: 13,
									color: "var(--muted-foreground)",
								}}
							>
								<strong style={{ color: "var(--foreground)" }}>
									{metrics.total}
								</strong>{" "}
								logs carregados
							</p>
						</div>
					</div>

					<div
						style={{
							display: "flex",
							gap: 8,
							alignItems: "center",
							flexWrap: "wrap",
						}}
					>
						<button
							onClick={() => fileInputRef.current?.click()}
							style={{
								padding: "8px 14px",
								borderRadius: 6,
								border: "1px solid var(--primary)",
								backgroundColor:
									"color-mix(in oklch, var(--primary) 8%, transparent)",
								color: "var(--primary)",
								fontSize: 12,
								fontWeight: 600,
								cursor: "pointer",
								fontFamily: "inherit",
								whiteSpace: "nowrap",
								display: "flex",
								alignItems: "center",
								gap: 6,
							}}
							onMouseEnter={(e) =>
								(e.currentTarget.style.backgroundColor =
									"color-mix(in oklch, var(--primary) 15%, transparent)")
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.backgroundColor =
									"color-mix(in oklch, var(--primary) 8%, transparent)")
							}
						>
							📂 Carregar JSON
						</button>
						{logFiles.length > 0 && (
							<button
								onClick={() => setLogFiles([])}
								style={{
									padding: "8px 10px",
									borderRadius: 6,
									border: "1px solid var(--border)",
									backgroundColor: "transparent",
									color: "var(--muted-foreground)",
									fontSize: 11,
									cursor: "pointer",
									fontFamily: "inherit",
								}}
							>
								✕ Mock
							</button>
						)}
					</div>
				</div>

				{/* ── Conteúdo ── */}
				{isLoading ? (
					<LoadingState />
				) : error ? (
					<ErrorState message={error} />
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
						{/* KPI Cards */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile
									? "repeat(2, 1fr)"
									: "repeat(4, 1fr)",
								gap: 12,
							}}
						>
							<KpiCard
								label="Total"
								value={metrics.total}
								accentColor="var(--foreground)"
							/>
							<KpiCard
								label="Iniciados"
								value={metrics.started}
								accentColor="var(--primary)"
							/>
							<KpiCard
								label="Finalizados"
								value={metrics.finished}
								accentColor="var(--chart-4)"
							/>
							<KpiCard
								label="Erros"
								value={metrics.erro}
								accentColor="var(--destructive)"
								subtitle={`${metrics.errorRate}% do total`}
							/>
						</div>

						{/* Gráficos principais */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr" : "1fr 340px",
								gap: 16,
								alignItems: "start",
							}}
						>
							<DailyBarChart data={metrics.dailyStats} />
							<StatusDonutChart data={metrics.statusDistribution} />
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
