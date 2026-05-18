// src/features/home/HomePage.tsx
import { useState, useRef, useCallback } from "react";
import { useLogs } from "../../hooks/useLogs";
import { useHomeStats } from "./usehomeStats";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { LoadingState } from "../../components/Loading";
import { ErrorState } from "../../components/Error";
import { useWindowSize } from "../../hooks/useWindowSize";
import { CriticalEventsFeed } from "./components/CriticalEventsFeed";
import { GlobalKpiRow } from "./components/GlobalKpiRow";
import type { Page } from "../../App";

interface HomePageProps {
	onNavigate: (page: Page) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [logFiles, setLogFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { logs, isLoading, error } = useLogs(logFiles);
	const stats = useHomeStats(logs);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []).filter((f) =>
				f.name.endsWith(".json"),
			) as File[];
			if (files.length) setLogFiles((prev) => [...prev, ...files]);
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
				currentPage="home"
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
							Central de Monitoramento
						</h1>
						<p
							style={{
								fontSize: 13,
								color: "var(--muted-foreground)",
								margin: "4px 0 0",
							}}
						>
							Visão consolidada de todos os logs do servidor
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

				{/* ── Estados de loading/erro ── */}
				{isLoading && <LoadingState />}
				{error && <ErrorState message={error} />}

				{/* ── Conteúdo principal ── */}
				{!isLoading && !error && (
					<div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
						{/* KPIs globais — números que importam imediatamente */}
						<GlobalKpiRow
							totalErrors={stats.totalErrors}
							totalWarnings={stats.totalWarnings}
							totalLogs={stats.totalLogs} // ← adiciona aqui
							byType={stats.byType}
							onNavigate={onNavigate}
						/>

						{/* Feed de eventos críticos recentes */}
						<CriticalEventsFeed
							events={stats.recentCritical}
							onNavigate={onNavigate}
						/>
					</div>
				)}
			</main>
		</div>
	);
}
