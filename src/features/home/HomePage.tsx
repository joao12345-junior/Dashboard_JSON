// src/features/home/HomePage.tsx
import { useHomeStats } from "./usehomeStats";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { CriticalEventsFeed } from "./components/CriticalEventsFeed";
import { GlobalKpiRow } from "./components/GlobalKpiRow";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function HomePage({
	logs,
	staticLogs,
	manualLogs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const stats = useHomeStats(logs);

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
					padding: isMobile ? "16px" : "24px 32px",
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
						progress.isLoading
							? `Carregando… ${progress.percentComplete}%`
							: `${staticLogs.length.toLocaleString("pt-BR")} do servidor · ${manualLogs.length.toLocaleString("pt-BR")} manuais`
					}
					spacing="compact"
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

				{progress.isLoading && (
					<ProgressBar percent={progress.percentComplete} />
				)}
				{progress.error && <ErrorState message={progress.error} />}

				{!progress.error && (
					<>
						{/* KPIs */}
						<GlobalKpiRow
							totalErrors={stats.totalErrors}
							totalWarnings={stats.totalWarnings}
							totalLogs={stats.totalLogs}
							byType={stats.byType}
							onNavigate={onNavigate}
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
							}}
						>
							{/* Feed 1 — Críticos */}
							<CriticalEventsFeed
								events={stats.criticalEvents}
								title="Eventos Críticos"
								subtitle="Alta criticidade — ação imediata"
								accentColor="var(--destructive)"
								tableHeight={380}
								onNavigate={onNavigate}
							/>

							{/* Feed 2 — Avisos (Médio-Críticos)
								showSourceFilter=true exibe os botões Todos / Backup / Windows
							*/}
							<CriticalEventsFeed
								events={stats.mediumCriticalEvents}
								title="Avisos"
								subtitle="Criticidade média — requer atenção"
								accentColor="var(--chart-5)"
								tableHeight={380}
								showSourceFilter={true}
								onNavigate={onNavigate}
							/>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
