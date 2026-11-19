// src/features/home/HomePage.tsx
import { useHomeStats } from "./usehomeStats";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/Error";
import { LoadingNotice } from "../../components/LoadingNotice";
import { useWindowSize } from "../../hooks/useWindowSize";
import { CriticalEventsFeed } from "./components/CriticalEventsFeed";
import { GlobalKpiRow } from "./components/GlobalKpiRow";
import { DailyErrorsPanel } from "./components/DailyErrorsPanel";
import { useDailyErrors } from "./useDailyErrors";
import { describeLastSeen } from "../../lib/dayOverview";
import { getDataStatus } from "../../lib/dataStatus";
import type { ErrorGroup, ErrorSource } from "../../lib/errorGroups";
import type { Log } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps, TypeLog } from "../../App";

export function HomePage({
	logs,
	manualLogs,
	progress,
	apiProgress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
	onProcessFilterReset,
	onProcessFilterUpdate,
	onWindowsFilterReset,
	onWindowsFilterUpdate,
	onAppFilterReset,
	onAppFilterUpdate,
	onAppTypeToggle,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const stats = useHomeStats(logs);
	const dailyErrors = useDailyErrors(logs);

	// Enquanto os registros chegam (ou se a API falhou) os totais não são confiáveis.
	const { dataState, percent, error: loadError } = getDataStatus(
		progress,
		apiProgress,
		logs.length,
	);

	/**
	 * Abre a lista da fonte já filtrada. Reseta os filtros antes para não herdar
	 * um filtro antigo. Compartilhado pelo painel de erros (grupo) e pelos feeds
	 * (evento individual).
	 */
	function openList(target: {
		source: ErrorSource;
		date: string;
		programa?: string | null;
		classe?: string | null;
		tipo?: TypeLog;
		criticality?: "High" | "Medium" | "Low";
	}) {
		if (target.source === "app") {
			onAppFilterReset();
			onAppFilterUpdate("date", target.date);
			// "programa" limpa a classe no App.tsx, então vem antes dela.
			if (target.programa) onAppFilterUpdate("programa", target.programa);
			if (target.classe) onAppFilterUpdate("classe", target.classe);
			if (target.tipo) onAppTypeToggle(target.tipo);
			onNavigate("app-list");
		} else if (target.source === "windows-event") {
			onWindowsFilterReset();
			onWindowsFilterUpdate("date", target.date);
			if (target.criticality)
				onWindowsFilterUpdate("criticality", target.criticality);
			onNavigate("windows-list");
		} else {
			onProcessFilterReset();
			onProcessFilterUpdate("date", target.date);
			onNavigate("process-list");
		}
	}

	function handleOpenErrorGroup(group: ErrorGroup) {
		openList({
			source: group.source,
			date: group.date,
			programa: group.programa,
			classe: group.classe,
			tipo: "erro",
			criticality: "High",
		});
	}

	/** Evento individual: abre a lista no dia dele, na criticidade/tipo dele. */
	function handleOpenEvent(log: Log) {
		if (log.logType === "app") {
			openList({
				source: "app",
				date: log.date,
				programa: log.programa,
				classe: log.classe,
				tipo: log.tipo,
			});
		} else if (log.logType === "windows-event") {
			openList({
				source: "windows-event",
				date: log.date,
				criticality: log.criticality === "Unknown" ? undefined : log.criticality,
			});
		} else {
			openList({ source: "process", date: log.date });
		}
	}

	return (
		<div
			style={{
				display: "flex",
				// height: 100vh + overflow: hidden no container raiz.
				// Isso fixa a altura na viewport — o body nunca cresce além da tela.
				// Cada região com conteúdo variável precisa de overflow: auto próprio.
				height: "100vh",
				overflow: "hidden",
				backgroundColor: "var(--background)",
			}}
		>
			{/*
				A main tem overflow-y: auto.
				Ela pode scrollar se o conteúdo total (KPIs + dois feeds)
				não couber na viewport — o que pode acontecer em telas pequenas.
				Em telas grandes, os feeds têm altura fixa e a main não scrolla.
			*/}
			<main
				style={{
					flex: 1,
					// No mobile o botão de menu (Sidebar, fixo em top:16/left:16, 40px) cobriria o título.
					padding: isMobile ? "64px 16px 16px" : "24px 32px",
					overflowY: "auto",
					display: "flex",
					flexDirection: "column",
					gap: 20,
				}}
			>
				{/* Cabeçalho */}
				<PageHeader
					title="Central de Monitoramento"
					subtitle={
						dataState === "loading"
							? `Carregando… ${percent}%`
							: dataState === "error" && logs.length === 0
								? "Não foi possível carregar os registros"
								: [
									`${logs.length.toLocaleString("pt-BR")} registros carregados`,
									manualLogs.length > 0
										? `${manualLogs.length.toLocaleString("pt-BR")} manuais`
										: null,
									describeLastSeen(
										dailyErrors.overview.lastSeen.any,
										dailyErrors.todayIso,
										dailyErrors.nowTime,
									),
								]
									.filter(Boolean)
									.join(" · ")
					}
					spacing="compact"
					wrap
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
				</PageHeader>

				{loadError && <ErrorState message={loadError} onRetry={reload} />}
				{dataState === "loading" && <LoadingNotice percent={percent} />}

				{!progress.error && (
					<>
						{/* KPIs */}
						<GlobalKpiRow
							errors={dailyErrors.overview.errors}
							warnings={dailyErrors.overview.warnings}
							lastSeen={dailyErrors.overview.lastSeen}
							byType={stats.byType}
							todayIso={dailyErrors.todayIso}
							nowTime={dailyErrors.nowTime}
							loading={dataState === "loading"}
							onNavigate={onNavigate}
						/>

						{/* Principais erros de hoje e ontem (todos os tipos de log) */}
						<DailyErrorsPanel
							today={dailyErrors.today}
							yesterday={dailyErrors.yesterday}
							yesterdayUntilNow={dailyErrors.yesterdayUntilNow}
							nowTime={dailyErrors.nowTime}
							isMobile={isMobile}
							dataState={dataState}
							onOpenGroup={handleOpenErrorGroup}
						/>

						{/*
							Dois feeds lado a lado no desktop, empilhados no mobile.
							Cada feed tem altura fixa (tableHeight) — o scroll é interno.
							flex: 1 nos dois faz os feeds dividirem o espaço restante igualmente.
						*/}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
								gap: 20,
								// minHeight: 0 é essencial para que filhos com flex
								// funcionem corretamente dentro de um flex container.
								// Sem isso, o grid pode crescer além da viewport.
								minHeight: 0,
								// A main rola (overflow-y: auto); sem flexShrink 0 os feeds eram
								// espremidos no mobile em vez de empurrar a rolagem.
								flexShrink: 0,
							}}
						>
							<CriticalEventsFeed
								events={stats.criticalEvents}
								todayIso={dailyErrors.todayIso}
								isMobile={isMobile}
								dataState={dataState}
								onOpenEvent={handleOpenEvent}
								title="Eventos Críticos"
								subtitle="Alta criticidade — ação imediata"
								accentColor="var(--destructive)"
								accentTextColor="var(--destructive-text)"
							/>

							<CriticalEventsFeed
								events={stats.mediumCriticalEvents}
								todayIso={dailyErrors.todayIso}
								isMobile={isMobile}
								dataState={dataState}
								onOpenEvent={handleOpenEvent}
								title="Avisos"
								subtitle="Criticidade média — requer atenção"
								accentColor="var(--chart-4)"
								accentTextColor="var(--warning-text)"
								showSourceFilter
							/>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
