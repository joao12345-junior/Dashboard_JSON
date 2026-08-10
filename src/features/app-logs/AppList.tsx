// src/features/app-logs/AppList.tsx
import { useMemo, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { AppLogFilters } from "./components/AppLogFilters";
import { LogTable } from "../../components/LogTable";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { getMapper } from "../../lib/data/LogMapperRegistry";
import { AppLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function AppList({
	logs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
	appFilters,
	onAppFilterUpdate,
	onAppFilterReset,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const appLogs = useMemo(
		() => logs.filter((l): l is AppLog => l.logType === "app"),
		[logs],
	);

	const programasDisponiveis = useMemo(
		() =>
			Array.from(
				new Set(appLogs.map((l) => l.programa).filter((p): p is string => !!p)),
			).sort(),
		[appLogs],
	);

	const classesDisponiveis = useMemo(() => {
		const source =
			appFilters.programa === "all"
				? appLogs
				: appLogs.filter((l) => l.programa === appFilters.programa);
		return Array.from(new Set(source.map((l) => l.classe))).sort();
	}, [appLogs, appFilters.programa]);

	const filteredLogs = useMemo(() => {
		return appLogs
			.filter((log) => {
				const matchMessage = log.message
					.toLowerCase()
					.includes(appFilters.message.toLowerCase());
				const matchClasse = log.classe
					.toLowerCase()
					.includes(appFilters.classe.toLowerCase());
				const matchPrograma =
					appFilters.programa === "all"
						? true
						: log.programa === appFilters.programa;
				const matchDate = appFilters.date ? log.date === appFilters.date : true;
				const matchTipo =
					appFilters.tipo === "all" ? true : log.tipo === appFilters.tipo;
				return (
					matchMessage && matchClasse && matchPrograma && matchDate && matchTipo
				);
			})
			.sort((a, b) =>
				`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
			);
	}, [appLogs, appFilters]);

	const columns = useMemo(() => getMapper("app").columns ?? [], []);

	console.log(filteredLogs);
	console.log(columns);

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
				currentPage="app-list"
				onNavigate={onNavigate}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px",
					display: "flex",
					flexDirection: "column",
					gap: 16,
					minHeight: 0,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						flexShrink: 0,
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
							Registros — Logs Gerais
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
								: `${filteredLogs.length.toLocaleString("pt-BR")} de ${appLogs.length.toLocaleString("pt-BR")} registros`}
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
					<ProgressBar percent={progress.percentComplete} marginBottom={0} />
				)}
				{progress.error && <ErrorState message={progress.error} />}

				{!progress.error && (
					<>
						<div style={{ flexShrink: 0 }}>
							<AppLogFilters
								filters={appFilters}
								onUpdate={onAppFilterUpdate}
								onReset={onAppFilterReset}
								isMobile={isMobile}
								classesDisponiveis={classesDisponiveis}
								programasDisponiveis={programasDisponiveis}
							/>
						</div>
						<LogTable
							logs={filteredLogs}
							columns={columns}
							isMobile={isMobile}
							showStatusColumn={false}
						/>
					</>
				)}
			</main>
		</div>
	);
}
