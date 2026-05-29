// src/features/settings/SettingsPage.tsx
import { useState, useMemo, useEffect } from "react";
import { Sidebar } from "../../components/Sidebar";
import { useWindowSize } from "../../hooks/useWindowSize";
import { WindowsEventLog } from "../../lib/types/Log";
import { btnPrimary, btnSecondary } from "../../lib/styles/buttonStyles";
import type { SharedPageProps } from "../../App";
import { MenuLocationPastas } from "./menuLocationPastas";
import { loadLogPaths, saveLogPaths } from "../../lib/storage/logPaths";
import { ThemeToggleButton } from "../../components/ThemeButton";

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

	// caminhos das pastas
	const [paths, setPaths] = useState<string[]>(() => loadLogPaths());

	useEffect(() => {
		// sincroniza localStorage sempre que paths mudar
		saveLogPaths(paths);
	}, [paths]);

	function handleAddPaths(next: string[]) {
		setPaths(next);
	}

	function handleRemovePath(pathToRemove: string) {
		setPaths((prev) => prev.filter((p) => p !== pathToRemove));
	}

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
							<h3 style={{ margin: 0 }}>Caminhos das Pastas</h3>
							<MenuLocationPastas
								existingPaths={paths}
								onSave={handleAddPaths}
								onRemove={handleRemovePath}
							/>
						</header>
						<p style={{ color: "var(--muted-foreground)" }}>
							Configure os caminhos das pastas onde os logs estão armazenados.
						</p>

						{/* Lista visível na página de settings */}
						<div style={{ marginTop: 12 }}>
							{paths.length === 0 ? (
								<p style={{ color: "var(--muted-foreground)" }}>
									Nenhum caminho salvo.
								</p>
							) : (
								<ul
									style={{
										padding: 0,
										margin: 0,
										listStyle: "none",
										display: "grid",
										gap: 8,
									}}
								>
									{paths.map((p) => (
										<li
											key={p}
											style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												gap: 8,
												padding: "8px",
												borderRadius: 6,
												background: "var(--color-card, var(--card))",
												color:
													"var(--color-card-foreground, var(--card-foreground))",
												border: "1px solid var(--color-border, var(--border))",
											}}
										>
											<span
												style={{
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
													flex: 1,
												}}
											>
												{p}
											</span>
											<div style={{ display: "flex", gap: 8 }}>
												<button
													onClick={() => handleRemovePath(p)}
													title="Remover caminho"
													style={btnSecondary}
												>
													Remover
												</button>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
