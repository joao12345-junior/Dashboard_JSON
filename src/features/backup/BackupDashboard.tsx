// src/features/backup/BackupDashboard.tsx
import { useMemo } from "react";
import { useProcessStats } from "./useProcessStats";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/Error";
import { useWindowSize } from "../../hooks/useWindowSize";
import { ProcessKpiCards } from "./components/ProcessKpiCards";
import { DailyBarChart } from "../../components/charts/DailyBarChart";
import { ProcessLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function ProcessDashboard({
	logs,
	progress,
	apiProgress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const processLogs = useMemo(
		() => logs.filter((l): l is ProcessLog => l.logType === "process"),
		[logs],
	);

	const stats = useProcessStats(processLogs);

	return (
		<main
			style={{
				flex: 1,
				padding: isMobile ? "16px" : "32px",
				overflowY: "auto",
			}}
		>
			<PageHeader
				title="Dashboard — Logs de Backup"
				subtitle={
					progress.isLoading
						? `Carregando… ${progress.percentComplete}% (${progress.loadedFiles}/${progress.totalFiles} arquivos)`
						: `${processLogs.length.toLocaleString("pt-BR")} logs de backup`
				}
				spacing="dense"
				staticProgress={progress}
				apiProgress={apiProgress}
			>
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
			</PageHeader>

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
	);
}
