// src/features/app-logs/AppList.tsx
import React, { useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { AppLogFilters } from "./components/AppLogFilters";
import { AppLogFeed } from "./components/AppLogFeed";
import type { DayTotals } from "./components/AppLogFeed";
import { ErrorState } from "../../components/Error";
import { useWindowSize } from "../../hooks/useWindowSize";
import { formatDayLabel, toLocalIsoDate } from "../../lib/dayLabel";
import { downloadCsv, toCsv } from "../../lib/exportCsv";
import { surroundingLogs } from "../../lib/surroundingLogs";
import { COLOR_BY_TIPO } from "./appTypeColors";
import { AppLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";
import { AppLogDetailsModal } from "./components/AppLogDetailsModal";
import { usePagination } from "../../hooks/usePagination";
import { MAX_PAGES, PAGE_SIZE } from "../../lib/Variables";
import { Pagination } from "../../components/Pagination";
import { getDataStatus } from "../../lib/dataStatus";

/** Pílula pequena usada nos filtros rápidos e nas opções de leitura. */
function chipStyle(active: boolean): React.CSSProperties {
	return {
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
		padding: "5px 12px",
		borderRadius: 999,
		border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
		backgroundColor: active
			? "color-mix(in oklch, var(--primary) 18%, transparent)"
			: "transparent",
		color: "var(--foreground)",
		fontSize: 12,
		fontWeight: 600,
		cursor: "pointer",
		fontFamily: "inherit",
	};
}

export function AppList({
	logs,
	progress,
	apiProgress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	appFilters,
	onAppFilterUpdate,
	onAppFilterReset,
	onAppTypeToggle,
}: SharedPageProps) {
	const { dataState, percent, error: loadError } = getDataStatus(
		progress,
		apiProgress,
		logs.length,
	);
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;

	const [selectedLog, setSelectedLog] = useState<AppLog | null>(null);

	// Opções de leitura (só afetam a apresentação, nunca os dados).
	const [groupRepeats, setGroupRepeats] = useState(false);
	const [wrapLines, setWrapLines] = useState(false);
	// "Pausar": congela a lista numa foto. Os logs novos continuam chegando
	// por trás (contador "N novos") e a lista não se mexe enquanto você lê.
	const [frozen, setFrozen] = useState<AppLog[] | null>(null);
	// No mobile os filtros ficam recolhidos (senão ocupam a tela toda e a lista some).
	const [showFilters, setShowFilters] = useState(false);

	const liveAppLogs = useMemo(
		() => logs.filter((l): l is AppLog => l.logType === "app"),
		[logs],
	);
	const appLogs = frozen ?? liveAppLogs;
	const newWhilePaused = frozen ? Math.max(0, liveAppLogs.length - frozen.length) : 0;

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

	// Mesmo termo do destaque na lista (que também ignora espaços nas pontas).
	const messageNeedle = appFilters.message.trim().toLowerCase();

	// Tudo menos o tipo: serve de base para as contagens dos chips de severidade
	// (a contagem de "Erros" reflete os OUTROS filtros, como nas facetas do Datadog).
	const withoutTipo = useMemo(
		() =>
			appLogs.filter((log) => {
				const matchMessage = log.message
					.toLowerCase()
					.includes(messageNeedle);
				const matchClasse = log.classe
					.toLowerCase()
					.includes(appFilters.classe.toLowerCase());
				const matchPrograma =
					appFilters.programa === "all"
						? true
						: log.programa === appFilters.programa;
				const matchDate = appFilters.date ? log.date === appFilters.date : true;
				return matchMessage && matchClasse && matchPrograma && matchDate;
			}),
		[appLogs, appFilters, messageNeedle],
	);

	const tipoCounts = useMemo(() => {
		const counts: Record<AppLog["tipo"], number> = {
			erro: 0,
			aviso: 0,
			info: 0,
			debug: 0,
		};
		for (const log of withoutTipo) counts[log.tipo] += 1;
		return counts;
	}, [withoutTipo]);

	const filteredLogs = useMemo(() => {
		return withoutTipo
			.filter(
				(log) =>
					appFilters.tipo.length === 0 || appFilters.tipo.includes(log.tipo),
			)
			.sort((a, b) =>
				`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
			);
	}, [withoutTipo, appFilters.tipo]);

	// Totais por dia sobre TODOS os registros filtrados (a página mostra só PAGE_SIZE).
	const dayTotals = useMemo(() => {
		const totals = new Map<string, DayTotals>();
		for (const log of filteredLogs) {
			const t = totals.get(log.date) ?? { total: 0, erros: 0, avisos: 0 };
			t.total += 1;
			if (log.tipo === "erro") t.erros += 1;
			else if (log.tipo === "aviso") t.avisos += 1;
			totals.set(log.date, t);
		}
		return totals;
	}, [filteredLogs]);

	// Contexto do log aberto no modal (ignora filtros: é o que aconteceu em volta).
	const surrounding = useMemo(
		() => (selectedLog ? surroundingLogs(appLogs, selectedLog) : []),
		[appLogs, selectedLog],
	);

	// Navegação ← → no modal: segue a lista filtrada inteira (não só a página).
	// findIndex em ~6 mil itens só roda quando o log aberto ou os filtros mudam.
	const selectedIndex = useMemo(
		() =>
			selectedLog ? filteredLogs.findIndex((l) => l.id === selectedLog.id) : -1,
		[filteredLogs, selectedLog],
	);

	// Filtros do painel que estão ligados (o dia e a severidade têm chips próprios).
	const activePanelFilters =
		(appFilters.message.trim() ? 1 : 0) +
		(appFilters.programa !== "all" ? 1 : 0) +
		(appFilters.classe.trim() ? 1 : 0);

	const today = new Date();
	const todayIso = toLocalIsoDate(today);
	const yesterdayDate = new Date(today);
	yesterdayDate.setDate(today.getDate() - 1);
	const yesterdayIso = toLocalIsoDate(yesterdayDate);

	const { pageItems, currentPage, totalPages, totalConsidered, setPage } =
		usePagination(filteredLogs, PAGE_SIZE, MAX_PAGES, appFilters);

	/** Exporta TUDO que passa pelos filtros (não só a página atual). */
	function handleExportCsv() {
		const rows = filteredLogs.map((log) => [
			log.date,
			log.time,
			log.tipo,
			log.programa ?? "",
			log.classe,
			log.message,
			log.detalhes ?? "",
		]);
		const csv = toCsv(
			["data", "hora", "tipo", "programa", "classe", "mensagem", "detalhes"],
			rows,
		);
		downloadCsv(`logs-gerais-${toLocalIsoDate(new Date())}.csv`, csv);
	}

	const TIPOS: Array<{ key: AppLog["tipo"]; label: string }> = [
		{ key: "erro", label: "Erros" },
		{ key: "aviso", label: "Avisos" },
		{ key: "info", label: "Info" },
		{ key: "debug", label: "Debug" },
	];

	return (
		<div
			style={{
				display: "flex",
				// flex: 1 + minWidth: 0: a página é filha de um container flex (App.tsx).
				// Sem isso ela encolhe até a largura do conteúdo, e com filtro aplicado
				// (mensagens curtas) a tela inteira ficava estreita.
				flex: 1,
				minWidth: 0,
				height: "100vh",
				overflow: "hidden",
				backgroundColor: "var(--background)",
			}}
		>
			<main
				style={{
					flex: 1,
					// No mobile o botão de menu (Sidebar, fixo em top:16/left:16, 40px) cobriria o título.
					padding: isMobile ? "64px 16px 16px" : "32px",
					display: "flex",
					flexDirection: "column",
					gap: 16,
					minHeight: 0,
					// No mobile a página inteira rola (o feed tem altura mínima própria).
					overflowY: isMobile ? "auto" : "hidden",
					overflowX: "hidden",
				}}
			>
				<PageHeader
					title="Registros — Logs Gerais"
					subtitle={
						dataState === "loading"
							? `Carregando… ${percent}%`
							: filteredLogs.length > totalConsidered
								? `Mostrando os ${totalConsidered.toLocaleString("pt-BR")} mais recentes de ${filteredLogs.length.toLocaleString("pt-BR")} encontrados`
								: `${totalConsidered.toLocaleString("pt-BR")} de ${appLogs.length.toLocaleString("pt-BR")} registros`
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

				{!progress.error && (
					<>
						<div
							style={{
								display: "flex",
								gap: 8,
								flexWrap: "wrap",
								alignItems: "center",
								flexShrink: 0,
							}}
						>
							{[
								{ label: "Todos os dias", value: "" },
								{ label: "Hoje", value: todayIso },
								{ label: "Ontem", value: yesterdayIso },
							].map((chip) => {
								const active = appFilters.date === chip.value;
								return (
									<button
										key={chip.label}
										type="button"
										className="ld-chip"
										title={chip.value ? formatDayLabel(chip.value, today) : undefined}
										aria-pressed={active}
										onClick={() => onAppFilterUpdate("date", chip.value)}
										style={active ? btnPrimary : btnSecondary}
									>
										{chip.label}
									</button>
								);
							})}
							<span
								aria-hidden
								style={{ width: 1, height: 20, backgroundColor: "var(--border)" }}
							/>
							{/* Severidade com contagem — clique para filtrar (várias podem ficar ativas) */}
							{TIPOS.map(({ key, label }) => {
								const active = appFilters.tipo.includes(key);
								return (
									<button
										key={key}
										type="button"
										className="ld-chip"
										aria-pressed={active}
										title={`Filtrar por ${label.toLowerCase()}`}
										onClick={() => onAppTypeToggle(key)}
										style={{
											...chipStyle(active),
											borderColor: active ? COLOR_BY_TIPO[key] : "var(--border)",
										}}
									>
										<span
											aria-hidden
											style={{
												width: 8,
												height: 8,
												borderRadius: "50%",
												backgroundColor: COLOR_BY_TIPO[key],
											}}
										/>
										{label}
										<strong>{tipoCounts[key].toLocaleString("pt-BR")}</strong>
									</button>
								);
							})}
							<span style={{ flex: 1 }} />
							{isMobile && (
								<button
									type="button"
									className="ld-chip"
									aria-expanded={showFilters}
									onClick={() => setShowFilters((v) => !v)}
									style={chipStyle(showFilters || activePanelFilters > 0)}
								>
									Filtros{activePanelFilters > 0 ? ` (${activePanelFilters})` : ""}{" "}
									{showFilters ? "▴" : "▾"}
								</button>
							)}
							{/* Opções de leitura */}
							<button
								type="button"
								className="ld-chip"
								aria-pressed={groupRepeats}
								title="Junta registros parecidos que aparecem em sequência (ignora números)"
								onClick={() => setGroupRepeats((v) => !v)}
								style={chipStyle(groupRepeats)}
							>
								{groupRepeats ? "✓ " : ""}
								Agrupar repetidos
							</button>
							<button
								type="button"
								className="ld-chip"
								aria-pressed={wrapLines}
								title="Mostra a mensagem inteira em várias linhas"
								onClick={() => setWrapLines((v) => !v)}
								style={chipStyle(wrapLines)}
							>
								{wrapLines ? "✓ " : ""}
								Quebrar linhas
							</button>
							<button
								type="button"
								className="ld-chip"
								aria-pressed={frozen !== null}
								title={
									frozen
										? "Voltar a acompanhar os logs ao vivo"
										: "Congela a lista para você ler sem ela se mexer"
								}
								onClick={() => setFrozen(frozen ? null : liveAppLogs)}
								style={chipStyle(frozen !== null)}
							>
								{frozen
									? `▶ Retomar${newWhilePaused > 0 ? ` (${newWhilePaused.toLocaleString("pt-BR")} novos)` : ""}`
									: "⏸ Pausar"}
							</button>
							<button
								type="button"
								className="ld-chip"
								title="Baixa todos os registros que passam pelos filtros (CSV)"
								onClick={handleExportCsv}
								style={chipStyle(false)}
							>
								Exportar CSV
							</button>
						</div>
						{(!isMobile || showFilters) && (
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
						)}
						<AppLogFeed
							logs={pageItems}
							dayTotals={dayTotals}
							isMobile={isMobile}
							onSelect={setSelectedLog}
							selectedId={selectedLog?.id ?? null}
							resetScrollKey={`${currentPage}|${JSON.stringify(appFilters)}`}
							groupRepeats={groupRepeats}
							wrapLines={wrapLines}
							highlight={appFilters.message}
							onFilterPrograma={(programa) =>
								onAppFilterUpdate("programa", programa)
							}
							onFilterClasse={(classe) => onAppFilterUpdate("classe", classe)}
							onClearFilters={onAppFilterReset}
							loading={dataState === "loading"}
						/>
						<Pagination
							currentPage={currentPage}
							totalPages={totalPages}
							onPageChange={setPage}
						/>
						<AppLogDetailsModal
							log={selectedLog}
							onClose={() => setSelectedLog(null)}
							surrounding={surrounding}
							onSelectSurrounding={setSelectedLog}
							position={
								selectedIndex >= 0
									? { index: selectedIndex, total: filteredLogs.length }
									: undefined
							}
							onPrev={
								selectedIndex > 0
									? () => setSelectedLog(filteredLogs[selectedIndex - 1])
									: undefined
							}
							onNext={
								selectedIndex >= 0 && selectedIndex < filteredLogs.length - 1
									? () => setSelectedLog(filteredLogs[selectedIndex + 1])
									: undefined
							}
						/>
					</>
				)}
			</main>
		</div>
	);
}
