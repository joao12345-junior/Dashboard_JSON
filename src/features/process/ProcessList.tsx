// src/features/process/ProcessList.tsx
import { useMemo, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { LogFilters } from "../../components/LogFilter";
import { LogTable } from "../../components/LogTable";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { getMapper } from "../../lib/data/LogMapperRegistry";
import { ProcessLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import { START_STATUS } from "../../lib/Variables";
import type { SharedPageProps } from "../../App";

export function ProcessList({
	logs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
	processFilters,
	onProcessFilterUpdate,
	onProcessFilterReset,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const processLogs = useMemo(
		() => logs.filter((l): l is ProcessLog => l.logType === "process"),
		[logs],
	);

	/**
	 * Filtros vêm do App agora — não são estado local.
	 * Isso garante que ao voltar para esta página, o operador
	 * encontra exatamente o que deixou.
	 */
	const filteredLogs = useMemo(() => {
		return processLogs
			.filter((log) => {
				const matchMessage = log.message
					.toLowerCase()
					.includes(processFilters.message.toLowerCase());
				const matchDate = processFilters.date
					? log.date === processFilters.date
					: true;
				const matchStart =
					processFilters.start === START_STATUS.ALL
						? true
						: processFilters.start === START_STATUS.STARTED
							? log.status === 1
							: processFilters.start === START_STATUS.FINISHED
								? log.status === 0
								: processFilters.start === START_STATUS.ERRO
									? log.status === 2
									: true;
				return matchMessage && matchDate && matchStart;
			})
			.sort((a, b) =>
				`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
			);
	}, [processLogs, processFilters]);

	const columns = useMemo(() => getMapper("process").columns ?? [], []);

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
							{progress.isLoading
								? `Carregando… ${progress.percentComplete}%`
								: `${filteredLogs.length} de ${processLogs.length} registros`}
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
				{progress.error && <ErrorState message={progress.error} />}

				{!progress.error && (
					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						<LogFilters
							filters={processFilters}
							onUpdate={onProcessFilterUpdate}
							onReset={onProcessFilterReset}
							isMobile={isMobile}
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
