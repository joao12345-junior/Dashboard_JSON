// src/App.tsx
import { useState, useEffect } from "react";
import { useAuth, AuthProvider } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { LoginPage } from "./pages/Login";
import { useProgressiveLogs } from "./hooks/useProgressiveLogs";
import { useFileUpload } from "./hooks/useFileUpload";
import { DebugPanel } from "./components/DebugPanel";
import { Toast } from "./components/Toast";

import { HomePage } from "./features/home/HomePage";
import { ProcessDashboard } from "./features/process/ProcessDashboard";
import { ProcessList } from "./features/process/ProcessList";
import { WindowsDashboard } from "./features/windows-event/WindowsDashboard";
import { WindowsList } from "./features/windows-event/WindowsList";
import { Settings } from "./features/settings/settingsPage";

import type { LoadProgress, DebugInfo } from "./hooks/useProgressiveLogs";
import type { Log } from "./lib/types/Log";
import { START_STATUS } from "./lib/Variables";

export type Page =
	| "home"
	| "process-dashboard"
	| "process-list"
	| "windows-dashboard"
	| "windows-list"
	| "settings";

/**
 * Filtros de ProcessList — elevados para o App para sobreviver à navegação.
 * O operador pode alternar entre ProcessList e ProcessDashboard sem perder
 * o contexto da investigação.
 */
export interface ProcessFilterState {
	message: string;
	date: string;
	start: string;
}

/**
 * Filtros de WindowsList — elevados pelo mesmo motivo.
 */
export interface WindowsFilterState {
	message: string;
	date: string;
	criticality: "all" | "High" | "Medium" | "Low";
	provider: string;
	levelLabel: string;
}

/**
 * Contrato completo de props compartilhadas entre todas as páginas.
 *
 * Por que um tipo exportado?
 * Cada página importa esse tipo para declarar seus props.
 * Se você adicionar um campo aqui, o TypeScript aponta exatamente
 * quais páginas precisam ser atualizadas — sem busca manual.
 */
export interface SharedPageProps {
	// Dados
	logs: Log[];
	staticLogs: Log[];
	manualLogs: Log[];
	progress: LoadProgress;
	debug: DebugInfo;
	reload: () => void;

	// Upload
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	openPicker: () => void;

	// Navegação
	onNavigate: (page: Page) => void;

	// Filtros persistentes — Opção A: preservados ao navegar
	processFilters: ProcessFilterState;
	onProcessFilterUpdate: (key: keyof ProcessFilterState, value: string) => void;
	onProcessFilterReset: () => void;

	windowsFilters: WindowsFilterState;
	onWindowsFilterUpdate: (key: keyof WindowsFilterState, value: string) => void;
	onWindowsFilterReset: () => void;
}

const INITIAL_PROCESS_FILTERS: ProcessFilterState = {
	message: "",
	date: "",
	start: START_STATUS.ALL,
};

const INITIAL_WINDOWS_FILTERS: WindowsFilterState = {
	message: "",
	date: "",
	criticality: "all",
	provider: "",
	levelLabel: "",
};

function AppContent() {
	const { isAuthenticated } = useAuth();
	const [page, setPage] = useState<Page>("home");
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	// ── Carregamento de logs — vive no App, nunca é destruído ──────────────────
	const {
		files: logFiles,
		inputRef: fileInputRef,
		handleChange,
		openPicker,
	} = useFileUpload({ mode: "accumulate" });

	const { logs, staticLogs, manualLogs, progress, debug, reload } =
		useProgressiveLogs(logFiles);

	// ── Filtros persistentes — elevados para sobreviver à navegação ────────────
	const [processFilters, setProcessFilters] = useState<ProcessFilterState>(
		INITIAL_PROCESS_FILTERS,
	);

	const [windowsFilters, setWindowsFilters] = useState<WindowsFilterState>(
		INITIAL_WINDOWS_FILTERS,
	);

	// ── Toast global ───────────────────────────────────────────────────────────
	useEffect(() => {
		if (!progress.isDone) return;
		setToastMessage(
			`${debug.totalRecords.toLocaleString("pt-BR")} registros carregados em ${debug.elapsedSeconds}s`,
		);
	}, [progress.isDone]);

	if (!isAuthenticated) return <LoginPage />;

	const sharedProps: SharedPageProps = {
		logs,
		staticLogs,
		manualLogs,
		progress,
		debug,
		reload,
		fileInputRef,
		handleChange,
		openPicker,
		onNavigate: setPage,

		processFilters,
		onProcessFilterUpdate: (key, value) =>
			setProcessFilters((prev) => ({ ...prev, [key]: value })),
		onProcessFilterReset: () => setProcessFilters(INITIAL_PROCESS_FILTERS),

		windowsFilters,
		onWindowsFilterUpdate: (key, value) =>
			setWindowsFilters((prev) => ({ ...prev, [key]: value })),
		onWindowsFilterReset: () => setWindowsFilters(INITIAL_WINDOWS_FILTERS),
	};

	// switch em vez de Record — renderiza só a página ativa.
	// Isso evita que todos os useMemo de todas as páginas rodem
	// simultaneamente a cada lote carregado.
	function renderPage() {
		switch (page) {
			case "home":
				return <HomePage {...sharedProps} />;
			case "process-dashboard":
				return <ProcessDashboard {...sharedProps} />;
			case "process-list":
				return <ProcessList {...sharedProps} />;
			case "windows-dashboard":
				return <WindowsDashboard {...sharedProps} />;
			case "windows-list":
				return <WindowsList {...sharedProps} />;
			case "settings":
				return <Settings {...sharedProps} />;
		}
	}

	return (
		<>
			{renderPage()}
			<DebugPanel progress={progress} debug={debug} />
			<Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
		</>
	);
}

export default function App() {
	return (
		<ThemeProvider>
			<AuthProvider>
				<AppContent />
			</AuthProvider>
		</ThemeProvider>
	);
}
