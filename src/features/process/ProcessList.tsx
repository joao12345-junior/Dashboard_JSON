// src/features/process/ProcessList.tsx
import { useState, useRef, useCallback, useMemo } from "react";
import { useLogs } from "../../hooks/useLogs";
import { useLogFilters } from "../../hooks/useLogsFilters";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { LogFilters } from "../../components/LogFilter";
import { LogTable } from "../../components/LogTable";
import { LoadingState } from "../../components/Loading";
import { ErrorState } from "../../components/Error";
import { useWindowSize } from "../../hooks/useWindowSize";
import { getMapper } from "../../lib/data/LogMapperRegistry";
import { ProcessLog } from "../../lib/types/Log";
import type { Page } from "../../App";

interface ProcessListProps {
	onNavigate: (page: Page) => void;
}

export function ProcessList({ onNavigate }: ProcessListProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [logFiles, setLogFiles] = useState<File[]>([]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { logs, isLoading, error } = useLogs(logFiles);

	// Filtra apenas ProcessLog para esta página
	const processLogs = useMemo(
		() => logs.filter((l): l is ProcessLog => l.logType === "process"),
		[logs],
	);

	const { filters, filteredLogs, stats, updateFilter, resetFilters } =
		useLogFilters(processLogs);

	const columns = useMemo(() => {
		if (processLogs.length === 0) return [];
		return getMapper("process").columns ?? [];
	}, [processLogs]);

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
				currentPage="process-list"
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
							Registros — Logs de Processo
						</h1>
						<p
							style={{
								fontSize: 13,
								color: "var(--muted-foreground)",
								margin: "4px 0 0",
							}}
						>
							{filteredLogs.length} registros encontrados
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

				{isLoading && <LoadingState />}
				{error && <ErrorState message={error} />}

				{!isLoading && !error && (
					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						<LogFilters
							filters={filters}
							onUpdate={updateFilter}
							onReset={resetFilters}
							isMobile={isMobile} // ← adiciona isso
							// stats={stats}      ← remove isso
						/>
						<LogTable
							logs={filteredLogs}
							columns={columns}
							isMobile={isMobile}
						/>
					</div>
				)}
			</main>
		</div>
	);
}
