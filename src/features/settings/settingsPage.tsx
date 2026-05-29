// src/features/windows-event/WindowsDashboard.tsx
import { useState, useMemo } from "react";
import { Sidebar } from "../../components/Sidebar";
import { ThemeToggleButton } from "../../components/ThemeButton";
import { ErrorState } from "../../components/Error";
import { ProgressBar } from "../../components/ProgressBar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { WindowsEventLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";
import { MenuLocationPastas } from "./menuLocationPastas";

export function Settings({
	logs,
	progress,
	reload,
	fileInputRef,
	handleChange,
	openPicker,
	onNavigate,
}: SharedPageProps) {
	const windowWidth = useWindowSize();
	const isMobile = windowWidth < 768;
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const windowsLogs = useMemo(
		() =>
			logs.filter((l): l is WindowsEventLog => l.logType === "windows-event"),
		[logs],
	);

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
				currentPage="settings"
				onNavigate={onNavigate}
			/>

			<main
				style={{
					flex: 1,
					padding: isMobile ? "16px" : "32px",
					overflowY: "auto",
				}}
			>
				{/* Cabeçalho */}
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
							Configurações - LogDash
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
								: `${windowsLogs.length.toLocaleString("pt-BR")} eventos carregados`}
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

				{/* Conteúdo da página */}
				<div>
					<div>
						<header style={{ display: "flex", alignItems: "center", gap: 16 }}>
							<h3>Caminhos das Pastas</h3>
							<MenuLocationPastas id={1} onClick={() => {}} />
						</header>
						<p style={{ color: "var(--muted-foreground)" }}>
							Configure os caminhos das pastas onde os logs estão armazenados.
						</p>
					</div>
				</div>
			</main>
		</div>
	);
}
