// src/features/app-logs/AppDashboard.tsx
import { useMemo } from "react";
import { useAppStats } from "./useAppStats";
import { PageHeader } from "../../components/PageHeader";
import { DataGate } from "../../components/DataGate";
import { useWindowSize } from "../../hooks/useWindowSize";
import { AppKpiCards } from "./components/AppKpiCards";
import { AppDailyBarChart } from "./components/AppDailyBarChart";
import { AppTopProgramas } from "./components/AppTopProgramas";
import { AppLog } from "../../lib/types/Log";
import { describeStatus, getDataStatus } from "../../lib/dataStatus";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function AppDashboard({
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

	const appLogs = useMemo(
		() => logs.filter((l): l is AppLog => l.logType === "app"),
		[logs],
	);

	const stats = useAppStats(appLogs);

	const status = getDataStatus(progress, apiProgress, appLogs.length);
	const hasData = appLogs.length > 0;

	return (
		<main
			style={{
				flex: 1,
				padding: isMobile ? "64px 16px 16px" : "32px",
				overflowY: "auto",
			}}
		>
			<PageHeader
				title="Dashboard — Logs Gerais"
				subtitle={describeStatus(
					status,
					hasData,
					`${appLogs.length.toLocaleString("pt-BR")} logs gerais`,
				)}
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
				<button onClick={() => onNavigate("app-list")} style={btnSecondary}>
					Ver Registros →
				</button>
			</PageHeader>

			<DataGate
				dataState={status.dataState}
				percent={status.percent}
				error={status.error}
				hasData={hasData}
				onRetry={reload}
				emptyMessage={
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
				}
			>
				<AppKpiCards stats={stats} isMobile={isMobile} />
				<div
					style={{
						display: "grid",
						gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
						gap: 16,
					}}
				>
					{stats.dailyStats.length > 0 && (
						<AppDailyBarChart
							data={stats.dailyStats}
							programaData={stats.dailyProgramStats}
							topProgramas={stats.topProgramas}
						/>
					)}
					<AppTopProgramas
						programas={stats.topProgramas}
						total={stats.total}
					/>
				</div>
			</DataGate>
		</main>
	);
}
