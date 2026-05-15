import { useState, useRef, useCallback } from "react";
import { useLogs } from "../hooks/useLogs";
import { useLogFilters } from "../hooks/useLogsFilters";
import { Sidebar } from "../components/Sidebar";
import { ThemeToggleButton } from "../components/ThemeButton";
import { LogFilters } from "../components/LogFilter";
import { LogTable } from "../components/LogTable";
import { StatCard } from "../components/StatCard";
import { LoadingState } from "../components/Loading";
import { ErrorState } from "../components/Error";
import { useWindowSize } from "../hooks/useWindowSize";

export function Dashboard() {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [logFiles, setLogFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { logs, isLoading, error } = useLogs(logFiles);
	const { filters, filteredLogs, stats, updateFilter, resetFilters } =
		useLogFilters(logs);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []).filter((file) =>
				file.name.endsWith(".json"),
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
				stats={stats}
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				isMobile={isMobile}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px 36px",
					overflow: "auto",
					minWidth: 0,
				}}
			>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "space-between",
						marginBottom: 24,
						gap: 12,
						flexWrap: "wrap",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
						{/* Botão hamburguer em mobile */}
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
								Log Viewer
							</h1>
							<p
								style={{
									margin: "4px 0 0",
									fontSize: 13,
									color: "var(--muted-foreground)",
								}}
							>
								<strong style={{ color: "var(--foreground)" }}>
									{filteredLogs.length}
								</strong>{" "}
								de{" "}
								<strong style={{ color: "var(--foreground)" }}>
									{stats.total}
								</strong>{" "}
								registros
							</p>
						</div>
					</div>

					{/* Botão carregar arquivo + toggle dark mode (desktop) */}
					<div
						style={{
							display: "flex",
							gap: 8,
							alignItems: "center",
							flexWrap: "wrap",
						}}
					>
						{isMobile && <ThemeToggleButton />}
						{/* Input de arquivo escondido — acionado pelo botão abaixo */}
						<input
							ref={fileInputRef}
							type="file"
							multiple
							{...({
								webkitdirectory: "true",
							} as React.InputHTMLAttributes<HTMLInputElement>)}
							onChange={handleFileChange}
							style={{ display: "none" }}
						/>
						<button
							onClick={() => fileInputRef.current?.click()}
							style={{
								padding: "8px 14px",
								borderRadius: 6,
								border: "1px solid var(--primary)",
								backgroundColor: `color-mix(in oklch, var(--primary) 8%, transparent)`,
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
								(e.currentTarget.style.backgroundColor = `color-mix(in oklch, var(--primary) 15%, transparent)`)
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.backgroundColor = `color-mix(in oklch, var(--primary) 8%, transparent)`)
							}
						>
							📂 {"Carregar JSON"}
						</button>
						{logFiles.length !== 0 && (
							<button
								onClick={() => setLogFiles([])}
								title="Voltar para dados de exemplo"
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

				{isLoading ? (
					<LoadingState />
				) : error ? (
					<ErrorState message={error} />
				) : (
					<>
						{/* Stat cards — 1 coluna em mobile, 3 em desktop */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
								gap: 12,
								marginBottom: 24,
							}}
						>
							<StatCard
								label="Iniciados"
								value={stats.started}
								accentColor="var(--primary)"
							/>
							<StatCard
								label="Finalizados"
								value={stats.finished}
								accentColor="var(--chart-4)"
							/>
							<StatCard
								label="Erros"
								value={stats.erro}
								accentColor="var(--destructive)"
							/>
						</div>

						<LogFilters
							filters={filters}
							onUpdate={updateFilter}
							onReset={resetFilters}
							isMobile={isMobile}
						/>
						<LogTable logs={filteredLogs} isMobile={isMobile} />
					</>
				)}
			</main>
		</div>
	);
}
