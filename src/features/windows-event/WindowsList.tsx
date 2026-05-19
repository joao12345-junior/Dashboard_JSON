// src/features/windows-event/WindowsList.tsx
import { useState, useMemo } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { LogTable } from "../../components/LogTable";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { getMapper } from "../../lib/data/LogMapperRegistry";
import { WindowsEventLog } from "../../lib/types/Log";
import { inputStyle } from "../../lib/styles/inputStyles";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";

export function WindowsList({
	logs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
	windowsFilters,
	onWindowsFilterUpdate,
	onWindowsFilterReset,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const windowsLogs = useMemo(
		() =>
			logs.filter((l): l is WindowsEventLog => l.logType === "windows-event"),
		[logs],
	);

	const filteredLogs = useMemo(() => {
		return windowsLogs
			.filter((l) => {
				const matchMessage = l.message
					.toLowerCase()
					.includes(windowsFilters.message.toLowerCase());
				const matchDate = windowsFilters.date
					? l.date === windowsFilters.date
					: true;
				const matchCriticality =
					windowsFilters.criticality !== "all"
						? l.criticality === windowsFilters.criticality
						: true;
				const matchProvider = windowsFilters.provider
					? l.provider
							.toLowerCase()
							.includes(windowsFilters.provider.toLowerCase())
					: true;
				const matchLevelLabel = windowsFilters.levelLabel
					? l.levelLabel
							.toLowerCase()
							.includes(windowsFilters.levelLabel.toLowerCase())
					: true;
				return (
					matchMessage &&
					matchDate &&
					matchCriticality &&
					matchProvider &&
					matchLevelLabel
				);
			})
			.sort((a, b) =>
				`${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
			);
	}, [windowsLogs, windowsFilters]);

	const columns = useMemo(() => getMapper("windows-event").columns ?? [], []);

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
				currentPage="windows-list"
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
				{/* Cabeçalho */}
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
							Registros — Windows Event Log
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
								: `${filteredLogs.length.toLocaleString("pt-BR")} de ${windowsLogs.length.toLocaleString("pt-BR")} eventos`}
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

				{/* Filtros */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: isMobile
							? "1fr"
							: "1fr 160px 160px 1fr 1fr auto",
						gap: 10,
						padding: "14px 18px",
						backgroundColor: "var(--card)",
						border: "1px solid var(--border)",
						borderRadius: 8,
						flexShrink: 0,
					}}
				>
					<input
						type="text"
						placeholder="Filtrar por descrição..."
						value={windowsFilters.message}
						onChange={(e) => onWindowsFilterUpdate("message", e.target.value)}
						style={inputStyle}
					/>
					<input
						type="date"
						value={windowsFilters.date}
						onChange={(e) => onWindowsFilterUpdate("date", e.target.value)}
						style={inputStyle}
					/>
					<select
						value={windowsFilters.criticality}
						onChange={(e) =>
							onWindowsFilterUpdate("criticality", e.target.value)
						}
						style={{ ...inputStyle, cursor: "pointer" }}
					>
						<option value="all">Todas as criticidades</option>
						<option value="High">Alta</option>
						<option value="Medium">Média</option>
						<option value="Low">Baixa</option>
					</select>
					<input
						type="text"
						placeholder="Filtrar por provider..."
						value={windowsFilters.provider}
						onChange={(e) => onWindowsFilterUpdate("provider", e.target.value)}
						style={inputStyle}
					/>
					<input
						type="text"
						placeholder="Filtrar por levelLabel..."
						value={windowsFilters.levelLabel}
						onChange={(e) =>
							onWindowsFilterUpdate("levelLabel", e.target.value)
						}
						style={inputStyle}
					/>
					<button
						onClick={onWindowsFilterReset}
						style={{
							padding: "8px 14px",
							borderRadius: 6,
							border: "1px solid var(--border)",
							backgroundColor: "transparent",
							color: "var(--muted-foreground)",
							fontSize: 12,
							cursor: "pointer",
							fontFamily: "inherit",
							whiteSpace: "nowrap",
						}}
					>
						Limpar
					</button>
				</div>

				{progress.error && <ErrorState message={progress.error} />}

				{!progress.error && (
					<LogTable logs={filteredLogs} columns={columns} isMobile={isMobile} />
				)}
			</main>
		</div>
	);
}
