// src/features/windows-event/WindowsDashboard.tsx
import { useState, useRef, useCallback } from "react";
import { useLogs } from "../../hooks/useLogs";
import { useWindowsStats } from "./useWindowsStats";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { LoadingState } from "../../components/Loading";
import { ErrorState } from "../../components/Error";
import { useWindowSize } from "../../hooks/useWindowSize";
import { KpiCard } from "../../components/charts/KpiCard";
import { WindowsEventLog } from "../../lib/types/Log";
import type { Page } from "../../App";
import { CriticalityDistribution } from "./components/CriticalityDistribution";
import { TopProviders } from "./components/TopProviders";

interface WindowsDashboardProps {
	onNavigate: (page: Page) => void;
}

export function WindowsDashboard({ onNavigate }: WindowsDashboardProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [logFiles, setLogFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { logs, isLoading, error } = useLogs(logFiles);

	const windowsLogs = logs.filter(
		(l): l is WindowsEventLog => l.logType === "windows-event",
	);
	const stats = useWindowsStats(windowsLogs);

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
							Análise de criticidade e distribuição de eventos
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
						<button
							onClick={() => onNavigate("windows-list")}
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
						{/* KPIs de criticidade */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(4, 1fr)",
								gap: 16,
							}}
						>
							<KpiCard
								label="Total"
								value={stats.total}
								accentColor="var(--primary)"
							/>
							<KpiCard
								label="Alta"
								value={stats.high}
								accentColor="var(--destructive)"
							/>
							<KpiCard
								label="Média"
								value={stats.medium}
								accentColor="var(--chart-5)"
							/>
							<KpiCard
								label="Baixa"
								value={stats.low}
								accentColor="var(--chart-4)"
							/>
						</div>

						{/* Top Providers + Top Canais lado a lado */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
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

// ── Componente local — só usado nesta página ──────────────────────────────────
// Não vai para /components porque não é genérico o suficiente para ser reutilizado
interface RankingCardProps {
	title: string;
	subtitle: string;
	items: { label: string; value: number }[];
	total: number;
	color: string;
}

function RankingCard({
	title,
	subtitle,
	items,
	total,
	color,
}: RankingCardProps) {
	return (
		<div
			style={{
				backgroundColor: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				overflow: "hidden",
			}}
		>
			<div
				style={{
					padding: "16px 20px",
					borderBottom: "1px solid var(--border)",
				}}
			>
				<div
					style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}
				>
					{title}
				</div>
				<div
					style={{
						fontSize: 11,
						color: "var(--muted-foreground)",
						marginTop: 2,
					}}
				>
					{subtitle}
				</div>
			</div>
			<div
				style={{
					padding: "12px 20px",
					display: "flex",
					flexDirection: "column",
					gap: 10,
				}}
			>
				{items.length === 0 && (
					<div
						style={{
							fontSize: 12,
							color: "var(--muted-foreground)",
							textAlign: "center",
							padding: "16px 0",
						}}
					>
						Nenhum dado disponível
					</div>
				)}
				{items.map((item) => {
					const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
					return (
						<div key={item.label}>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									marginBottom: 4,
								}}
							>
								<span
									style={{
										fontSize: 12,
										color: "var(--foreground)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										maxWidth: "70%",
									}}
								>
									{item.label || "—"}
								</span>
								<span
									style={{
										fontSize: 12,
										color: "var(--muted-foreground)",
										fontVariantNumeric: "tabular-nums",
									}}
								>
									{item.value} ({pct}%)
								</span>
							</div>
							{/* Barra de progresso proporcional */}
							<div
								style={{
									height: 4,
									backgroundColor: "var(--muted)",
									borderRadius: 9999,
								}}
							>
								<div
									style={{
										height: "100%",
										width: `${pct}%`,
										backgroundColor: color,
										borderRadius: 9999,
										transition: "width 0.4s ease",
									}}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
