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
		/*
			Container raiz: height 100vh + overflow hidden.

			Isso fixa a altura exatamente na viewport — o body nunca cresce
			além da tela, independente do volume de dados na tabela.
			Sem isso, o LogTable cresce, a página cresce, e o scroll acontece
			no body inteiro em vez de dentro da tabela.
		*/
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
				currentPage="process-list"
				onNavigate={onNavigate}
			/>

			{/*
				A main é um flex column.
				Isso cria uma "pilha vertical" com três camadas:
				  1. Cabeçalho (flexShrink: 0 — nunca encolhe)
				  2. Filtros    (flexShrink: 0 — nunca encolhe)
				  3. LogTable   (flex: 1 — preenche TODO o espaço restante)

				O scroll acontece DENTRO do LogTable, não na main.
				A main em si não tem overflow — ela tem altura fixa pela viewport.
			*/}
			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px",
					display: "flex",
					flexDirection: "column",
					gap: 16,
					minHeight: 0, // necessário para que flex: 1 funcione corretamente
					overflow: "hidden",
				}}
			>
				{/* Cabeçalho — altura fixa, não encolhe */}
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
								? `Carregando… ${progress.percentComplete}% (${progress.loadedFiles}/${progress.totalFiles} arquivos)`
								: `${filteredLogs.length.toLocaleString("pt-BR")} de ${processLogs.length.toLocaleString("pt-BR")} registros`}
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
						{/* Filtros — altura fixa, não encolhe */}
						<div style={{ flexShrink: 0 }}>
							<LogFilters
								filters={processFilters}
								onUpdate={onProcessFilterUpdate}
								onReset={onProcessFilterReset}
								isMobile={isMobile}
							/>
						</div>

						{/*
							LogTable sem maxBodyHeight → usa flex: 1 internamente.
							Ele preenche todo o espaço que sobrou depois do cabeçalho
							e dos filtros. O scroll é interno — a página não scrolla.
						*/}
						<LogTable
							logs={filteredLogs}
							columns={columns}
							isMobile={isMobile}
						/>
					</>
				)}
			</main>
		</div>
	);
}
